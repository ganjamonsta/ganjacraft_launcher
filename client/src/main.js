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
const MC_VERSION = '1.20.1';
// Use our domain as a stable download endpoint (Nginx proxies to official Forge Maven).
const FORGE_INSTALLER_URL = `https://ganjacraft.ru/files/forge-${FORGE_VERSION}-installer.jar`;
const MANIFEST_URL = 'https://ganjacraft.ru/files/manifest.json';
const AUTHLIB_INJECTOR_URL = 'https://ganjacraft.ru/files/authlib-injector.jar';
const YGGDRASIL_AUTH_URL = 'https://ganjacraft.ru/api/yggdrasil/authserver/authenticate';

// Reduce dependency on external networks by routing Mojang/Maven/Forge downloads via our domain.
// Server-side: Nginx should proxy /mirror/* to upstreams.
const MIRROR_BASE = 'https://ganjacraft.ru/mirror';
const VANILLA_VERSION_JSON_URL = `https://ganjacraft.ru/files/versions/${MC_VERSION}/${MC_VERSION}.json`;
const VANILLA_VERSION_JAR_URL = `https://ganjacraft.ru/files/versions/${MC_VERSION}/${MC_VERSION}.jar`;

function rewriteKnownUrl(url) {
    if (!url || typeof url !== 'string') return url;

    const rewrites = [
        ['https://libraries.minecraft.net/', `${MIRROR_BASE}/libraries/`],
        ['https://resources.download.minecraft.net/', `${MIRROR_BASE}/resources/`],
        ['https://piston-meta.mojang.com/', `${MIRROR_BASE}/piston-meta/`],
        ['https://piston-data.mojang.com/', `${MIRROR_BASE}/piston-data/`],
        ['https://launcher.mojang.com/', `${MIRROR_BASE}/launcher/`],
        ['https://launchermeta.mojang.com/', `${MIRROR_BASE}/launchermeta/`],
        ['https://files.minecraftforge.net/maven/', `${MIRROR_BASE}/forge-maven/`],
        ['https://maven.minecraftforge.net/', `${MIRROR_BASE}/forge-maven/`],
        ['https://repo1.maven.org/maven2/', `${MIRROR_BASE}/maven-central/`],
    ];

    for (const [from, to] of rewrites) {
        if (url.startsWith(from)) return to + url.slice(from.length);
    }
    return url;
}

function rewriteVersionJsonUrls(versionJson) {
    if (!versionJson || typeof versionJson !== 'object') return versionJson;

    // Top-level downloads
    if (versionJson.downloads) {
        if (versionJson.downloads.client?.url) versionJson.downloads.client.url = rewriteKnownUrl(versionJson.downloads.client.url);
        if (versionJson.downloads.server?.url) versionJson.downloads.server.url = rewriteKnownUrl(versionJson.downloads.server.url);
    }

    // Asset index
    if (versionJson.assetIndex?.url) {
        versionJson.assetIndex.url = rewriteKnownUrl(versionJson.assetIndex.url);
    }

    // Libraries
    if (Array.isArray(versionJson.libraries)) {
        for (const lib of versionJson.libraries) {
            if (lib?.downloads?.artifact?.url) {
                lib.downloads.artifact.url = rewriteKnownUrl(lib.downloads.artifact.url);
            }
            if (lib?.downloads?.classifiers) {
                for (const key of Object.keys(lib.downloads.classifiers)) {
                    const item = lib.downloads.classifiers[key];
                    if (item?.url) item.url = rewriteKnownUrl(item.url);
                }
            }
        }
    }

    return versionJson;
}

async function ensureVanillaVersionFiles(rootPath, sendLog) {
    const versionDir = path.join(rootPath, 'versions', MC_VERSION);
    const versionJsonPath = path.join(versionDir, `${MC_VERSION}.json`);
    const versionJarPath = path.join(versionDir, `${MC_VERSION}.jar`);

    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });

    // Ensure version JSON exists and is usable.
    let versionJsonOk = false;
    if (fs.existsSync(versionJsonPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
            if (parsed && parsed.id) versionJsonOk = true;
        } catch {
            versionJsonOk = false;
        }
    }

    if (!versionJsonOk) {
        sendLog(`Скачивание версии Minecraft ${MC_VERSION} (json)...`);
        const tmpJson = `${versionJsonPath}.tmp`;
        try {
            await downloadFile(VANILLA_VERSION_JSON_URL, tmpJson, { timeoutMs: 60_000 });
            const parsed = JSON.parse(fs.readFileSync(tmpJson, 'utf8'));
            rewriteVersionJsonUrls(parsed);
            fs.writeFileSync(versionJsonPath, JSON.stringify(parsed, null, 2), 'utf8');
            try { fs.unlinkSync(tmpJson); } catch {}
            sendLog(`Версия ${MC_VERSION} (json) готова.`);
        } catch (e) {
            try { if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson); } catch {}
            throw new Error(`Не удалось подготовить ${MC_VERSION}.json: ${e.message}`);
        }
    } else {
        // Rewrite in-place to ensure new mirror rules apply after updates.
        try {
            const parsed = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
            rewriteVersionJsonUrls(parsed);
            fs.writeFileSync(versionJsonPath, JSON.stringify(parsed, null, 2), 'utf8');
        } catch {
            // Ignore; will be handled on next run.
        }
    }

    // Ensure client jar exists.
    let needJar = !fs.existsSync(versionJarPath);
    if (!needJar && !isZipIntact(versionJarPath)) {
        sendLog(`Обнаружен поврежденный ${MC_VERSION}.jar. Перекачивание...`);
        try { fs.unlinkSync(versionJarPath); } catch {}
        needJar = true;
    }

    if (needJar) {
        sendLog(`Скачивание версии Minecraft ${MC_VERSION} (jar)...`);
        await downloadFile(VANILLA_VERSION_JAR_URL, versionJarPath, { timeoutMs: 180_000 });
        if (!isZipIntact(versionJarPath)) {
            try { fs.unlinkSync(versionJarPath); } catch {}
            throw new Error(`Скачанный ${MC_VERSION}.jar поврежден (невалидный JAR/ZIP)`);
        }
        sendLog(`Версия ${MC_VERSION} (jar) скачана.`);
    }
}

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

