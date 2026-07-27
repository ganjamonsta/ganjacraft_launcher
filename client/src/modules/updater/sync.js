/**
 * GanjaCraft Launcher - File Sync Module
 * Основная логика синхронизации файлов с манифестом
 */

const fs = require('fs');
const path = require('path');
const { resolveUnderRoot, getFileHash, ensureDir, isModDisabled } = require('./utils');
const { downloadFile, downloadWithRetry } = require('./download');
const { resolveModrinthUrls } = require('./modrinth');
const { resolveCurseForgeUrls } = require('./curseforge');
const { cleanupAll } = require('./cleanup');
const { CURSEFORGE_API_KEY } = require('../../main-process/constants');

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

function formatBytes(bytes) {
    if (!bytes || typeof bytes !== 'number' || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getSourceInfo(url) {
    if (!url) return { name: 'Сервер', icon: '📦' };
    if (url.includes('modrinth.com')) return { name: 'Modrinth CDN', icon: '⚡' };
    if (url.includes('forgecdn.net') || url.includes('curseforge.com')) return { name: 'CurseForge CDN', icon: '🔥' };
    return { name: 'Сервер GanjaCraft', icon: '📦' };
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

    // 2.5. Быстрый резолвинг модов через Modrinth CDN (по SHA1 хешам)
    const jarHashes = manifest.files
        .filter(f => f && f.hash && typeof f.path === 'string' && f.path.endsWith('.jar'))
        .map(f => f.hash);

    if (jarHashes.length > 0) {
        sendLog('Поиск модов на Modrinth CDN...');
        try {
            const modrinthMap = await resolveModrinthUrls(jarHashes);
            const resolvedCount = Object.keys(modrinthMap).length;
            if (resolvedCount > 0) {
                for (const file of manifest.files) {
                    if (file && file.hash && modrinthMap[file.hash.toLowerCase()]) {
                        file.url = modrinthMap[file.hash.toLowerCase()];
                    }
                }
            }
        } catch (mErr) {
            sendLog(`Предупреждение Modrinth CDN: ${mErr.message}`);
        }
    }

    // 2.55. Вторичный резолвинг модов через CurseForge API
    const unmappedCurseFiles = manifest.files.filter(f => 
        f && typeof f.path === 'string' && f.path.endsWith('.jar') && !f.url.includes('modrinth.com')
    );

    if (unmappedCurseFiles.length > 0 && CURSEFORGE_API_KEY) {
        sendLog(`Поиск ${unmappedCurseFiles.length} модов на CurseForge...`);
        try {
            const curseMap = await resolveCurseForgeUrls(unmappedCurseFiles, CURSEFORGE_API_KEY);
            const cfCount = Object.keys(curseMap).length;
            if (cfCount > 0) {
                for (const file of manifest.files) {
                    if (file && file.path && curseMap[file.path]) {
                        file.url = curseMap[file.path];
                    }
                }
            }
        } catch (cErr) {
            sendLog(`Предупреждение CurseForge CDN: ${cErr.message}`);
        }
    }

    // 2.6. Подсчет статистики источников
    let modrinthCount = 0;
    let curseCount = 0;
    let serverCount = 0;
    for (const f of manifest.files) {
        const src = getSourceInfo(f.url);
        if (src.name.includes('Modrinth')) modrinthCount++;
        else if (src.name.includes('CurseForge')) curseCount++;
        else serverCount++;
    }

    sendLog(`📊 Источники модов: ⚡ Modrinth CDN (${modrinthCount}) | 🔥 CurseForge (${curseCount}) | 📦 Сервер (${serverCount})`);

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
        if (file && typeof file.path === 'string' && isModDisabled(file.path, disabledMods)) {
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
            const src = getSourceInfo(file.url);
            const sizeStr = formatBytes(file.size);
            sendLog(`[${processed + 1}/${totalFiles}] ${src.icon} [${src.name}] Скачивание ${file.path} (${sizeStr})...`);
            await downloadWithRetry(file.url, localPath, {
                expectedHash: file.hash,
                expectedSize: typeof file.size === 'number' ? file.size : null,
            }, 4, 1500);
            downloaded++;
        }
        
        processed++;
        const src = getSourceInfo(file.url);
        if (onProgress) {
            onProgress({
                task: processed,
                total: totalFiles,
                type: 'mods',
                currentFile: file.path,
                sourceName: src.name,
                sizeFormatted: formatBytes(file.size)
            });
        }
    }

    // Запускаем параллельную обработку
    const failedFiles = [];
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push((async () => {
            while (queue.length > 0) {
                const file = queue.shift();
                try {
                    await processFile(file);
                } catch (err) {
                    if (err.message === 'CANCELLED') throw err;
                    sendLog(`Предупреждение: не удалось сразу скачать ${file?.path || 'unknown'}, отложено для повтора...`);
                    failedFiles.push(file);
                }
            }
        })());
    }

    await Promise.all(workers);

    // Повторный проход для файлов, упавших во время параллельного скачивания
    if (failedFiles.length > 0) {
        sendLog(`Повторная попытка скачивания для ${failedFiles.length} файлов...`);
        const finalFailures = [];
        for (const file of failedFiles) {
            try {
                await processFile(file);
            } catch (err) {
                if (err.message === 'CANCELLED') throw err;
                sendLog(`Ошибка обработки ${file?.path || 'unknown'}: ${err.message}`);
                finalFailures.push(file);
            }
        }
        if (finalFailures.length > 0) {
            throw new Error(`Не удалось скачать ${finalFailures.length} файлов из манифеста после повторов.`);
        }
    }

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
