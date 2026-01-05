/**
 * GanjaCraft Launcher - Updater Utilities
 * Утилиты безопасности и хеширования
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

/**
 * Безопасное разрешение пути внутри rootPath
 * Предотвращает path traversal атаки
 * @param {string} rootPath - Корневая директория
 * @param {string} relativePath - Относительный путь из манифеста
 * @returns {string} - Абсолютный путь
 * @throws {Error} - Если путь выходит за пределы root
 */
function resolveUnderRoot(rootPath, relativePath) {
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
        throw new Error('Invalid manifest path');
    }

    // Disallow absolute paths and obvious traversal
    if (path.isAbsolute(relativePath)) {
        throw new Error(`Absolute paths are not allowed in manifest: ${relativePath}`);
    }

    const rootResolved = path.resolve(rootPath);
    const destResolved = path.resolve(rootPath, relativePath);
    const rootWithSep = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;
    
    if (!destResolved.startsWith(rootWithSep) && destResolved !== rootResolved) {
        throw new Error(`Path traversal detected in manifest path: ${relativePath}`);
    }
    
    return destResolved;
}

/**
 * Вычислить SHA1 хеш файла
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<string>} - Hex хеш
 */
function getFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const stream = fs.createReadStream(filePath);
        
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

/**
 * Безопасное удаление файла (с проверкой существования)
 * @param {string} filePath - Путь к файлу
 */
function safeUnlink(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        // Ignore errors on cleanup
    }
}

/**
 * Создать директорию если не существует
 * @param {string} dirPath - Путь к директории
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Генерировать уникальный временный путь
 * @param {string} destPath - Целевой путь
 * @returns {string} - Временный путь
 */
function getTempPath(destPath) {
    return `${destPath}.tmp-${crypto.randomUUID()}`;
}

module.exports = {
    resolveUnderRoot,
    getFileHash,
    safeUnlink,
    ensureDir,
    getTempPath
};
