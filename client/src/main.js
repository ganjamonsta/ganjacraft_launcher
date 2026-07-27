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
const { checkAndDownloadJava, getJavaVersionInfo, REQUIRED_JAVA_MAJOR } = require('./modules/java');

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
const {
    FORGE_VERSION,
    MC_VERSION,
    MANIFEST_URL,
    FORGE_INSTALLER_URL,
    AUTHLIB_INJECTOR_URL,
    YGGDRASIL_AUTH_URL,
    VANILLA_VERSION_JSON_URL,
    VANILLA_VERSION_JAR_URL,
    REPAIR_FILES,
    URL_REWRITES,
    DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS,
    JVM_OPTIMIZATION_ARGS,
    FILES_BASE,
    MIRROR_BASE,
} = require('./main-process/constants');


function computeDefaultDisabledModsFromManifest(manifest) {
    try {
        if (!manifest || !Array.isArray(manifest.files)) return [];
        return manifest.files
            .filter(f => f && f.optional && typeof f.path === 'string' && f.path.startsWith('mods/') && f.path.endsWith('.jar'))
            .filter(f => {
                const fileName = f.path.split('/').pop();
                return DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS.some(p => fileName.includes(p));
            })
            .map(f => f.path);
    } catch {
        return [];
    }
}



function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function repairCriticalFiles(rootPath, sendLog, sendDebug) {
    // Comprehensive repair: check all critical game files and re-download if corrupt.
    // This prevents NoClassDefFoundError, "invalid JAR", and other integrity issues.
    
    const criticalChecks = [
        {
            name: 'Authlib Injector',
            path: path.join(rootPath, 'authlib-injector.jar'),
            url: REPAIR_FILES['authlib-injector.jar'],
        },
        {
            name: 'Forge Installer',
            path: path.join(rootPath, `forge-${FORGE_VERSION}-installer.jar`),
            url: REPAIR_FILES['forge-installer.jar'],
        },
        {
            name: 'ModLauncher (Forge)',
            path: path.join(rootPath, 'libraries', 'cpw', 'mods', 'modlauncher', '10.0.9', 'modlauncher-10.0.9.jar'),
            url: REPAIR_FILES['modlauncher.jar'],
        },
        {
            name: 'SecureJarHandler (Forge)',
            path: path.join(rootPath, 'libraries', 'cpw', 'mods', 'securejarhandler', '2.1.10', 'securejarhandler-2.1.10.jar'),
            url: REPAIR_FILES['securejarhandler.jar'],
        },
        {
            name: `Minecraft ${MC_VERSION}`,
            path: path.join(rootPath, 'versions', MC_VERSION, `${MC_VERSION}.jar`),
            url: REPAIR_FILES['vanilla-client.jar'],
        },
    ];

    for (const file of criticalChecks) {
        const isOk = fs.existsSync(file.path) && isZipIntact(file.path);
        
        if (!isOk) {
            sendLog(`⚠️ Восстанавливаю ${file.name}...`);
            sendDebug(`Repair: ${file.name} missing or corrupt, downloading from ${file.url}`);
            
            try {
                // Ensure dir exists
                const dir = path.dirname(file.path);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                
                // Delete old corrupt file if it exists
                try { fs.unlinkSync(file.path); } catch {}
                
                // Download with timeout
                await downloadFile(file.url, file.path, { timeoutMs: 120_000 });
                
                // Verify integrity
                if (!isZipIntact(file.path)) {
                    try { fs.unlinkSync(file.path); } catch {}
                    throw new Error(`Downloaded file is not a valid JAR/ZIP (truncated or corrupted)`);
                }
                
                sendLog(`✓ ${file.name} восстановлен`);
                sendDebug(`Repair: ${file.name} OK`);
            } catch (e) {
                sendDebug(`Repair failed for ${file.name}: ${e.message}`);
                throw new Error(
                    `Не удалось восстановить ${file.name}.\n` +
                    `Ошибка: ${e.message}\n\n` +
                    `Проверьте подключение к интернету и попробуйте снова.`
                );
            }
        } else {
            sendDebug(`Repair: ${file.name} OK (integrity verified)`);
        }
    }
}

