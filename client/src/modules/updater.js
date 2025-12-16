const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const path = require('path');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            // Handle Redirects
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            
            const file = fs.createWriteStream(dest);
            file.on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });

            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        });
        
        request.on('error', (err) => {
            if (fs.existsSync(dest)) fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

function getFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function syncFiles(rootPath, manifestUrl, sendLog, onProgress, disabledMods = [], checkCancelled = () => false) {
    sendLog('Проверка обновлений...');
    
    // 1. Download Manifest
    const manifestPath = path.join(rootPath, 'manifest.json');
    try {
        await downloadFile(manifestUrl, manifestPath);
    } catch (e) {
        sendLog('Ошибка загрузки манифеста: ' + e.message);
        throw e;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    sendLog(`Найдено ${manifest.files.length} файлов в манифесте.`);

    let processed = 0;
    const totalFiles = manifest.files.length;
    
    for (const file of manifest.files) {
        // Report Progress
        processed++;
        if (onProgress) {
            onProgress({ task: processed, total: totalFiles, type: 'mods' });
        }

        // Check Cancellation
        if (checkCancelled()) {
            throw new Error('CANCELLED');
        }

        // Check if disabled
        if (disabledMods.includes(file.path)) {
            const localPath = path.join(rootPath, file.path);
            if (fs.existsSync(localPath)) {
                sendLog(`Удаление отключенного мода: ${file.path}`);
                fs.unlinkSync(localPath);
            }
            continue;
        }

        const localPath = path.join(rootPath, file.path);
        const localDir = path.dirname(localPath);

        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        let needDownload = false;

        if (!fs.existsSync(localPath)) {
            needDownload = true;
        } else {
            const localHash = await getFileHash(localPath);
            if (localHash !== file.hash) {
                needDownload = true;
            }
        }

        if (needDownload) {
            sendLog(`Скачивание: ${file.path} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            try {
                await downloadFile(file.url, localPath);
                downloaded++;
            } catch (e) {
                sendLog(`Ошибка скачивания ${file.path}: ${e.message}`);
            }
        }
    }

    // Cleanup: Remove unmanaged files in 'mods' directory
    const modsDir = path.join(rootPath, 'mods');
    if (fs.existsSync(modsDir)) {
        const localFiles = fs.readdirSync(modsDir);
        const manifestMods = new Set(
            manifest.files
                .filter(f => f.path.startsWith('mods/') && !disabledMods.includes(f.path))
                .map(f => path.normalize(f.path))
        );

        for (const file of localFiles) {
            const fullPath = path.join(modsDir, file);
            try {
                if (fs.statSync(fullPath).isDirectory()) continue;
            } catch (e) { continue; }

            const relativePath = path.join('mods', file);
            const normalizedPath = path.normalize(relativePath);

            if (!manifestMods.has(normalizedPath)) {
                sendLog(`Удаление лишнего файла: ${relativePath}`);
                try {
                    fs.unlinkSync(fullPath);
                } catch (e) {
                    sendLog(`Не удалось удалить ${relativePath}: ${e.message}`);
                }
            }
        }
    }

    if (downloaded > 0) {
        sendLog(`Обновление завершено. Скачано: ${downloaded}`);
    } else {
        sendLog('Обновление завершено. Файлы проверены.');
    }
}

module.exports = { downloadFile, getFileHash, syncFiles };
