const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Client, Authenticator } = require('minecraft-launcher-core');

const launcher = new Client();
const FORGE_VERSION = '1.20.1-47.4.0';
const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${FORGE_VERSION}/forge-${FORGE_VERSION}-installer.jar`;
const MANIFEST_URL = 'https://ganjacraft.ru/files/manifest.json';
const LAUNCHER_VERSION_URL = 'https://ganjacraft.ru/api/launcher/version';
const AUTHLIB_INJECTOR_URL = 'https://ganjacraft.ru/files/authlib-injector.jar';

// Config Management
const CONFIG_FILE = path.join(app.getPath('userData'), 'launcher_config.json');

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    } catch (e) { console.error("Config load error:", e); }
    
    // Defaults
    return {
        installPath: path.join(app.getPath('appData'), '.ganjacraft'),
        javaPath: '', // Empty = auto-detect
        memoryMin: '2G',
        memoryMax: '6G',
        hideOnPlay: true,
        disabledMods: [] // List of paths to skip
    };
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4));
        return true;
    } catch (e) {
        console.error("Config save error:", e);
        return false;
    }
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
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

async function syncFiles(rootPath, sendLog, disabledMods = []) {
    sendLog('Checking for updates...');
    
    // 1. Download Manifest
    const manifestPath = path.join(rootPath, 'manifest.json');
    try {
        await downloadFile(MANIFEST_URL, manifestPath);
    } catch (e) {
        sendLog('Manifest download error: ' + e.message);
        throw e;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    sendLog(`Found ${manifest.files.length} files in manifest.`);

    let downloaded = 0;
    
    for (const file of manifest.files) {
        // Check if disabled
        if (disabledMods.includes(file.path)) {
            // If file exists but is disabled, rename it to .disabled or delete?
            // Let's just delete it to be clean, or skip download.
            const localPath = path.join(rootPath, file.path);
            if (fs.existsSync(localPath)) {
                sendLog(`Removing disabled mod: ${file.path}`);
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
            sendLog(`Downloading: ${file.path} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            try {
                await downloadFile(file.url, localPath);
                downloaded++;
            } catch (e) {
                sendLog(`Download error ${file.path}: ${e.message}`);
            }
        }
    }

    if (downloaded > 0) {
        sendLog(`Update complete. Downloaded: ${downloaded}`);
    } else {
        sendLog('All files up to date.');
    }
}

async function checkForLauncherUpdate() {
    if (!app.isPackaged) return; // Skip in dev

    try {
        const data = await new Promise((resolve, reject) => {
            https.get(LAUNCHER_VERSION_URL, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(res.statusCode));
                    return;
                }
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); }
                    catch (e) { reject(e); }
                });
            }).on('error', reject);
        });

        const currentVersion = app.getVersion();
        // Simple string comparison, ideally use semver
        if (data.version && data.version !== currentVersion) {
            const { response } = await dialog.showMessageBox({
                type: 'info',
                buttons: ['Обновить', 'Позже'],
                title: 'Доступно обновление',
                message: `Доступна новая версия лаунчера: ${data.version}\nТекущая версия: ${currentVersion}`,
                detail: 'Лаунчер будет перезапущен.'
            });

            if (response === 0) { // Update
                const tempPath = path.join(path.dirname(process.execPath), 'launcher_new.exe');
                
                // Show downloading dialog (non-blocking for now, or just blocking)
                // Since we don't have a UI for this yet, we just wait.
                
                await downloadFile(data.url, tempPath);

                // Spawn update script
                // timeout /t 2 gives time for app to close
                const cmd = `timeout /t 2 & move /y "${tempPath}" "${process.execPath}" & "${process.execPath}"`;
                
                spawn('cmd.exe', ['/c', cmd], {
                    detached: true,
                    stdio: 'ignore'
                }).unref();

                app.quit();
            }
        }
    } catch (e) {
        console.error("Update check failed:", e);
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        frame: false, // Custom title bar
        backgroundColor: '#121212',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('src/index.html');

    // Window Control Handlers
    ipcMain.on('window-minimize', () => win.minimize());
    ipcMain.on('window-close', () => win.close());

    // Config Handlers
    ipcMain.handle('load-config', () => loadConfig());
    ipcMain.handle('save-config', (event, config) => saveConfig(config));
    
    ipcMain.handle('select-path', async (event, type) => {
        const properties = type === 'file' ? ['openFile'] : ['openDirectory'];
        const result = await dialog.showOpenDialog(win, { properties });
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });

    ipcMain.handle('get-manifest', async () => {
        // Fetch manifest directly to return to UI
        return new Promise((resolve) => {
            https.get(MANIFEST_URL, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch { resolve(null); }
                });
            }).on('error', () => resolve(null));
        });
    });

    ipcMain.handle('reinstall-client', async () => {
        const config = loadConfig();
        const rootPath = config.installPath;
        // Delete mods, config, libraries
        ['mods', 'config', 'libraries', 'versions'].forEach(dir => {
            const p = path.join(rootPath, dir);
            if (fs.existsSync(p)) {
                fs.rmSync(p, { recursive: true, force: true });
            }
        });
        return true;
    });
}

