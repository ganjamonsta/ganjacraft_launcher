/**
 * GanjaCraft Launcher - Config IPC Handlers
 * Обработчики конфигурации
 */

const fs = require('fs');
const { ipcMain, dialog, shell, app } = require('electron');
const https = require('https');
const { loadConfig, saveConfig } = require('../../modules/config');
const { MANIFEST_URL } = require('../constants');

/**
 * Зарегистрировать обработчики конфигурации
 * @param {BrowserWindow} mainWindow - Главное окно
 */
function registerConfigHandlers(mainWindow) {
    // Load config
    ipcMain.handle('load-config', () => loadConfig());
    
    // Save config
    ipcMain.handle('save-config', (event, config) => saveConfig(config));
    
    // Get app version
    ipcMain.handle('get-app-version', () => app.getVersion());
    
    // Select path dialog
    ipcMain.handle('select-path', async (event, type) => {
        const properties = type === 'file' ? ['openFile'] : ['openDirectory'];
        const result = await dialog.showOpenDialog(mainWindow, { properties });
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });
    
    // Open folder in explorer
    ipcMain.handle('open-folder', async (event, folderPath) => {
        if (folderPath && fs.existsSync(folderPath)) {
            await shell.openPath(folderPath);
            return true;
        }
        return false;
    });
    
    // Open URL in browser
    ipcMain.handle('open-url', async (event, url) => {
        await shell.openExternal(url);
    });
    
    // Get manifest - с кешированием чтобы не блокировать UI
    let manifestCache = null;
    let manifestCacheTime = 0;
    const MANIFEST_CACHE_TTL = 30_000; // 30 секунд
    
    ipcMain.handle('get-manifest', async () => {
        // Возвращаем кеш если свежий
        const now = Date.now();
        if (manifestCache && (now - manifestCacheTime) < MANIFEST_CACHE_TTL) {
            return manifestCache;
        }
        
        // Читаем локальный манифест если есть (мгновенно)
        const config = loadConfig();
        const localManifestPath = require('path').join(config.installPath, 'manifest.json');
        
        let localManifest = null;
        try {
            if (fs.existsSync(localManifestPath)) {
                localManifest = JSON.parse(fs.readFileSync(localManifestPath, 'utf-8'));
            }
        } catch {}
        
        // Пробуем загрузить свежий (неблокирующе)
        try {
            const parsedUrl = new URL(MANIFEST_URL);
            const reqOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                timeout: 3000,
                headers: {
                    'User-Agent': 'localtunnel',
                    'Bypass-Tunnel-Reminder': 'true'
                }
            };
            const fresh = await new Promise((resolve, reject) => {
                const req = https.request(reqOptions, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try { resolve(JSON.parse(data)); }
                        catch { reject(new Error('Invalid JSON')); }
                    });
                });
                
                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                req.end();
            });
            
            manifestCache = fresh;
            manifestCacheTime = now;
            return fresh;
        } catch {
            // Fallback на локальный
            if (localManifest) {
                manifestCache = localManifest;
                manifestCacheTime = now;
                return localManifest;
            }
            return null;
        }
    });
    
    // Reinstall client (delete mods, config, libraries, versions)
    ipcMain.handle('reinstall-client', async () => {
        const config = loadConfig();
        const rootPath = config.installPath;
        
        ['mods', 'config', 'libraries', 'versions'].forEach(dir => {
            const p = require('path').join(rootPath, dir);
            if (fs.existsSync(p)) {
                fs.rmSync(p, { recursive: true, force: true });
            }
        });
        
        return true;
    });

    // Real client file integrity verification (by size & SHA1 hash)
    ipcMain.handle('verify-integrity', async () => {
        const pathModule = require('path');
        const { getFileHash, downloadWithRetry } = require('../../modules/updater');
        const config = loadConfig();
        const rootPath = config.installPath;
        const disabledMods = config.disabledMods || [];

        // 1. Read manifest (local or remote)
        let manifest = null;
        const localManifestPath = pathModule.join(rootPath, 'manifest.json');
        try {
            if (fs.existsSync(localManifestPath)) {
                manifest = JSON.parse(fs.readFileSync(localManifestPath, 'utf-8'));
            }
        } catch {}

        if (!manifest || !manifest.files) {
            // Try downloading fresh manifest
            try {
                const parsedUrl = new URL(MANIFEST_URL);
                const reqOptions = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || 443,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'GET',
                    timeout: 5000,
                    headers: { 'User-Agent': 'localtunnel', 'Bypass-Tunnel-Reminder': 'true' }
                };
                const data = await new Promise((resolve, reject) => {
                    const req = https.request(reqOptions, res => {
                        let buf = '';
                        res.on('data', c => buf += c);
                        res.on('end', () => resolve(buf));
                    });
                    req.on('error', reject);
                    req.end();
                });
                manifest = JSON.parse(data);
            } catch {}
        }

        if (!manifest || !manifest.files) {
            return { success: false, error: 'Не удалось получить манифест для проверки файлов.' };
        }

        // Filter files (skip disabled optional mods)
        const targetFiles = manifest.files.filter(f => f.path && !disabledMods.includes(f.path));
        const total = targetFiles.length;

        let okCount = 0;
        let repairedCount = 0;
        const repairedFiles = [];

        for (let i = 0; i < total; i++) {
            const file = targetFiles[i];
            const fullPath = pathModule.join(rootPath, file.path);
            const fileName = file.path.split('/').pop();

            // Send progress update
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('integrity-progress', {
                    current: i + 1,
                    total,
                    file: file.path,
                    fileName,
                    status: 'checking'
                });
            }

            let isValid = false;

            if (fs.existsSync(fullPath)) {
                try {
                    const stat = fs.statSync(fullPath);
                    if (!file.size || stat.size === file.size) {
                        if (file.hash) {
                            const hash = await getFileHash(fullPath);
                            if (hash.toLowerCase() === file.hash.toLowerCase()) {
                                isValid = true;
                            }
                        } else {
                            isValid = true;
                        }
                    }
                } catch {}
            }

            if (isValid) {
                okCount++;
            } else {
                // Send repair status
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('integrity-progress', {
                        current: i + 1,
                        total,
                        file: file.path,
                        fileName,
                        status: 'repaired'
                    });
                }

                if (file.url) {
                    try {
                        const dir = pathModule.dirname(fullPath);
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        await downloadWithRetry(file.url, fullPath, { expectedHash: file.hash });
                        repairedCount++;
                        repairedFiles.push(fileName);
                    } catch (e) {
                        console.error(`Ошибка восстановления файла ${file.path}:`, e.message);
                    }
                }
            }
        }

        return {
            success: true,
            total,
            okCount,
            repairedCount,
            repairedFiles
        };
    });
}

module.exports = {
    registerConfigHandlers,
};
