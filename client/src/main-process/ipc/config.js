/**
 * GanjaCraft Launcher - Config IPC Handlers
 * Обработчики конфигурации
 */

const fs = require('fs');
const { ipcMain, dialog, shell, app } = require('electron');
const https = require('https');
const { loadConfig, saveConfig } = require('../../modules/config');
const { resolveJavaPath } = require('../../modules/java');
const { MANIFEST_URL } = require('../constants');
const ConfigParser = require('../config-parser');

/**
 * Зарегистрировать обработчики конфигурации
 * @param {BrowserWindow} mainWindow - Главное окно
 */
function registerConfigHandlers(mainWindow) {
    // Load config
    ipcMain.handle('load-config', () => loadConfig());
    
    // Save config
    ipcMain.handle('save-config', (event, config) => saveConfig(config));
    
    // Get game configs
    ipcMain.handle('get-game-configs', async () => {
        const config = loadConfig();
        const configDir = require('path').join(config.installPath, 'config');
        const files = await ConfigParser.scanConfigsDir(configDir);
        
        const promises = files.map(file => ConfigParser.parseFile(file));
        const results = await Promise.all(promises);
        
        return results.flat();
    });

    // Save game config value
    ipcMain.handle('save-game-config', async (event, filePath, key, value) => {
        return await ConfigParser.saveConfigValue(filePath, key, value);
    });
    
    // Get app version
    ipcMain.handle('get-app-version', () => app.getVersion());
    
    // Select path dialog
    ipcMain.handle('select-path', async (event, type) => {
        let properties = type === 'dir' ? ['openDirectory'] : ['openFile'];
        let title = type === 'dir' ? 'Выберите папку' : 'Выберите файл';
        let filters = [];

        if (type === 'java') {
            title = 'Выберите javaw.exe или папку с Java';
            filters = process.platform === 'win32' ? [
                { name: 'Исполняемый файл Java (javaw.exe, java.exe)', extensions: ['exe'] },
                { name: 'Все файлы (*.*)', extensions: ['*'] }
            ] : [
                { name: 'Исполняемый файл Java (javaw, java)', extensions: ['*'] }
            ];
        }

        const options = { title, properties };
        if (filters.length > 0) options.filters = filters;

        const result = await dialog.showOpenDialog(mainWindow, options);
        if (!result.canceled && result.filePaths.length > 0) {
            let selectedPath = result.filePaths[0];
            if (type === 'java') {
                selectedPath = resolveJavaPath(selectedPath);
            }
            return selectedPath;
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

    // Modrinth Hash Resolver
    ipcMain.handle('resolve-modrinth', async (event, hashes) => {
        try {
            const { resolveModrinthUrls } = require('../../modules/updater/modrinth');
            return await resolveModrinthUrls(hashes);
        } catch (e) {
            console.error('IPC resolve-modrinth error:', e);
            return {};
        }
    });

}

module.exports = {
    registerConfigHandlers,
};