async function assertDirectoryWritable(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    const testName = `.write-test-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
    const testPath = path.join(dirPath, testName);
    // If Windows Defender / CFA blocks the folder, openSync('w') tends to throw EPERM.
    const fd = fs.openSync(testPath, 'w');
    fs.closeSync(fd);
    try { fs.unlinkSync(testPath); } catch {}
}

async function ensureWritableFilePath(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

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

async function preflightForgeLibraries(rootPath, sendLog, sendDebug) {
    // Check critical Forge bootstrap libs for integrity. If they're corrupt/missing, delete so MCLC can re-download.
    const librariesDir = path.join(rootPath, 'libraries');
    
    // These versions correspond to FORGE_VERSION 1.20.1-47.4.0.
    const criticalLibs = [
        path.join(librariesDir, 'cpw', 'mods', 'modlauncher', '10.0.9', 'modlauncher-10.0.9.jar'),
        path.join(librariesDir, 'cpw', 'mods', 'securejarhandler', '2.1.10', 'securejarhandler-2.1.10.jar'),
    ];

    for (const libPath of criticalLibs) {
        const libName = path.basename(libPath);
        const libDir = path.dirname(libPath);

        // If file doesn't exist, MCLC will download it.
        if (!fs.existsSync(libPath)) {
            sendDebug(`Preflight: ${libName} does not exist, MCLC will download it.`);
            continue;
        }

        // Check if file is a valid ZIP/JAR
        const isValid = isZipIntact(libPath);
        if (!isValid) {
            sendDebug(`Preflight: ${libName} is corrupt (invalid ZIP), deleting for re-download...`);
            sendLog(`Обнаружен повреждённый файл ${libName}, удаляю для переcкачивания...`);
            try {
                // Ensure dir exists, clear readonly, delete
                if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
                try { fs.chmodSync(libPath, 0o666); } catch {}
                fs.unlinkSync(libPath);
                sendDebug(`Deleted corrupt ${libName}`);
            } catch (e) {
                // If delete fails, we'll let MCLC try — might still work if file is readable
                sendDebug(`Failed to delete ${libName}: ${e.message}, proceeding anyway`);
            }
        } else {
            sendDebug(`Preflight: ${libName} integrity OK.`);
        }
    }
}

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
        ['https://files.minecraftforge.net/', `${MIRROR_BASE}/forge-files/`],
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
                        throw new Error(`Не удалось удалить поврежденный файл: ${path.basename(filePath)}. Возможно, он занят другим процессом. Перезагрузите ПК.`);
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
        maximizable: false,
        fullscreenable: false,
        frame: false, // Custom title bar
        backgroundColor: '#121212',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('src/index.html');

    // Hard-block maximize/fullscreen (Windows can still attempt this via drag-region double-click).
    win.on('maximize', () => {
        try { win.unmaximize(); } catch (_) {}
    });
    win.on('enter-full-screen', () => {
        try { win.setFullScreen(false); } catch (_) {}
    });

    // Block fullscreen hotkeys (Chromium default).
    win.webContents.on('before-input-event', (event, input) => {
        const key = input && input.key;
        if (key === 'F11' || (input.alt && (key === 'Enter' || key === 'Return'))) {
            event.preventDefault();
        }
    });

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
            const parsedUrl = new URL(MANIFEST_URL);
            const reqOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                timeout: 5000,
                headers: {
                    'User-Agent': 'localtunnel',
                    'Bypass-Tunnel-Reminder': 'true'
                }
            };
            const req = https.request(reqOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch { resolve(null); }
                });
            });
            
            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
            req.end();
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
                // Fresh install: defaults for mod toggles must be applied on first launch.
                config.modsDefaultsApplied = false;
                saveConfig(config);
            } else {
                // User canceled dialog, fallback to default but mark as configured
                config.isDefault = false;
                config.modsDefaultsApplied = false;
                saveConfig(config);
            }
        } else {
            // User chose default
            config.isDefault = false;
            config.modsDefaultsApplied = false;
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
    const debugLogFile = path.join(rootPath, 'debug-launcher.log');
    
    // Use a WriteStream for non-blocking logging
    const logStream = fs.createWriteStream(logFile, { flags: 'w' });
    let debugStream = null;

    if (config.debugMode) {
        debugStream = fs.createWriteStream(debugLogFile, { flags: 'w' });
        debugStream.write(`--- DEBUG LOG STARTED AT ${new Date().toISOString()} ---\n`);
        debugStream.write(`System: ${process.platform} ${process.arch} ${process.release.name}\n`);
        debugStream.write(`Electron: ${process.versions.electron}\n`);
        debugStream.write(`Node: ${process.versions.node}\n`);
        debugStream.write(`Config: ${JSON.stringify(config, null, 2)}\n`);
    }

    logStream.write(`--- Log started at ${new Date().toISOString()} ---\n`);

    const sendLog = (msg) => {
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('log-message', msg);
        }
        // Write to stream asynchronously
        const timestamp = new Date().toISOString();
        if (logStream && !logStream.destroyed) {
            logStream.write(`[${timestamp}] ${msg}\n`);
        }
        if (debugStream && !debugStream.destroyed) {
            debugStream.write(`[${timestamp}] [INFO] ${msg}\n`);
        }
    };

    const sendDebug = (msg) => {
        if (config.debugMode) {
            const timestamp = new Date().toISOString();
            if (debugStream && !debugStream.destroyed) {
                debugStream.write(`[${timestamp}] [DEBUG] ${msg}\n`);
            }
        }
    };

    sendLog('Запуск с конфигурацией: ' + JSON.stringify(config));
    if (config.debugMode) sendLog('РЕЖИМ ОТЛАДКИ ВКЛЮЧЕН. Подробный лог пишется в debug-launcher.log');

    // Apply default mod toggles on fresh installs.
    // This must happen BEFORE syncFiles(), otherwise optional mods will be downloaded/enabled.
    if (config.modsDefaultsApplied !== true) {
        sendLog('[SETUP] Применяю дефолтные настройки модов...');
        try {
            const manifestPath = path.join(rootPath, 'manifest.json');
            await downloadFile(MANIFEST_URL, manifestPath, { timeoutMs: 15_000 });
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            const defaults = computeDefaultDisabledModsFromManifest(manifest);

            const existing = Array.isArray(config.disabledMods) ? config.disabledMods : [];
            const merged = Array.from(new Set([...existing, ...defaults]));
            config.disabledMods = merged;
            config.modsDefaultsApplied = true;
            saveConfig(config);

            if (defaults.length > 0) {
                sendDebug(`Default disabled optional mods: ${JSON.stringify(defaults)}`);
            } else {
                sendDebug('Default disabled optional mods: none matched.');
            }
        } catch (e) {
            // Don't block launch if manifest fetch fails; user can toggle in settings later.
            sendLog('[SETUP] Не удалось применить дефолтные моды (продолжаю запуск).');
            sendDebug(`Default mods apply failed: ${e.stack || e.message}`);
        }
    }

    // Preload vanilla version files locally so MCLC won't hit external Mojang endpoints directly.
    try {
        sendDebug('Starting ensureVanillaVersionFiles...');
        await ensureVanillaVersionFiles(rootPath, sendLog);
        sendDebug('ensureVanillaVersionFiles completed.');
    } catch (e) {
        sendDebug(`ensureVanillaVersionFiles failed: ${e.stack}`);
        isGameRunning = false;
        return { success: false, error: e.message };
    }

    // Validate Java Path if set
    let javaPath = config.javaPath;
    if (javaPath) {
        sendDebug(`Using custom Java path: ${javaPath}`);
        if (!fs.existsSync(javaPath)) {
            isGameRunning = false;
            sendLog(`[ОШИБКА] Указанный путь к Java не существует: ${javaPath}`);
            return { success: false, error: "Неверный путь к Java. Проверьте настройки." };
        }

        // Verify Java version (Forge 1.20.1 requires Java 17+)
        try {
            const info = await getJavaVersionInfo(javaPath);
            if (!info || info.major < REQUIRED_JAVA_MAJOR) {
                isGameRunning = false;
                sendLog(`[ОШИБКА] Java не подходит. Требуется Java ${REQUIRED_JAVA_MAJOR}+. Текущая: ${info?.major || 'неизвестно'}`);
                return {
                    success: false,
                    error:
                        `У вас указана неподходящая Java (нужна Java ${REQUIRED_JAVA_MAJOR}+ для Minecraft ${MC_VERSION}).\n\n` +
                        `Решение:\n` +
                        `1) Откройте настройки лаунчера и очистите поле "Java" (оставьте пустым) — лаунчер сам скачает JRE ${REQUIRED_JAVA_MAJOR}.\n` +
                        `или\n` +
                        `2) Укажите путь к java.exe из Java ${REQUIRED_JAVA_MAJOR}+.\n\n` +
                        `Текущая Java: ${info?.major || 'не удалось определить'}`
                };
            }
            sendDebug(`Custom Java version OK: ${info.major}`);
        } catch (e) {
            isGameRunning = false;
            sendLog(`[ОШИБКА] Не удалось проверить версию Java: ${e.message}`);
            return { success: false, error: `Не удалось проверить версию Java. ${e.message}` };
        }
    } else {
        // Auto-download Java if not set
        try {
            sendDebug('Checking/Downloading Java...');
            const downloadedJava = await checkAndDownloadJava(rootPath, sendLog);
            if (downloadedJava) {
                javaPath = downloadedJava;
                sendDebug(`Java downloaded/found at: ${javaPath}`);
            }
        } catch (e) {
            console.error('Java download failed:', e);
            sendDebug(`Java download failed: ${e.stack}`);
            isGameRunning = false;
            return { success: false, error: "Ошибка загрузки Java: " + e.message };
        }
    }

    // Windows: prefer javaw.exe to avoid opening a console window.
    if (process.platform === 'win32' && javaPath && typeof javaPath === 'string') {
        const lower = javaPath.toLowerCase();
        if (lower.endsWith('java.exe')) {
            const candidate = javaPath.replace(/java\.exe$/i, 'javaw.exe');
            if (fs.existsSync(candidate)) {
                sendDebug(`Using javaw.exe to avoid console: ${candidate}`);
                javaPath = candidate;
            }
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
            sendDebug(`Downloading Forge from ${FORGE_INSTALLER_URL}`);
            await downloadFile(FORGE_INSTALLER_URL, forgeInstallerPath, { timeoutMs: 120_000 });
            if (!isZipIntact(forgeInstallerPath)) {
                try { fs.unlinkSync(forgeInstallerPath); } catch {}
                throw new Error('Downloaded Forge installer is not a valid JAR/ZIP (truncated or HTML response)');
            }
            sendLog('Установщик Forge скачан.');
        } catch (e) {
            console.error('Failed to download Forge:', e);
            sendDebug(`Forge download failed: ${e.stack}`);
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
            sendDebug(`Downloading Authlib from ${AUTHLIB_INJECTOR_URL}`);
            await downloadFile(AUTHLIB_INJECTOR_URL, authlibPath, { timeoutMs: 60_000 });
            if (!isZipIntact(authlibPath)) {
                try { fs.unlinkSync(authlibPath); } catch {}
                throw new Error('Downloaded authlib-injector is not a valid JAR/ZIP');
            }
            sendLog('Authlib Injector скачан.');
        } catch (e) {
            console.error('Failed to download Authlib Injector:', e);
            sendDebug(`Authlib download failed: ${e.stack}`);
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
        sendDebug('Starting syncFiles...');
        await syncFiles(rootPath, MANIFEST_URL, sendLog, onSyncProgress, config.disabledMods, () => isLaunchCancelled);
        sendDebug('syncFiles completed.');

        // Copy custom client configs from client_config/ to config/ if present
        const clientConfigPath = path.join(rootPath, 'client_config');
        if (fs.existsSync(clientConfigPath)) {
            sendLog('Синхронизация клиентских настроек...');
            try {
                fs.cpSync(clientConfigPath, path.join(rootPath, 'config'), { recursive: true, force: true });
                sendDebug('Client configs copied from client_config/ to config/ successfully.');
            } catch (copyErr) {
                sendDebug(`Failed to copy client configs: ${copyErr.message}`);
                sendLog('Предупреждение: Не удалось применить клиентские настройки.');
            }
        }
    } catch (e) {
        if (e.message === 'CANCELLED') {
            sendLog('Запуск отменен пользователем.');
            isGameRunning = false;
            return { success: false, error: "Запуск отменен" };
        }
        sendLog('ВНИМАНИЕ: Ошибка синхронизации модов. Игра может работать нестабильно.');
        sendDebug(`Sync error: ${e.stack}`);
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
        sendDebug(`Authenticating user: ${options.username}`);
        authSession = await authenticateYggdrasil(YGGDRASIL_AUTH_URL, options.username, options.token);
        sendLog(`Авторизация успешна. UUID: ${authSession.uuid}`);
        sendDebug(`Auth success. UUID: ${authSession.uuid}, Name: ${authSession.name}`);
    } catch (e) {
        console.error('Authentication failed:', e);
        sendDebug(`Auth failed: ${e.stack}`);
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
                library: `${MIRROR_BASE}/libraries/`,
                fallbackMaven: `${MIRROR_BASE}/maven-fallback?filepath=`,
            },
            maxSockets: 4,
        },
        customArgs: [
            `-javaagent:${authlibPath}=https://ganjalaunch.share.zrok.io/api/yggdrasil`,
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
    try {
        cleanZeroByteFiles(path.join(rootPath, 'libraries'));
        cleanZeroByteFiles(path.join(rootPath, 'versions'));
    } catch (e) {
        isGameRunning = false;
        return { success: false, error: e.message };
    }

    // Comprehensive repair: verify and restore all critical game files
    try {
        sendDebug('Starting comprehensive repair of critical files...');
        await repairCriticalFiles(rootPath, sendLog, sendDebug);
        sendDebug('Critical files repair completed successfully.');
    } catch (e) {
        sendDebug(`Critical files repair failed: ${e.stack || e.message}`);
        isGameRunning = false;
        return { success: false, error: e.message };
    }

    // Windows-specific preflight: make sure critical Forge libs are writable.
    // If Defender/AV blocks write, MCLC can't download modlauncher/securejarhandler and the game crashes.
    try {
        sendDebug('Preflight: checking Forge library writability...');
        await preflightForgeLibraries(rootPath, sendLog, sendDebug);
        sendDebug('Preflight: Forge library writability OK.');
    } catch (e) {
        sendDebug(`Preflight failed: ${e.stack || e.message}`);
        isGameRunning = false;
        return { success: false, error: e.message };
    }

    sendLog('Запуск ядра Minecraft...');
    sendDebug('Launching MCLC with options: ' + JSON.stringify(opts, null, 2));
    
    // Get window instance to restore it later
    const mainWindow = BrowserWindow.fromWebContents(event.sender);

    // Listen for game close event
    // We use 'once' to avoid stacking listeners if multiple launches happen in one session
    launcher.once('close', (code) => {
        isGameRunning = false;
        sendLog(`[LAUNCHER] Игра закрылась с кодом ${code}`);
        sendDebug(`Game closed with code ${code}`);
        
        // Close log stream
        if (logStream) logStream.end();
        if (debugStream) debugStream.end();

        if (mainWindow && !mainWindow.isDestroyed()) {
            // Restore window if it was minimized or hidden
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
            
            // Notify renderer to reset UI state
            mainWindow.webContents.send('game-closed');
        }
    });
    
    // Capture MCLC debug output
    if (config.debugMode) {
        launcher.on('debug', (e) => sendDebug(`[MCLC] ${e}`));
        launcher.on('data', (e) => sendDebug(`[GAME STDOUT] ${e}`));
        launcher.on('error', (e) => sendDebug(`[GAME STDERR] ${e}`));
    }

    return new Promise((resolve, reject) => {
        let hasResolved = false;

        const onArguments = (e) => {
            if (!hasResolved) {
                hasResolved = true;
                sendLog('[LAUNCHER] Процесс игры запускается...');
                sendDebug('Game process arguments generated.');
                resolve({ success: true });
            }
        };

        // Listen for arguments event (emitted just before spawn)
        launcher.once('arguments', onArguments);
        // Also listen for data (stdout) just in case arguments is missed or behavior changes
        launcher.once('data', onArguments);

        // Standard logging listeners (always active for UI)
        launcher.on('debug', (e) => {
            // Only send to UI if debug mode is on, otherwise it's too spammy
            if (config.debugMode && mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('log-message', `[DEBUG] ${e}`);
            }
        });
        launcher.on('data', (e) => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('log-message', `[GAME] ${e}`);
        });
        launcher.on('progress', (e) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                // Try to get filename from event
                const fileName = e.name || e.file || '';
                const msg = `[PROGRESS] ${e.type} - ${e.task} (${e.total}) ${fileName ? '- ' + fileName : ''}`;
                // Don't spam UI log with progress, just update bar
                // mainWindow.webContents.send('log-message', msg);
                
                // Forward progress to renderer for the UI bar
                mainWindow.webContents.send('progress', { task: e.task, total: e.total, type: e.type });
            }
        });
        
        try {
            launcher.launch(opts).then(() => {
                if (!hasResolved) {
                    hasResolved = true;
                    resolve({ success: true });
                }
            }).catch(error => {
                sendDebug(`Launcher promise rejected: ${error.stack}`);
                if (!hasResolved) {
                    hasResolved = true;
                    console.error(error);
                    isGameRunning = false;
                    const msg = (error && error.message) ? error.message : String(error);
                    const isEperm = msg.includes('EPERM') || error?.code === 'EPERM';
                    const isClassNotFound = msg.includes('NoClassDefFoundError') || msg.includes('modlauncher') || msg.includes('securejarhandler');
                    
                    if (isClassNotFound) {
                        resolve({
                            success: false,
                            error:
                                `Критичные файлы Forge повреждены или не скачались.\n\n` +
                                `Быстрое решение:\n` +
                                `1) Удалите папку: ${rootPath}\\libraries\\cpw\\mods\\\n` +
                                `2) Попробуйте запустить игру ещё раз (лаунчер переcкачает файлы)\n\n` +
                                `Если не сработало:\n` +
                                `3) Скопируйте файлы из рабочей установки GanjaCraft:\n` +
                                `   - modlauncher-10.0.9.jar\n` +
                                `   - securejarhandler-2.1.10.jar\n` +
                                `   в папку: ${rootPath}\\libraries\\cpw\\mods\\\n\n` +
                                `Техническая ошибка: ${msg}`
                        });
                    } else if (isEperm) {
                        resolve({
                            success: false,
                            error:
                                `Windows блокирует запись файлов игры (EPERM).\n\n` +
                                `Быстрое решение:\n` +
                                `1) Закройте лаунчер/игру, перезагрузите ПК\n` +
                                `2) Добавьте папку ${rootPath} в исключения Защитника Windows/антивируса\n\n` +
                                `Если не сработает:\n` +
                                `3) Скопируйте рабочие файлы из другой установки:\n` +
                                `   ${rootPath}\\libraries\\cpw\\mods\\modlauncher\\10.0.9\\modlauncher-10.0.9.jar\n` +
                                `   ${rootPath}\\libraries\\cpw\\mods\\securejarhandler\\2.1.10\\securejarhandler-2.1.10.jar\n\n` +
                                `Техническая ошибка: ${msg}`
                        });
                    } else {
                        resolve({ success: false, error: msg });
                    }
                } else {
                    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('log-message', `[ОШИБКА] Игра вылетела: ${error.message}`);
                }
            });
        } catch (e) {
            sendDebug(`Launcher launch exception: ${e.stack}`);
            reject(e);
        }
    });
});