function cleanZeroByteFiles(dir) {
    if (!fs.existsSync(dir)) return;
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                cleanZeroByteFiles(filePath);
            } else if (stats.isFile()) {
                let shouldDelete = false;
                if (stats.size === 0) {
                    shouldDelete = true;
                } else if (file.endsWith('.jar') || file.endsWith('.zip')) {
                    try {
                        const fd = fs.openSync(filePath, 'r');
                        
                        // 1. Check Header (PK..)
                        const headerBuffer = Buffer.alloc(4);
                        fs.readSync(fd, headerBuffer, 0, 4, 0);
                        if (headerBuffer.toString('hex') !== '504b0304') {
                            console.log(`[CLEANUP] Invalid zip header for ${filePath}: ${headerBuffer.toString('hex')}`);
                            shouldDelete = true;
                        }

                        // 2. Check Footer (EOCD) - Heuristic: Scan last 4KB
                        if (!shouldDelete && stats.size > 22) {
                            const scanSize = Math.min(stats.size, 4096);
                            const footerBuffer = Buffer.alloc(scanSize);
                            fs.readSync(fd, footerBuffer, 0, scanSize, stats.size - scanSize);
                            
                            // EOCD signature: 50 4B 05 06
                            if (!footerBuffer.includes(Buffer.from([0x50, 0x4B, 0x05, 0x06]))) {
                                console.log(`[CLEANUP] Missing EOCD signature (truncated?) for ${filePath}`);
                                shouldDelete = true;
                            }
                        }
                        
                        fs.closeSync(fd);
                    } catch (err) {
                        console.error(`[CLEANUP] Error checking file ${filePath}:`, err);
                        shouldDelete = true; // If we can't read it, it's probably bad
                    }
                }

                if (shouldDelete) {
                    console.log(`[CLEANUP] Deleting corrupted file: ${filePath}`);
                    try {
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    } catch (e) {
                        console.error(`[CLEANUP] Failed to delete ${filePath}:`, e);
                    }
                }
            }
        }
    } catch (e) {
        console.error(`[CLEANUP] Error scanning ${dir}:`, e);
    }
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
    // First Run / Setup Wizard
    let config = loadConfig();
    
    // If it's a fresh install (isDefault is true) or we want to force a check
    if (config.isDefault) {
        const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Выбрать папку установки (Рекомендуется)', 'По умолчанию (%AppData%)'],
            defaultId: 0,
            cancelId: 1,
            title: 'Настройка установки GanjaCraft',
            message: 'Выберите место для установки игры.',
            detail: 'Windows часто блокирует файлы в папке AppData. \nДля избежания ошибок "EPERM" и проблем с антивирусом, выберите папку на диске, например C:\\Games\\GanjaCraft.'
        });

        if (response === 0) {
            const result = await dialog.showOpenDialog({
                title: 'Выберите папку для установки GanjaCraft',
                defaultPath: 'C:\\Games',
                properties: ['openDirectory', 'createDirectory']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                // Use the selected path
                // We append nothing, we trust the user selected the folder they want to use as root
                config.installPath = result.filePaths[0];
                config.isDefault = false;
                saveConfig(config);
            } else {
                // User canceled dialog, fallback to default but mark as configured
                config.isDefault = false;
                saveConfig(config);
            }
        } else {
            // User chose default
            config.isDefault = false;
            saveConfig(config);
        }
    }

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
    // Use a WriteStream for non-blocking logging
    const logStream = fs.createWriteStream(logFile, { flags: 'w' });
    logStream.write(`--- Log started at ${new Date().toISOString()} ---\n`);

    const sendLog = (msg) => {
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('log-message', msg);
        }
        // Write to stream asynchronously
        if (logStream && !logStream.destroyed) {
            logStream.write(`[${new Date().toISOString()}] ${msg}\n`);
        }
    };

    sendLog('Запуск с конфигурацией: ' + JSON.stringify(config));

    // Preload vanilla version files locally so MCLC won't hit external Mojang endpoints directly.
    try {
        await ensureVanillaVersionFiles(rootPath, sendLog);
    } catch (e) {
        isGameRunning = false;
        return { success: false, error: e.message };
    }

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
    let needForge = !fs.existsSync(forgeInstallerPath);
    
    if (!needForge) {
        const size = fs.statSync(forgeInstallerPath).size;
        if (size === 0 || !isZipIntact(forgeInstallerPath)) {
            sendLog('Обнаружен поврежденный установщик Forge (битый/не ZIP). Перекачивание...');
            try { fs.unlinkSync(forgeInstallerPath); } catch {}
            needForge = true;
        }
    }

    if (needForge) {
        sendLog('Скачивание установщика Forge...');
        try {
            await downloadFile(FORGE_INSTALLER_URL, forgeInstallerPath, { timeoutMs: 120_000 });
            if (!isZipIntact(forgeInstallerPath)) {
                try { fs.unlinkSync(forgeInstallerPath); } catch {}
                throw new Error('Downloaded Forge installer is not a valid JAR/ZIP (truncated or HTML response)');
            }
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
    if (!fs.existsSync(authlibPath) || !isZipIntact(authlibPath)) {
        sendLog('Скачивание Authlib Injector...');
        try {
            await downloadFile(AUTHLIB_INJECTOR_URL, authlibPath, { timeoutMs: 60_000 });
            if (!isZipIntact(authlibPath)) {
                try { fs.unlinkSync(authlibPath); } catch {}
                throw new Error('Downloaded authlib-injector is not a valid JAR/ZIP');
            }
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
        timeout: 180_000,
        version: {
            number: MC_VERSION, // Версия майнкрафта
            type: "release"
        },
        forge: forgeInstallerPath, // Путь к инсталлеру Forge
        memory: {
            max: config.memoryMax,
            min: config.memoryMin
        },
        javaPath: javaPath || undefined, // Use detected/downloaded java if available
        overrides: {
            // Use our mirrored endpoints. These are mainly used by Forge wrapper and some legacy paths,
            // but we also rewrite URLs inside the version json (see ensureVanillaVersionFiles).
            url: {
                meta: `${MIRROR_BASE}/launchermeta`,
                resource: `${MIRROR_BASE}/resources`,
                mavenForge: `${MIRROR_BASE}/forge-maven/`,
                defaultRepoForge: `${MIRROR_BASE}/libraries/`,
                fallbackMaven: `${MIRROR_BASE}/maven-fallback?filepath=`,
            },
            maxSockets: 4,
        },
        customArgs: [
            `-javaagent:${authlibPath}=https://ganjacraft.ru/api/yggdrasil`,
            // Optimization Flags
            '-XX:+UseG1GC',
            '-XX:+ParallelRefProcEnabled',
            '-XX:MaxGCPauseMillis=200',
            '-XX:+UnlockExperimentalVMOptions',
            '-XX:+DisableExplicitGC',
            '-XX:+AlwaysPreTouch',
            '-XX:G1NewSizePercent=30',
            '-XX:G1MaxNewSizePercent=40',
            '-XX:G1HeapRegionSize=8M',
            '-XX:G1ReservePercent=20',
            '-XX:G1HeapWastePercent=5',
            '-XX:G1MixedGCCountTarget=4',
            '-XX:InitiatingHeapOccupancyPercent=15',
            '-XX:G1MixedGCLiveThresholdPercent=90',
            '-XX:G1RSetUpdatingPauseTimePercent=5',
            '-XX:SurvivorRatio=32',
            '-XX:+PerfDisableSharedMem',
            '-XX:MaxTenuringThreshold=1'
        ]
    };

    // Cleanup empty files before launch to prevent ZipException
    sendLog('Проверка целостности библиотек...');
    cleanZeroByteFiles(path.join(rootPath, 'libraries'));
    cleanZeroByteFiles(path.join(rootPath, 'versions'));

    sendLog('Запуск ядра Minecraft...');
    
    // Get window instance to restore it later
    const mainWindow = BrowserWindow.fromWebContents(event.sender);

    // Listen for game close event
    // We use 'once' to avoid stacking listeners if multiple launches happen in one session
    launcher.once('close', (code) => {
        isGameRunning = false;
        sendLog(`[LAUNCHER] Игра закрылась с кодом ${code}`);
        
        // Close log stream
        if (logStream) logStream.end();

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
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('log-message', `[PROGRESS] ${e.type} - ${e.task} (${e.total})`);
                // Forward progress to renderer for the UI bar
                mainWindow.webContents.send('progress', { task: e.task, total: e.total, type: e.type });
            }
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