app.whenReady().then(async () => {
    await checkForLauncherUpdate();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Обработка запуска игры
ipcMain.handle('launch-game', async (event, options) => {
    const config = loadConfig();
    const rootPath = config.installPath;
    
    if (!fs.existsSync(rootPath)) fs.mkdirSync(rootPath, { recursive: true });

    const logFile = path.join(rootPath, 'launcher.log');
    // Очищаем лог при новом запуске
    fs.writeFileSync(logFile, `--- Log started at ${new Date().toISOString()} ---\n`);

    const sendLog = (msg) => {
        event.sender.send('log-message', msg);
        // Пишем в файл
        try {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
        } catch (e) {
            console.error("Failed to write log:", e);
        }
    };

    sendLog('Launching with config: ' + JSON.stringify(config));

    // Проверяем и качаем Forge
    const forgeInstallerPath = path.join(rootPath, `forge-${FORGE_VERSION}-installer.jar`);
    if (!fs.existsSync(forgeInstallerPath)) {
        sendLog('Downloading Forge Installer...');
        try {
            await downloadFile(FORGE_INSTALLER_URL, forgeInstallerPath);
            sendLog('Forge Installer downloaded.');
        } catch (e) {
            console.error('Failed to download Forge:', e);
            return { success: false, error: "Failed to download Forge: " + e.message };
        }
    } else {
        sendLog('Forge Installer found.');
    }

    // Check and download authlib-injector
    const authlibPath = path.join(rootPath, 'authlib-injector.jar');
    if (!fs.existsSync(authlibPath)) {
        sendLog('Downloading Authlib Injector...');
        try {
            await downloadFile(AUTHLIB_INJECTOR_URL, authlibPath);
            sendLog('Authlib Injector downloaded.');
        } catch (e) {
            console.error('Failed to download Authlib Injector:', e);
            return { success: false, error: "Failed to download Authlib Injector: " + e.message };
        }
    }

    // Синхронизация модов
    try {
        await syncFiles(rootPath, sendLog, config.disabledMods);
    } catch (e) {
        sendLog('WARNING: Mod sync failed. Game may be unstable.');
        console.error(e);
    }

    const opts = {
        clientPackage: null, // null = ванильная версия, или url к zip
        authorization: {
            access_token: options.token,
            client_token: crypto.randomUUID(),
            uuid: "00000000-0000-0000-0000-000000000000", // Placeholder, authlib-injector handles the rest
            name: options.username,
            user_properties: "{}"
        },
        root: rootPath,
        version: {
            number: "1.20.1", // Версия майнкрафта
            type: "release"
        },
        forge: forgeInstallerPath, // Путь к инсталлеру Forge
        memory: {
            max: config.memoryMax,
            min: config.memoryMin
        },
        javaPath: config.javaPath || undefined, // Use custom java if set
        customArgs: [
            `-javaagent:${authlibPath}=https://ganjacraft.ru/api/yggdrasil`
        ]
    };

    sendLog('Starting Minecraft Core...');
    
    return new Promise((resolve, reject) => {
        let hasResolved = false;

        const onArguments = (e) => {
            if (!hasResolved) {
                hasResolved = true;
                sendLog('[LAUNCHER] Game process starting...');
                resolve({ success: true });
            }
        };

        // Listen for arguments event (emitted just before spawn)
        launcher.once('arguments', onArguments);
        // Also listen for data (stdout) just in case arguments is missed or behavior changes
        launcher.once('data', onArguments);

        launcher.on('debug', (e) => sendLog(`[DEBUG] ${e}`));
        launcher.on('data', (e) => sendLog(`[GAME] ${e}`));
        launcher.on('progress', (e) => sendLog(`[PROGRESS] ${e.type} - ${e.task} (${e.total})`));
        
        launcher.launch(opts).then(() => {
            if (!hasResolved) {
                hasResolved = true;
                resolve({ success: true });
            }
        }).catch(error => {
            if (!hasResolved) {
                hasResolved = true;
                console.error(error);
                resolve({ success: false, error: error.message });
            } else {
                sendLog(`[ERROR] Game crashed: ${error.message}`);
            }
        });
    });
});
