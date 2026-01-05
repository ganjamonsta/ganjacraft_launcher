/**
 * GanjaCraft Launcher - Game Launcher
 * Основная логика запуска игры
 */

const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const { Client } = require('minecraft-launcher-core');
const { downloadFile, syncFiles } = require('../../modules/updater');
const { authenticateYggdrasil } = require('../../modules/auth');
const { checkAndDownloadJava, getJavaVersionInfo, REQUIRED_JAVA_MAJOR, preferJavaw } = require('../../modules/java');
const { loadConfig, saveConfig } = require('../../modules/config');
const { cleanZeroByteFiles, isZipIntact } = require('./integrity');
const { repairCriticalFiles } = require('./repair');
const { ensureVanillaVersionFiles, preflightForgeLibraries } = require('./forge');
const { 
    FORGE_VERSION,
    MC_VERSION,
    MANIFEST_URL,
    FORGE_INSTALLER_URL,
    AUTHLIB_INJECTOR_URL,
    YGGDRASIL_AUTH_URL,
    MIRROR_BASE,
    DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS,
    JVM_OPTIMIZATION_ARGS,
} = require('../constants');

// Global state
const launcher = new Client();
let isGameRunning = false;
let isLaunchCancelled = false;

/**
 * Проверить, запущена ли игра
 */
function getIsGameRunning() {
    return isGameRunning;
}

/**
 * Отменить запуск
 */
function cancelLaunch() {
    if (isGameRunning) {
        isLaunchCancelled = true;
        isGameRunning = false;
        return true;
    }
    return false;
}

/**
 * Вычислить дефолтные отключённые моды из манифеста
 */
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

/**
 * Создать логгеры для запуска
 */
function createLoggers(event, rootPath, config) {
    const logFile = path.join(rootPath, 'launcher.log');
    const debugLogFile = path.join(rootPath, 'debug-launcher.log');
    
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

    return { logStream, debugStream, sendLog, sendDebug };
}

/**
 * Применить дефолтные настройки модов для свежих установок
 */
async function applyDefaultModSettings(config, rootPath, sendLog, sendDebug) {
    if (config.modsDefaultsApplied === true) return config;
    
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
        sendLog('[SETUP] Не удалось применить дефолтные моды (продолжаю запуск).');
        sendDebug(`Default mods apply failed: ${e.stack || e.message}`);
    }
    
    return config;
}

/**
 * Подготовить и проверить Java
 */
async function prepareJava(config, rootPath, sendLog, sendDebug) {
    let javaPath = config.javaPath;
    
    if (javaPath) {
        sendDebug(`Using custom Java path: ${javaPath}`);
        if (!fs.existsSync(javaPath)) {
            throw new Error("Неверный путь к Java. Проверьте настройки.");
        }

        // Verify Java version (Forge 1.20.1 requires Java 17+)
        const info = await getJavaVersionInfo(javaPath);
        if (!info || info.major < REQUIRED_JAVA_MAJOR) {
            throw new Error(
                `У вас указана неподходящая Java (нужна Java ${REQUIRED_JAVA_MAJOR}+ для Minecraft ${MC_VERSION}).\n\n` +
                `Решение:\n` +
                `1) Откройте настройки лаунчера и очистите поле "Java" (оставьте пустым) — лаунчер сам скачает JRE ${REQUIRED_JAVA_MAJOR}.\n` +
                `или\n` +
                `2) Укажите путь к java.exe из Java ${REQUIRED_JAVA_MAJOR}+.\n\n` +
                `Текущая Java: ${info?.major || 'не удалось определить'}`
            );
        }
        sendDebug(`Custom Java version OK: ${info.major}`);
    } else {
        // Auto-download Java if not set
        sendDebug('Checking/Downloading Java...');
        const downloadedJava = await checkAndDownloadJava(rootPath, sendLog);
        if (downloadedJava) {
            javaPath = downloadedJava;
            sendDebug(`Java downloaded/found at: ${javaPath}`);
        }
    }

    // Windows: prefer javaw.exe to avoid opening a console window
    if (process.platform === 'win32' && javaPath) {
        const preferredPath = preferJavaw(javaPath);
        if (preferredPath !== javaPath) {
            sendDebug(`Using javaw.exe to avoid console: ${preferredPath}`);
            javaPath = preferredPath;
        }
    }
    
    return javaPath;
}

/**
 * Подготовить Forge installer
 */
