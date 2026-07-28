/**
 * GanjaCraft Launcher - File Integrity Checks
 * Проверка целостности файлов (ZIP/JAR)
 */

const fs = require('fs');
const path = require('path');

/**
 * Проверить целостность ZIP/JAR файла (Async)
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<boolean>}
 */
async function isZipIntact(filePath) {
    try {
        try {
            await fs.promises.access(filePath);
        } catch {
            return false;
        }
        
        const stats = await fs.promises.stat(filePath);
        if (!stats.isFile() || stats.size < 22) return false;

        const handle = await fs.promises.open(filePath, 'r');
        try {
            // ZIP local file header: PK\x03\x04
            const header = Buffer.alloc(4);
            await handle.read(header, 0, 4, 0);
            if (header.toString('hex') !== '504b0304') return false;

            // EOCD signature: PK\x05\x06 must exist near the end.
            const scanSize = Math.min(stats.size, 64 * 1024);
            const tail = Buffer.alloc(scanSize);
            await handle.read(tail, 0, scanSize, stats.size - scanSize);
            return tail.includes(Buffer.from([0x50, 0x4B, 0x05, 0x06]));
        } finally {
            await handle.close();
        }
    } catch {
        return false;
    }
}

/**
 * Очистить нулевые и повреждённые файлы в директории (Async)
 * @param {string} dir - Путь к директории
 */
async function cleanZeroByteFiles(dir) {
    try {
        await fs.promises.access(dir);
    } catch {
        return;
    }
    
    try {
        const files = await fs.promises.readdir(dir);
        // Process files in parallel chunks to avoid too many open files
        const chunkSize = 50;
        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (file) => {
                const filePath = path.join(dir, file);
                let stats;
                try {
                    stats = await fs.promises.stat(filePath);
                } catch {
                    return;
                }
                
                if (stats.isDirectory()) {
                    await cleanZeroByteFiles(filePath);
                } else if (stats.isFile()) {
                    let shouldDelete = false;
                    
                    if (stats.size === 0) {
                        shouldDelete = true;
                    } else if (file.endsWith('.jar') || file.endsWith('.zip')) {
                        // Reuse shared ZIP integrity check
                        if (!(await isZipIntact(filePath))) {
                            console.log(`[CLEANUP] Corrupt JAR/ZIP detected: ${filePath}`);
                            shouldDelete = true;
                        }
                    }

                    if (shouldDelete) {
                        console.log(`[CLEANUP] Deleting corrupted file: ${filePath}`);
                        try {
                            await fs.promises.unlink(filePath);
                        } catch (e) {
                            console.error(`[CLEANUP] Failed to delete ${filePath}:`, e);
                        }
                    }
                }
            }));
        }
    } catch (e) {
        console.error(`[CLEANUP] Error scanning ${dir}:`, e);
    }
}

/**
 * Проверить, что директория доступна для записи (Async)
 * @param {string} dirPath - Путь к директории
 */
async function assertDirectoryWritable(dirPath) {
    try {
        await fs.promises.access(dirPath);
    } catch {
        await fs.promises.mkdir(dirPath, { recursive: true });
    }
    
    const testName = `.write-test-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
    const testPath = path.join(dirPath, testName);
    
    try {
        const handle = await fs.promises.open(testPath, 'w');
        await handle.close();
        await fs.promises.unlink(testPath);
    } catch (e) {
        throw new Error(`Directory is not writable: ${dirPath} (${e.message})`);
    }
}

/**
 * Убедиться, что файл доступен для записи (Async)
 * @param {string} filePath - Путь к файлу
 */
async function ensureWritableFilePath(filePath) {
    const dir = path.dirname(filePath);
    try {
        await fs.promises.access(dir);
    } catch {
        await fs.promises.mkdir(dir, { recursive: true });
    }

    try {
        await fs.promises.access(filePath);
    } catch {
        return;
    }

    // Fast-path: if we can open for appending, the file isn't readonly/locked.
    try {
        const handle = await fs.promises.open(filePath, 'a');
        await handle.close();
        return;
    } catch (e) {
        // continue
    }

    // Try to clear readonly and remove the file so MCLC can re-download it.
    try {
        try { await fs.promises.chmod(filePath, 0o666); } catch {}
        await fs.promises.unlink(filePath);
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
