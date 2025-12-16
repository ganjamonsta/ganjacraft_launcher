const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { Client } = require('minecraft-launcher-core');
const { autoUpdater } = require('electron-updater');

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

// Configure Auto Updater
// autoUpdater.autoDownload = false;
// autoUpdater.logger = require("electron-log");
// autoUpdater.logger.transports.file.level = "info";

const crypto = require('crypto');

// Custom Portable Updater
const VERSION_URL = 'https://ganjacraft.ru/api/launcher/files/version.json';
// PUBLIC KEY (Hardcoded for security) - Replace with content of public.pem
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAQv9ZFfputwoW/JzVhRwLIiUy3/3Mgaj0aDrz+t5y2+s=
-----END PUBLIC KEY-----`;

let updateInfo = null;

async function checkForPortableUpdates(win) {
    if (!app.isPackaged) return;

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(VERSION_URL);
        if (!response.ok) throw new Error('Failed to fetch version info');
        
        const remoteData = await response.json();
        const currentVersion = app.getVersion();
        
        // Simple version compare (assumes semver)
        if (remoteData.version !== currentVersion) {
            // Check if remote is actually newer
            const v1 = currentVersion.split('.').map(Number);
            const v2 = remoteData.version.split('.').map(Number);
            
            let isNewer = false;
            for (let i = 0; i < 3; i++) {
                if (v2[i] > v1[i]) { isNewer = true; break; }
                if (v2[i] < v1[i]) { break; }
            }

            if (isNewer) {
                updateInfo = remoteData;
                win.webContents.send('update-available', { version: remoteData.version });
            } else {
                win.webContents.send('update-not-available');
            }
        } else {
            win.webContents.send('update-not-available');
        }
    } catch (e) {
        console.error('Update check failed:', e);
        win.webContents.send('update-error', e.message);
    }
}

async function downloadPortableUpdate(win) {
    if (!updateInfo) return;
    
    const dest = path.join(path.dirname(process.execPath), 'update.tmp.exe');
    const file = fs.createWriteStream(dest);
    
    win.webContents.send('update-progress', { percent: 0 });

    https.get(updateInfo.url, (response) => {
        const total = parseInt(response.headers['content-length'], 10);
        let current = 0;

        response.on('data', (chunk) => {
            current += chunk.length;
            const percent = (current / total) * 100;
            win.webContents.send('update-progress', { percent });
            file.write(chunk);
        });

        response.on('end', () => {
            file.end();
            
            // Verify Signature
            if (updateInfo.signature) {
                try {
                    const fileBuffer = fs.readFileSync(dest);
                    const isVerified = crypto.verify(
                        null,
                        fileBuffer,
                        PUBLIC_KEY,
                        Buffer.from(updateInfo.signature, 'base64')
                    );
                    
                    if (!isVerified) {
                        throw new Error("Invalid signature! Update file might be corrupted or tampered.");
                    }
                    console.log("✅ Update signature verified.");
                    win.webContents.send('update-downloaded', updateInfo);
                } catch (e) {
                    console.error("Signature verification failed:", e);
                    fs.unlink(dest, () => {});
                    win.webContents.send('update-error', "Security Error: " + e.message);
                }
            } else {
                console.warn("⚠️ Update has no signature!");
                // For now, allow it but log warning. In production, block it.
                win.webContents.send('update-downloaded', updateInfo);
            }
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => {});
        win.webContents.send('update-error', err.message);
    });
}

function installPortableUpdate() {
    const currentExe = process.execPath;
    const currentDir = path.dirname(currentExe);
    const updateExe = path.join(currentDir, 'update.tmp.exe');
    const batPath = path.join(currentDir, 'update.bat');
    const vbsPath = path.join(currentDir, 'update.vbs');
    const exeName = path.basename(currentExe);

    // Batch script to replace file and restart
    // Loop ensures we wait until the main process is fully released
    const batContent = `
@echo off
:loop
del "${exeName}" >nul 2>&1
if exist "${exeName}" (
    timeout /t 1 /nobreak >nul
    goto loop
)
move "update.tmp.exe" "${exeName}" >nul
start "" "${exeName}"
del "update.vbs"
del "%~f0"
    `;

    // VBScript to run batch file hidden
    const vbsContent = `
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "${batPath}" & chr(34), 0
Set WshShell = Nothing
    `;

    fs.writeFileSync(batPath, batContent);
    fs.writeFileSync(vbsPath, vbsContent);

    // Spawn wscript to run vbs (which runs bat hidden)
    spawn('wscript.exe', [vbsPath], {
        detached: true,
        stdio: 'ignore'
    }).unref();

    app.quit();
}

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

    // Config Handlers
    ipcMain.handle('load-config', () => loadConfig());
    ipcMain.handle('save-config', (event, config) => saveConfig(config));
    ipcMain.handle('get-app-version', () => app.getVersion());
    
    // Auto Updater Events (Custom Portable)
    ipcMain.handle('check-for-updates', () => {
        checkForPortableUpdates(win);
    });

    ipcMain.handle('download-update', () => {
        downloadPortableUpdate(win);
    });

    ipcMain.handle('quit-and-install', () => {
        installPortableUpdate();
    });

    // Check for updates on startup (delayed to reduce startup load)
    if (app.isPackaged) {
        setTimeout(() => {
            checkForPortableUpdates(win);
        }, 3000);
    }

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