async function prepareForge(rootPath, sendLog, sendDebug) {
    const forgeInstallerPath = path.join(rootPath, `forge-${FORGE_VERSION}-installer.jar`);
    let needForge = !fs.existsSync(forgeInstallerPath);
    
    if (!needForge) {
        const size = fs.statSync(forgeInstallerPath).size;
        if (size === 0 || !(await isZipIntact(forgeInstallerPath))) {
            sendLog('Обнаружен поврежденный установщик Forge (битый/не ZIP). Перекачивание...');
            try { fs.unlinkSync(forgeInstallerPath); } catch {}
            needForge = true;
        }
    }

    if (needForge) {
        sendLog('Скачивание установщика Forge...');
        sendDebug(`Downloading Forge from ${FORGE_INSTALLER_URL}`);
        await downloadFile(FORGE_INSTALLER_URL, forgeInstallerPath, { timeoutMs: 120_000 });
        if (!(await isZipIntact(forgeInstallerPath))) {
            try { fs.unlinkSync(forgeInstallerPath); } catch {}
            throw new Error('Downloaded Forge installer is not a valid JAR/ZIP (truncated or HTML response)');
        }
        sendLog('Установщик Forge скачан.');
    } else {
        sendLog('Установщик Forge найден.');
    }
    
    return forgeInstallerPath;
}

/**
 * Подготовить Authlib Injector
 */
async function prepareAuthlib(rootPath, sendLog, sendDebug) {
    const authlibPath = path.join(rootPath, 'authlib-injector.jar');
    
    if (!fs.existsSync(authlibPath) || !(await isZipIntact(authlibPath))) {
        sendLog('Скачивание Authlib Injector...');
        sendDebug(`Downloading Authlib from ${AUTHLIB_INJECTOR_URL}`);
        await downloadFile(AUTHLIB_INJECTOR_URL, authlibPath, { timeoutMs: 60_000 });
        if (!(await isZipIntact(authlibPath))) {
            try { fs.unlinkSync(authlibPath); } catch {}
            throw new Error('Downloaded authlib-injector is not a valid JAR/ZIP');
        }
        sendLog('Authlib Injector скачан.');
    }
    
    return authlibPath;
}

/**
 * Синхронизация модов
 */
async function syncMods(event, rootPath, config, sendLog, sendDebug, devMode) {
    if (devMode) {
        sendLog('[DEV MODE] Пропуск синхронизации файлов...');
        sendDebug('Dev mode enabled - skipping syncFiles');
        return;
    }
    
    const onSyncProgress = (p) => {
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('progress', p);
        }
    };
    
    sendDebug('Starting syncFiles...');
    await syncFiles(rootPath, MANIFEST_URL, sendLog, onSyncProgress, config.disabledMods, () => isLaunchCancelled);
    sendDebug('syncFiles completed.');
}

/**
 * Построить опции для MCLC
 */
function buildLaunchOptions(config, rootPath, javaPath, forgeInstallerPath, authlibPath, authSession) {
    return {
        clientPackage: null,
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
            number: MC_VERSION,
            type: "release"
        },
        forge: forgeInstallerPath,
        memory: {
            max: config.memoryMax,
            min: config.memoryMin
        },
        javaPath: javaPath || undefined,
        overrides: {
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
            `-javaagent:${authlibPath}=https://ganjacraft.ru/api/yggdrasil`,
            ...JVM_OPTIMIZATION_ARGS,
        ]
    };
}

/**
 * Обработать ошибку запуска MCLC
 */
function handleLaunchError(error, rootPath) {
    const msg = (error && error.message) ? error.message : String(error);
    const isEperm = msg.includes('EPERM') || error?.code === 'EPERM';
    const isClassNotFound = msg.includes('NoClassDefFoundError') || msg.includes('modlauncher') || msg.includes('securejarhandler');
    
    if (isClassNotFound) {
        return {
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
        };
    } else if (isEperm) {
        return {
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
        };
    }
    
    return { success: false, error: msg };
}

/**
 * Запустить игру
 */
