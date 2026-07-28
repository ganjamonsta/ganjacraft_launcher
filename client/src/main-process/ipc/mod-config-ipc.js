/**
 * GanjaCraft Launcher - Mod Config Editor IPC Handlers
 * Обработчики IPC для чтения, парсинга и редактирования конфигураций модов
 */

const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');
const { loadConfig } = require('../../modules/config');

/**
 * Получить путь к папке config Minecraft клиента
 */
function getConfigDirectory() {
    const launcherConfig = loadConfig();
    const basePath = launcherConfig.installPath || path.join(process.env.APPDATA || '', '.ganjacraft');
    const configDir = path.join(basePath, 'config');
    if (!fs.existsSync(configDir)) {
        try {
            fs.mkdirSync(configDir, { recursive: true });
        } catch (e) {
            console.error('Failed to create config dir:', e);
        }
    }
    return configDir;
}

/**
 * Проверка защиты от вы determine path traversal
 */
function resolveSafeConfigPath(relativePath) {
    const baseDir = getConfigDirectory();
    const safePath = path.normalize(path.join(baseDir, relativePath));
    if (!safePath.startsWith(path.normalize(baseDir))) {
        throw new Error('Access denied: Invalid file path');
    }
    return safePath;
}

/**
 * Сканирование папки config
 */
