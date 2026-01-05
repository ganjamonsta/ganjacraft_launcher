/**
 * GanjaCraft Launcher - File Integrity Checks
 * Проверка целостности файлов (ZIP/JAR)
 */

const fs = require('fs');
const path = require('path');

/**
 * Проверить целостность ZIP/JAR файла
 * @param {string} filePath - Путь к файлу
 * @returns {boolean}
 */
function isZipIntact(filePath) {
    try {
        if (!fs.existsSync(filePath)) return false;
        const stats = fs.statSync(filePath);
        if (!stats.isFile() || stats.size < 22) return false;

        const fd = fs.openSync(filePath, 'r');
        try {
            // ZIP local file header: PK\x03\x04
            const header = Buffer.alloc(4);
            fs.readSync(fd, header, 0, 4, 0);
            if (header.toString('hex') !== '504b0304') return false;

            // EOCD signature: PK\x05\x06 must exist near the end.
            const scanSize = Math.min(stats.size, 64 * 1024);
            const tail = Buffer.alloc(scanSize);
            fs.readSync(fd, tail, 0, scanSize, stats.size - scanSize);
            return tail.includes(Buffer.from([0x50, 0x4B, 0x05, 0x06]));
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return false;
    }
}

/**
 * Очистить нулевые и повреждённые файлы в директории
 * @param {string} dir - Путь к директории
 */
function cleanZeroByteFiles(dir) {
    if (!fs.existsSync(dir)) return;
    
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            let stats;
            try {
                stats = fs.statSync(filePath);
            } catch {
                continue; // Skip inaccessible files
            }
            
            if (stats.isDirectory()) {
                cleanZeroByteFiles(filePath);
            } else if (stats.isFile()) {
                let shouldDelete = false;
                
                if (stats.size === 0) {
                    shouldDelete = true;
                } else if (file.endsWith('.jar') || file.endsWith('.zip')) {
                    // Reuse shared ZIP integrity check
                    if (!isZipIntact(filePath)) {
                        console.log(`[CLEANUP] Corrupt JAR/ZIP detected: ${filePath}`);
                        shouldDelete = true;
                    }
                }

                if (shouldDelete) {
                    console.log(`[CLEANUP] Deleting corrupted file: ${filePath}`);
                    try {
                        fs.unlinkSync(filePath);
                    } catch (e) {
                        console.error(`[CLEANUP] Failed to delete ${filePath}:`, e);
                        throw new Error(
                            `Не удалось удалить поврежденный файл: ${path.basename(filePath)}. ` +
                            `Возможно, он занят другим процессом. Перезагрузите ПК.`
                        );
                    }
                }
            }
        }
    } catch (e) {
        if (e.message?.includes('Не удалось удалить')) throw e;
        console.error(`[CLEANUP] Error scanning ${dir}:`, e);
    }
}

/**
 * Проверить, что директория доступна для записи
 * @param {string} dirPath - Путь к директории
 */
async function assertDirectoryWritable(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    
    const testName = `.write-test-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
    const testPath = path.join(dirPath, testName);
    
    // If Windows Defender / CFA blocks the folder, openSync('w') tends to throw EPERM.
    const fd = fs.openSync(testPath, 'w');
    fs.closeSync(fd);
    try { fs.unlinkSync(testPath); } catch {}
}

/**
 * Убедиться, что файл доступен для записи
 * @param {string} filePath - Путь к файлу
 */
async function ensureWritableFilePath(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) return;

    // Fast-path: if we can open for appending, the file isn't readonly/locked.
    try {
        const fd = fs.openSync(filePath, 'a');
        fs.closeSync(fd);
        return;
    } catch (e) {
        // continue
    }

    // Try to clear readonly and remove the file so MCLC can re-download it.
    try {
        try { fs.chmodSync(filePath, 0o666); } catch {}
        fs.unlinkSync(filePath);
    } catch (e) {
        // EPERM on Windows usually means file is locked by AV scan or another process.
        const msg = e && e.code ? `${e.code}: ${e.message}` : (e?.message || String(e));
        throw new Error(
            `Не удалось подготовить файл библиотек для обновления: ${path.basename(filePath)}\n` +
            `Причина: ${msg}\n\n` +
            `Решение (Windows 11):\n` +
            `1) Закройте игру и лаунчер, перезагрузите ПК\n` +
            `2) Добавьте папку установки игры в исключения Защитника Windows/антивируса\n` +
            `3) Отключите "Контролируемый доступ к папкам" (если включен) или разрешите лаунчер\n` +
            `4) Убедитесь, что папка игры не помечена как "Только чтение"`
        );
    }
}

module.exports = {
    isZipIntact,
    cleanZeroByteFiles,
    assertDirectoryWritable,
    ensureWritableFilePath,
};
