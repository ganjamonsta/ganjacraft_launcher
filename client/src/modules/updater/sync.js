/**
 * GanjaCraft Launcher - File Sync Module
 * Основная логика синхронизации файлов с манифестом
 */

const fs = require('fs');
const path = require('path');
const { resolveUnderRoot, getFileHash, ensureDir } = require('./utils');
const { downloadFile, downloadWithRetry } = require('./download');
const { cleanupAll } = require('./cleanup');

// Категории файлов для защиты/обновления
const FILE_CATEGORIES = {
    // Сервер-контролируемые файлы — всегда обновляются
    serverControlled: [
        'fancymenu_data/',
        'config/fancymenu/',
        'config/fancymenu-',
        'resourcepacks/[GanjaCraft]',
        'kubejs/'
    ],
    // Пользовательские файлы — защищены если существуют локально
    userProtected: [
        'options.txt',
        'servers.dat'
    ]
};

/**
 * Проверить, является ли файл сервер-контролируемым
 */
function isServerControlled(filePath) {
    return FILE_CATEGORIES.serverControlled.some(prefix => filePath.startsWith(prefix));
}

/**
 * Проверить, является ли файл пользовательским (защищённым)
 */
function isUserProtected(filePath) {
    // options.txt, servers.dat
    if (FILE_CATEGORIES.userProtected.includes(filePath)) {
        return true;
    }
    // config/* кроме сервер-контролируемых
    if (filePath.startsWith('config/') && !isServerControlled(filePath)) {
        return true;
    }
    return false;
}

/**
 * Синхронизация файлов с манифестом сервера
 * @param {string} rootPath - Путь к папке игры
 * @param {string} manifestUrl - URL манифеста
 * @param {function} sendLog - Callback для логирования
 * @param {function} onProgress - Callback для прогресса {task, total, type}
 * @param {string[]} disabledMods - Список путей отключённых модов
 * @param {function} checkCancelled - Функция проверки отмены
 */
async function syncFiles(rootPath, manifestUrl, sendLog, onProgress, disabledMods = [], checkCancelled = () => false) {
    sendLog('Проверка обновлений...');
    
    // 1. Скачиваем манифест
    const manifestPath = path.join(rootPath, 'manifest.json');
    try {
        await downloadWithRetry(manifestUrl, manifestPath, { timeoutMs: 15_000 });
    } catch (e) {
        sendLog('Ошибка загрузки манифеста: ' + e.message);
        throw e;
    }

    // 2. Парсим манифест
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
        sendLog('Ошибка чтения манифеста: некорректный JSON');
        throw e;
    }

    if (!manifest || !Array.isArray(manifest.files)) {
        throw new Error('Invalid manifest format: files[] is missing');
    }

    sendLog(`Найдено ${manifest.files.length} файлов в манифесте.`);

    // 3. Обрабатываем файлы параллельно
    const CONCURRENCY = 4;
    let processed = 0;
    let downloaded = 0;
    const totalFiles = manifest.files.length;
    const queue = [...manifest.files];
    
    async function processFile(file) {
        // Проверка отмены
        if (checkCancelled()) {
            throw new Error('CANCELLED');
        }

        // Пропуск отключённых модов (удаляем если существуют)
        if (file && typeof file.path === 'string' && disabledMods.includes(file.path)) {
            const localPath = resolveUnderRoot(rootPath, file.path);
            if (fs.existsSync(localPath)) {
                sendLog(`Удаление отключенного мода: ${file.path}`);
                try { fs.rmSync(localPath, { force: true }); } catch {}
            }
            return;
        }

        // Валидация записи манифеста
        if (!file || typeof file.path !== 'string' || typeof file.url !== 'string' || typeof file.hash !== 'string') {
            throw new Error('Invalid manifest file entry');
        }

        const localPath = resolveUnderRoot(rootPath, file.path);
        const localDir = path.dirname(localPath);

        // Защита пользовательских файлов
        if (isUserProtected(file.path) && fs.existsSync(localPath)) {
            processed++;
            if (onProgress) {
                onProgress({ task: processed, total: totalFiles, type: 'mods' });
            }
            return;
        }

        // Создаём директорию
        ensureDir(localDir);

        // Проверяем нужно ли скачивать
        let needDownload = false;

        if (!fs.existsSync(localPath)) {
            needDownload = true;
        } else {
            // Оптимизация: сначала проверяем размер
            if (file.size) {
                try {
                    const stats = fs.statSync(localPath);
                    if (stats.size !== file.size) {
                        needDownload = true;
                    }
                } catch {
                    needDownload = true;
                }
            }

            // Если размер совпал — проверяем хеш
            if (!needDownload) {
                try {
                    const localHash = await getFileHash(localPath);
                    if (localHash !== file.hash) {
                        needDownload = true;
                    }
                } catch {
                    needDownload = true;
                }
            }
        }

        // Скачиваем если нужно
        if (needDownload) {
            await downloadFile(file.url, localPath, {
                expectedHash: file.hash,
                expectedSize: typeof file.size === 'number' ? file.size : null,
            });
            downloaded++;
        }
        
        processed++;
        if (onProgress) {
            onProgress({ task: processed, total: totalFiles, type: 'mods' });
        }
    }

    // Запускаем параллельную обработку
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push((async () => {
            while (queue.length > 0) {
                const file = queue.shift();
                try {
                    await processFile(file);
                } catch (err) {
                    if (err.message === 'CANCELLED') throw err;
                    sendLog(`Ошибка обработки ${file?.path || 'unknown'}: ${err.message}`);
                    throw err;
                }
            }
        })());
    }

    await Promise.all(workers);
    sendLog('Все файлы проверены.');

    // 4. Очистка устаревших файлов
    cleanupAll(rootPath, manifest, disabledMods, sendLog);

    // 5. Итоговое сообщение
    if (downloaded > 0) {
        sendLog(`Обновление завершено. Скачано: ${downloaded}`);
    } else {
        sendLog('Обновление завершено. Файлы проверены.');
    }
}

module.exports = { 
    syncFiles,
    isServerControlled,
    isUserProtected,
    FILE_CATEGORIES
};