async function launchGame(event, options) {
    if (isGameRunning) {
        return { success: false, error: "Игра уже запущена!" };
    }
    
    isGameRunning = true;
    isLaunchCancelled = false;

    let config = loadConfig();
    const rootPath = config.installPath;
    
    if (!fs.existsSync(rootPath)) {
        fs.mkdirSync(rootPath, { recursive: true });
    }

    const { logStream, debugStream, sendLog, sendDebug } = createLoggers(event, rootPath, config);

    sendLog('Запуск с конфигурацией: ' + JSON.stringify(config));
    if (config.debugMode) {
        sendLog('РЕЖИМ ОТЛАДКИ ВКЛЮЧЕН. Подробный лог пишется в debug-launcher.log');
    }

    try {
        // Apply default mod settings for fresh installs
        config = await applyDefaultModSettings(config, rootPath, sendLog, sendDebug);

        // Preload vanilla version files
        sendDebug('Starting ensureVanillaVersionFiles...');
        await ensureVanillaVersionFiles(rootPath, sendLog);
        sendDebug('ensureVanillaVersionFiles completed.');

        // Prepare Java
        let javaPath;
        try {
            javaPath = await prepareJava(config, rootPath, sendLog, sendDebug);
        } catch (e) {
            sendLog(`[ОШИБКА] ${e.message}`);
            isGameRunning = false;
            return { success: false, error: e.message };
        }

        // Prepare Forge
        let forgeInstallerPath;
        try {
            forgeInstallerPath = await prepareForge(rootPath, sendLog, sendDebug);
        } catch (e) {
            sendDebug(`Forge download failed: ${e.stack}`);
            isGameRunning = false;
            return { success: false, error: "Не удалось скачать Forge: " + e.message };
        }

        // Prepare Authlib Injector
        let authlibPath;
        try {
            authlibPath = await prepareAuthlib(rootPath, sendLog, sendDebug);
        } catch (e) {
            sendDebug(`Authlib download failed: ${e.stack}`);
            isGameRunning = false;
            return { success: false, error: "Не удалось скачать Authlib Injector: " + e.message };
        }

        // Sync mods
        try {
            await syncMods(event, rootPath, config, sendLog, sendDebug, options.devMode);
        } catch (e) {
            if (e.message === 'CANCELLED') {
                sendLog('Запуск отменен пользователем.');
                isGameRunning = false;
                return { success: false, error: "Запуск отменен" };
            }
            sendLog('ВНИМАНИЕ: Ошибка синхронизации модов. Игра может работать нестабильно.');
            sendDebug(`Sync error: ${e.stack}`);
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
            sendDebug(`Auth failed: ${e.stack}`);
            isGameRunning = false;
            return { success: false, error: "Ошибка авторизации: " + e.message };
        }

        // Build launch options
        const opts = buildLaunchOptions(config, rootPath, javaPath, forgeInstallerPath, authlibPath, authSession);

        // Cleanup empty files before launch
        sendLog('Проверка целостности библиотек...');
        try {
            await cleanZeroByteFiles(path.join(rootPath, 'libraries'));
            await cleanZeroByteFiles(path.join(rootPath, 'versions'));
        } catch (e) {
            isGameRunning = false;
            return { success: false, error: e.message };
        }

        // Comprehensive repair
        try {
            sendDebug('Starting comprehensive repair of critical files...');
            await repairCriticalFiles(rootPath, sendLog, sendDebug);
            sendDebug('Critical files repair completed successfully.');
        } catch (e) {
            sendDebug(`Critical files repair failed: ${e.stack || e.message}`);
            isGameRunning = false;
            return { success: false, error: e.message };
        }

        // Windows-specific preflight
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
        
        const mainWindow = BrowserWindow.fromWebContents(event.sender);

        // Remove all previous listeners to prevent memory leaks
        launcher.removeAllListeners();

        // Register fresh listeners
        launcher.once('close', (code) => {
            isGameRunning = false;
            sendLog(`[LAUNCHER] Игра закрылась с кодом ${code}`);
            sendDebug(`Game closed with code ${code}`);
            
            if (logStream) logStream.end();
            if (debugStream) debugStream.end();

            if (mainWindow && !mainWindow.isDestroyed()) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                if (!mainWindow.isVisible()) mainWindow.show();
                mainWindow.focus();
                mainWindow.webContents.send('game-closed');
            }
        });

        return new Promise((resolve) => {
            let hasResolved = false;

            const onArguments = () => {
                if (!hasResolved) {
                    hasResolved = true;
                    sendLog('[LAUNCHER] Процесс игры запускается...');
                    sendDebug('Game process arguments generated.');
                    resolve({ success: true });
                }
            };

            launcher.once('arguments', onArguments);

            if (config.debugMode) {
                launcher.on('debug', (e) => {
                    sendDebug(`[MCLC] ${e}`);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('log-message', `[DEBUG] ${e}`);
                    }
                });
            }

            launcher.on('data', (e) => {
                if (config.debugMode) sendDebug(`[GAME STDOUT] ${e}`);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('log-message', `[GAME] ${e}`);
                }
            });
            
            launcher.on('error', (e) => {
                if (config.debugMode) sendDebug(`[GAME STDERR] ${e}`);
            });

            launcher.on('progress', (e) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('progress', { task: e.task, total: e.total, type: e.type });
                }
            });
            
            launcher.launch(opts).then(() => {
                if (!hasResolved) {
                    hasResolved = true;
                    resolve({ success: true });
                }
            }).catch(error => {
                sendDebug(`Launcher promise rejected: ${error.stack}`);
                if (!hasResolved) {
                    hasResolved = true;
                    isGameRunning = false;
                    resolve(handleLaunchError(error, rootPath));
                } else {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('log-message', `[ОШИБКА] Игра вылетела: ${error.message}`);
                    }
                }
            });
        });
        
    } catch (e) {
        sendDebug(`Launcher exception: ${e.stack}`);
        isGameRunning = false;
        return { success: false, error: e.message };
    }
}

module.exports = {
    launchGame,
    cancelLaunch,
    getIsGameRunning,
};