function listModConfigFiles() {
    const baseDir = getConfigDirectory();
    if (!fs.existsSync(baseDir)) return [];

    const allowedExtensions = ['.json', '.json5', '.toml', '.properties', '.cfg', '.snbt', '.txt', '.conf'];
    const results = [];

    function scanDir(dir, relPath = '') {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const entryRel = relPath ? path.join(relPath, entry.name) : entry.name;
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    // Рекурсивный сканинг до 2 уровней вглубь
                    if (relPath.split(path.sep).length < 2) {
                        scanDir(fullPath, entryRel);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (allowedExtensions.includes(ext)) {
                        const stat = fs.statSync(fullPath);
                        results.push({
                            name: entry.name,
                            relativePath: entryRel.replace(/\\/g, '/'),
                            size: stat.size,
                            extension: ext.replace('.', ''),
                            mtime: stat.mtime
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Error scanning dir:', dir, e);
        }
    }

    scanDir(baseDir);
    return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Парсер конфигурационных файлов с извлечением комментариев и параметров
 */
function parseConfigContent(content, extension) {
    const lines = content.split(/\r?\n/);
    const items = [];
    let currentCommentBuffer = [];
    let currentCategory = 'Общие';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Пустая строка очищает накопленный буфер комментариев, если это не заголовок
        if (!line) {
            currentCommentBuffer = [];
            continue;
        }

        // Заголовки секций (TOML [section] или CFG/Properties категории)
        if (/^\[.+\]$/.test(line) || /^#+\s*\[.+\]/.test(line)) {
            currentCategory = line.replace(/^#+\s*/, '').replace(/^\[|\]$/g, '').trim();
            currentCommentBuffer = [];
            continue;
        }

        // Строки комментариев (# или //)
        if (line.startsWith('#') || line.startsWith('//')) {
            const commentText = line.replace(/^(\/\/|#)\s*/, '').trim();
            if (commentText) {
                currentCommentBuffer.push(commentText);
            }
            continue;
        }

        // Поиск пары ключ=значение или ключ: значение
        let key = null;
        let valueStr = null;

        // TOML / Properties / CFG (key = value или key: value)
        const matchEqual = line.match(/^([a-zA-Z0-9_\-\.]+)\s*[:=]\s*(.*)$/);
        if (matchEqual) {
            key = matchEqual[1].trim();
            valueStr = matchEqual[2].trim();
        } else if (extension === 'json' || extension === 'json5') {
            // Простой парсинг JSON пары "key": value
            const matchJson = line.match(/^"([^"]+)"\s*:\s*(.*),?$/);
            if (matchJson) {
                key = matchJson[1].trim();
                valueStr = matchJson[2].replace(/,$/, '').trim();
            }
        }

        if (key && valueStr !== null) {
            let typedValue = valueStr;
            let valType = 'string';

            // Очистка кавычек
            if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
                typedValue = valueStr.slice(1, -1);
                valType = 'string';
            } else if (valueStr === 'true' || valueStr === 'false') {
                typedValue = valueStr === 'true';
                valType = 'boolean';
            } else if (!isNaN(Number(valueStr)) && valueStr !== '') {
                typedValue = Number(valueStr);
                valType = 'number';
            }

            items.push({
                key,
                value: typedValue,
                rawLine: line,
                lineNumber: i + 1,
                type: valType,
                description: currentCommentBuffer.join(' '),
                category: currentCategory
            });

            currentCommentBuffer = [];
        }
    }

    return items;
}

/**
 * Чтение конфигурационного файла мода
 */
function readModConfigFile(relativePath) {
    const fullPath = resolveSafeConfigPath(relativePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error('Файл не найден: ' + relativePath);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const ext = path.extname(relativePath).toLowerCase().replace('.', '');
    const parsedItems = parseConfigContent(content, ext);

    return {
        relativePath: relativePath.replace(/\\/g, '/'),
        rawContent: content,
        items: parsedItems,
        extension: ext
    };
}

/**
 * Сохранение конфигурационного файла мода
 */
function saveModConfigFile(relativePath, newContent) {
    const fullPath = resolveSafeConfigPath(relativePath);
    fs.writeFileSync(fullPath, newContent, 'utf8');
    return { success: true };
}

const { downloadWithRetry } = require('../../modules/updater');

/**
 * Удалить файл конфигурации мода (сброс к дефолту)
 */
function deleteModConfigFile(relativePath) {
    const fullPath = resolveSafeConfigPath(relativePath);
    if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
    }
    return { success: true };
}

/**
 * Проверить существование файла конфига
 */
function checkConfigExists(relativePath) {
    const fullPath = resolveSafeConfigPath(relativePath);
    return { exists: fs.existsSync(fullPath) };
}

/**
 * Скачать кастомный пресет конфига по URL
 */
async function downloadPresetConfigFile(url, relativePath) {
    const fullPath = resolveSafeConfigPath(relativePath);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }
    await downloadWithRetry(url, fullPath, { timeoutMs: 15000 });
    return { success: true };
}

/**
 * Эффективный апдейтер значений элементов в конфигурационном файле
 * с сохранением всей оригинальной структуры, отступов и комментариев.
 */
function updateModConfigValues(relativePath, updatedItems) {
    const fullPath = resolveSafeConfigPath(relativePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error('Файл не найден: ' + relativePath);
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const item of updatedItems) {
        if (item.lineNumber && item.lineNumber <= lines.length) {
            const idx = item.lineNumber - 1;
            const line = lines[idx];

            if (item.type === 'boolean') {
                lines[idx] = line.replace(/:\s*(true|false)/i, `: ${item.value}`)
                                 .replace(/=\s*(true|false)/i, `= ${item.value}`);
            } else if (item.type === 'number') {
                lines[idx] = line.replace(/:\s*(-?\d+\.?\d*)/, `: ${item.value}`)
                                 .replace(/=\s*(-?\d+\.?\d*)/, `= ${item.value}`);
            } else if (item.type === 'string') {
                lines[idx] = line.replace(/(["']).*?\1/, `"${item.value}"`)
                                 .replace(/:\s*.*$/, `: "${item.value}"`)
                                 .replace(/=\s*.*$/, `= "${item.value}"`);
            }
        }
    }

    const newContent = lines.join('\n');
    fs.writeFileSync(fullPath, newContent, 'utf8');
    return { success: true };
}

/**
 * Регистрация IPC обработчиков для конфигов модов
 */
function registerModConfigHandlers() {
    ipcMain.handle('list-mod-configs', () => {
        try {
            return { success: true, files: listModConfigFiles() };
        } catch (e) {
            return { success: false, error: e.message, files: [] };
        }
    });

    ipcMain.handle('read-mod-config', (event, relativePath) => {
        try {
            return { success: true, data: readModConfigFile(relativePath) };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('save-mod-config', (event, relativePath, newContent) => {
        try {
            return saveModConfigFile(relativePath, newContent);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('update-mod-config-values', (event, relativePath, updatedItems) => {
        try {
            return updateModConfigValues(relativePath, updatedItems);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('delete-mod-config', (event, relativePath) => {
        try {
            return deleteModConfigFile(relativePath);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('check-config-exists', (event, relativePath) => {
        try {
            return checkConfigExists(relativePath);
        } catch (e) {
            return { exists: false, error: e.message };
        }
    });

    ipcMain.handle('download-preset-config', async (event, url, relativePath) => {
        try {
            return await downloadPresetConfigFile(url, relativePath);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
}

module.exports = {
    registerModConfigHandlers,
    listModConfigFiles,
    readModConfigFile,
    saveModConfigFile,
    updateModConfigValues,
    deleteModConfigFile,
    checkConfigExists,
    downloadPresetConfigFile
};
