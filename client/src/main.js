const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Build trigger
// Override userData path to keep everything in .ganjacraft
const appDataPath = app.getPath('appData');
const customUserDataPath = path.join(appDataPath, '.ganjacraft', 'launcher-data');
if (!fs.existsSync(customUserDataPath)) {
    fs.mkdirSync(customUserDataPath, { recursive: true });
}
app.setPath('userData', customUserDataPath);

const https = require('https');
const { spawn } = require('child_process');
const { Client } = require('minecraft-launcher-core');

// Modules
const { loadConfig, saveConfig } = require('./modules/config');
const { syncFiles, downloadFile } = require('./modules/updater');
const { authenticateYggdrasil } = require('./modules/auth');
const { checkAndDownloadJava } = require('./modules/java');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            const win = windows[0];
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });
}

const launcher = new Client();
let isGameRunning = false;
let isLaunchCancelled = false;
const FORGE_VERSION = '1.20.1-47.4.0';
const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${FORGE_VERSION}/forge-${FORGE_VERSION}-installer.jar`;
const MANIFEST_URL = 'https://ganjacraft.ru/files/manifest.json';
const AUTHLIB_INJECTOR_URL = 'https://ganjacraft.ru/files/authlib-injector.jar';
const YGGDRASIL_AUTH_URL = 'https://ganjacraft.ru/api/yggdrasil/authserver/authenticate';

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        resizable: false,
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

    // Context Menu
    ipcMain.on('show-context-menu', (event) => {
        const template = [
            {
                label: 'Копировать',
                role: 'copy',
            }
        ];
        const menu = Menu.buildFromTemplate(template);
        menu.popup(BrowserWindow.fromWebContents(event.sender));
    });

    // Config Handlers
    ipcMain.handle('load-config', () => loadConfig());
    ipcMain.handle('save-config', (event, config) => saveConfig(config));
    ipcMain.handle('get-app-version', () => app.getVersion());
    
    ipcMain.handle('select-path', async (event, type) => {
        const properties = type === 'file' ? ['openFile'] : ['openDirectory'];
        const result = await dialog.showOpenDialog(win, { properties });
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });

    ipcMain.handle('open-folder', async (event, folderPath) => {
        if (folderPath && fs.existsSync(folderPath)) {
            await shell.openPath(folderPath);
            return true;
        }
        return false;
    });

    ipcMain.handle('open-url', async (event, url) => {
        await shell.openExternal(url);
    });

    ipcMain.handle('get-manifest', async () => {
        // Fetch manifest directly to return to UI
        return new Promise((resolve) => {
            const req = https.get(MANIFEST_URL, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch { resolve(null); }
                });
            });
            
            req.on('error', () => resolve(null));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve(null);
            });
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
ipcMain.handle('cancel-launch', () => {
    if (isGameRunning) {
        isLaunchCancelled = true;
        isGameRunning = false;
        return true;
    }
    return false;
});

ipcMain.handle('launch-game', async (event, options) => {
    if (isGameRunning) {
        return { success: false, error: "Игра уже запущена!" };
    }
    isGameRunning = true;
    isLaunchCancelled = false;

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

    sendLog('Запуск с конфигурацией: ' + JSON.stringify(config));

    // Validate Java Path if set
    let javaPath = config.javaPath;
    if (javaPath) {
        if (!fs.existsSync(javaPath)) {
            isGameRunning = false;
            sendLog(`[ОШИБКА] Указанный путь к Java не существует: ${javaPath}`);
            return { success: false, error: "Неверный путь к Java. Проверьте настройки." };
        }
    } else {
        // Auto-download Java if not set
        try {
            const downloadedJava = await checkAndDownloadJava(rootPath, sendLog);
            if (downloadedJava) {
                javaPath = downloadedJava;
            }
        } catch (e) {
            console.error('Java download failed:', e);
            isGameRunning = false;
            return { success: false, error: "Ошибка загрузки Java: " + e.message };
        }
    }

    // Проверяем и качаем Forge
    const forgeInstallerPath = path.join(rootPath, `forge-${FORGE_VERSION}-installer.jar`);
    if (!fs.existsSync(forgeInstallerPath)) {
        sendLog('Скачивание установщика Forge...');
        try {
            await downloadFile(FORGE_INSTALLER_URL, forgeInstallerPath);
            sendLog('Установщик Forge скачан.');
        } catch (e) {
            console.error('Failed to download Forge:', e);
            isGameRunning = false;
            return { success: false, error: "Не удалось скачать Forge: " + e.message };
        }
    } else {
        sendLog('Установщик Forge найден.');
    }

    // Check and download authlib-injector
    const authlibPath = path.join(rootPath, 'authlib-injector.jar');
    if (!fs.existsSync(authlibPath)) {
        sendLog('Скачивание Authlib Injector...');
        try {
            await downloadFile(AUTHLIB_INJECTOR_URL, authlibPath);
            sendLog('Authlib Injector скачан.');
        } catch (e) {
            console.error('Failed to download Authlib Injector:', e);
            isGameRunning = false;
            return { success: false, error: "Не удалось скачать Authlib Injector: " + e.message };
        }
    }

    // Синхронизация модов
    try {
        const onSyncProgress = (p) => {
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('progress', p);
            }
        };
        await syncFiles(rootPath, MANIFEST_URL, sendLog, onSyncProgress, config.disabledMods, () => isLaunchCancelled);
    } catch (e) {
        if (e.message === 'CANCELLED') {
            sendLog('Запуск отменен пользователем.');
            isGameRunning = false;
            return { success: false, error: "Запуск отменен" };
        }
        sendLog('ВНИМАНИЕ: Ошибка синхронизации модов. Игра может работать нестабильно.');
        console.error(e);
    }

    if (isLaunchCancelled) {
        isGameRunning = false;
        return { success: false, error: "Запуск отменен" };
    }

    // Yggdrasil Authentication
    sendLog('Авторизация в GanjaCraft Yggdrasil...');
    let authSession;
    try {
        authSession = await authenticateYggdrasil(YGGDRASIL_AUTH_URL, options.username, options.token);
        sendLog(`Авторизация успешна. UUID: ${authSession.uuid}`);
    } catch (e) {
        console.error('Authentication failed:', e);
        isGameRunning = false;
        return { success: false, error: "Ошибка авторизации: " + e.message };
    }

    const opts = {
        clientPackage: null, // null = ванильная версия, или url к zip
        authorization: {
            access_token: authSession.accessToken,
            client_token: authSession.clientToken,
            uuid: authSession.uuid,
            name: authSession.name,
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

    sendLog('Запуск ядра Minecraft...');
    
    // Get window instance to restore it later
    const mainWindow = BrowserWindow.fromWebContents(event.sender);

    // Listen for game close event
    // We use 'once' to avoid stacking listeners if multiple launches happen in one session
    launcher.once('close', (code) => {
        isGameRunning = false;
        sendLog(`[LAUNCHER] Игра закрылась с кодом ${code}`);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            // Restore window if it was minimized or hidden
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
            
            // Notify renderer to reset UI state
            mainWindow.webContents.send('game-closed');
        }
    });
    
    return new Promise((resolve, reject) => {
        let hasResolved = false;

        const onArguments = (e) => {
            if (!hasResolved) {
                hasResolved = true;
                sendLog('[LAUNCHER] Процесс игры запускается...');
                resolve({ success: true });
            }
        };

        // Listen for arguments event (emitted just before spawn)
        launcher.once('arguments', onArguments);
        // Also listen for data (stdout) just in case arguments is missed or behavior changes
        launcher.once('data', onArguments);

        launcher.on('debug', (e) => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('log-message', `[DEBUG] ${e}`);
        });
        launcher.on('data', (e) => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('log-message', `[GAME] ${e}`);
        });
        launcher.on('progress', (e) => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('log-message', `[PROGRESS] ${e.type} - ${e.task} (${e.total})`);
        });
        
        launcher.launch(opts).then(() => {
            if (!hasResolved) {
                hasResolved = true;
                resolve({ success: true });
            }
        }).catch(error => {
            if (!hasResolved) {
                hasResolved = true;
                console.error(error);
                isGameRunning = false;
                resolve({ success: false, error: error.message });
            } else {
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('log-message', `[ОШИБКА] Игра вылетела: ${error.message}`);
            }
        });
    });
});
