/**
 * GanjaCraft Launcher - Game Launcher
 * Основная логика запуска игры
 */

const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const { Client } = require('minecraft-launcher-core');
const { downloadFile, syncFiles, downloadWithRetry } = require('../../modules/updater');
const { authenticateYggdrasil } = require('../../modules/auth');
const { checkAndDownloadJava, getJavaVersionInfo, REQUIRED_JAVA_MAJOR, preferJavaw } = require('../../modules/java');
const { loadConfig, saveConfig } = require('../../modules/config');
const { cleanZeroByteFiles, isZipIntact } = require('./integrity');
const { repairCriticalFiles } = require('./repair');
const { ensureVanillaVersionFiles, preflightNeoForgeLibraries, preflightForgeLibraries, ensureNeoForgeVersionJsonMerged } = require('./neoforge');
const { 
    NEOFORGE_VERSION,
    FORGE_VERSION,
    MC_VERSION,
    MANIFEST_URL,
    NEOFORGE_INSTALLER_URL,
    FORGE_INSTALLER_URL,
    AUTHLIB_INJECTOR_URL,
    YGGDRASIL_AUTH_URL,
    MIRROR_BASE,
    API_BASE,
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
        const timestamp = new Date().toISOString();
        if (logStream && !logStream.destroyed) {
            logStream.write(`[${timestamp}] [DEBUG] ${msg}\n`);
        }
        if (debugStream && !debugStream.destroyed) {
            debugStream.write(`[${timestamp}] [DEBUG] ${msg}\n`);
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
        await downloadWithRetry(MANIFEST_URL, manifestPath, { timeoutMs: 15_000 });
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
}

/**
 * Построить опции для MCLC
 */
function buildLaunchOptions(config, rootPath, javaPath, forgeInstallerPath, authlibPath, authSession, authlibPrefetched) {
    // NeoForge required module system args (MCLC doesn't process inheritsFrom JVM args)
    const neoforgeModuleArgs = [
        `-Djava.net.preferIPv6Addresses=system`,
        `-DignoreList=client-extra,${MC_VERSION}.jar`,
        `-DlibraryDirectory=${path.join(rootPath, 'libraries')}`,
        `-p`, [
            path.join(rootPath, 'libraries/cpw/mods/bootstraplauncher/2.0.2/bootstraplauncher-2.0.2.jar'),
            path.join(rootPath, 'libraries/cpw/mods/securejarhandler/3.0.8/securejarhandler-3.0.8.jar'),
            path.join(rootPath, 'libraries/org/ow2/asm/asm-commons/9.8/asm-commons-9.8.jar'),
            path.join(rootPath, 'libraries/org/ow2/asm/asm-util/9.8/asm-util-9.8.jar'),
            path.join(rootPath, 'libraries/org/ow2/asm/asm-analysis/9.8/asm-analysis-9.8.jar'),
            path.join(rootPath, 'libraries/org/ow2/asm/asm-tree/9.8/asm-tree-9.8.jar'),
            path.join(rootPath, 'libraries/org/ow2/asm/asm/9.8/asm-9.8.jar'),
            path.join(rootPath, 'libraries/net/neoforged/JarJarFileSystems/0.4.1/JarJarFileSystems-0.4.1.jar'),
        ].join(';'),
        `--add-modules`, `ALL-MODULE-PATH`,
        `--add-opens`, `java.base/java.util.jar=cpw.mods.securejarhandler`,
        `--add-opens`, `java.base/java.lang.invoke=cpw.mods.securejarhandler`,
        `--add-exports`, `java.base/sun.security.util=cpw.mods.securejarhandler`,
        `--add-exports`, `jdk.naming.dns/com.sun.jndi.dns=java.naming`,
    ];

    const customArgs = [...neoforgeModuleArgs, ...JVM_OPTIMIZATION_ARGS];
    if (authlibPath && !authSession.isOffline) {
        if (authlibPrefetched) {
            customArgs.unshift(`-Dauthlibinjector.yggdrasil.prefetched=${authlibPrefetched}`);
        }
        customArgs.unshift(`-Dauthlibinjector.disableSniCheck=true`);
        customArgs.unshift(`-Dauthlibinjector.side=client`);
        customArgs.unshift(`-javaagent:${authlibPath}=${BASE_URL}/api/yggdrasil`);
    }

    const neoforgeVerId = `neoforge-${NEOFORGE_VERSION}`;
    const neoforgeJsonPath = path.join(rootPath, 'versions', neoforgeVerId, `${neoforgeVerId}.json`);

    // Ensure NeoForge version JSON is merged with vanilla 1.21.1 libraries
    ensureNeoForgeVersionJsonMerged(rootPath);

    const nativesDir = path.join(rootPath, 'natives');
    if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true });

    // Bypass MCLC 4000-file asset downloader by ensuring asset index exists
    const assetIndexDir = path.join(rootPath, 'assets', 'indexes');
    if (!fs.existsSync(assetIndexDir)) {
        fs.mkdirSync(assetIndexDir, { recursive: true });
    }
    const customAssetIndexFile = path.join(assetIndexDir, `${neoforgeVerId}.json`);
    const mcAssetIndexFile = path.join(assetIndexDir, `${MC_VERSION}.json`);
    if (!fs.existsSync(customAssetIndexFile) && !fs.existsSync(mcAssetIndexFile)) {
        try {
            const dummyIndex = JSON.stringify({ objects: {} }, null, 2);
            fs.writeFileSync(customAssetIndexFile, dummyIndex, 'utf8');
            fs.writeFileSync(mcAssetIndexFile, dummyIndex, 'utf8');
        } catch (_) {}
    }

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
        quickConnect: {
            host: "vocalize-cove.gl.joinmc.link"
        },
        timeout: 180_000,
        version: {
            number: MC_VERSION,
            type: "release",
            custom: neoforgeVerId
        },
        forge: null,
        memory: {
            max: config.memoryMax,
            min: config.memoryMin
        },
        javaPath: javaPath || undefined,
        overrides: {
            maxSockets: 8,
            minArgs: 1,
            versionJson: neoforgeJsonPath,
            natives: nativesDir,
            minecraftJar: path.join(rootPath, 'versions', MC_VERSION, `${MC_VERSION}.jar`),
        },
        customArgs: customArgs
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

        // Authentication (Yggdrasil with Offline Fallback)
        sendLog('Авторизация игрока...');
        let authSession;
        const crypto = require('crypto');

        function makeOfflineSession(name) {
            const md5 = crypto.createHash('md5').update('OfflinePlayer:' + name).digest();
            md5[6] = (md5[6] & 0x0f) | 0x30;
            md5[8] = (md5[8] & 0x3f) | 0x80;
            const hex = md5.toString('hex');
            const offlineUuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

            return {
                accessToken: crypto.randomBytes(16).toString('hex'),
                clientToken: crypto.randomBytes(16).toString('hex'),
                uuid: offlineUuid,
                name: name,
                isOffline: true
            };
        }

        if (options && options.token) {
            try {
                sendDebug(`Authenticating user: ${options.username}`);
                authSession = await authenticateYggdrasil(YGGDRASIL_AUTH_URL, options.username, options.token);
                sendLog(`Авторизация успешна. UUID: ${authSession.uuid}`);
                sendDebug(`Auth success. UUID: ${authSession.uuid}, Name: ${authSession.name}`);
            } catch (e) {
                sendDebug(`Yggdrasil auth unavailable (${e.message}), using offline session.`);
                sendLog(`Сервер авторизации недоступен. Запуск в офлайн-режиме под ником ${options.username}...`);
                authSession = makeOfflineSession(options.username || 'Player');
            }
        } else {
            const playerNick = (options && options.username) ? options.username : 'Player';
            sendLog(`Запуск в офлайн-режиме под ником ${playerNick}...`);
            authSession = makeOfflineSession(playerNick);
        }

        // Ensure launcher_profiles.json exists (required by NeoForge installer)
        const profilesPath = path.join(rootPath, 'launcher_profiles.json');
        if (!fs.existsSync(profilesPath)) {
            const defaultProfiles = {
                profiles: {
                    "GanjaCraft": {
                        name: "GanjaCraft",
                        type: "custom",
                        created: new Date().toISOString(),
                        lastUsed: new Date().toISOString(),
                        lastVersionId: MC_VERSION
                    }
                },
                settings: {},
                version: 3
            };
            try {
                fs.writeFileSync(profilesPath, JSON.stringify(defaultProfiles, null, 2), 'utf8');
            } catch (e) {
                sendDebug(`Failed to create launcher_profiles.json: ${e.message}`);
            }
        }

        // NeoForge headless install check
        const neoforgeVerId = `neoforge-${NEOFORGE_VERSION}`;
        const neoforgeJsonPath = path.join(rootPath, 'versions', neoforgeVerId, `${neoforgeVerId}.json`);

        if (!fs.existsSync(neoforgeJsonPath)) {
            sendLog('Первичная установка NeoForge 21.1.233 (~15-30 сек)...');
            sendDebug(`Running NeoForge installer headless: ${forgeInstallerPath}`);
            try {
                const { execFile } = require('child_process');
                const javaBin = (process.platform === 'win32' && javaPath && javaPath.toLowerCase().endsWith('javaw.exe'))
                    ? javaPath.replace(/javaw\.exe$/i, 'java.exe')
                    : (javaPath || 'java');

                await new Promise((resolve, reject) => {
                    const proc = execFile(javaBin, ['-jar', forgeInstallerPath, '--installClient', rootPath], { cwd: rootPath });
                    let stderr = '';
                    let stdout = '';
                    proc.stdout?.on('data', d => { stdout += d.toString(); });
                    proc.stderr?.on('data', d => { stderr += d.toString(); });
                    proc.on('close', code => {
                        sendDebug(`NeoForge installer exit code: ${code}`);
                        if (code === 0 || fs.existsSync(neoforgeJsonPath)) {
                            resolve();
                        } else {
                            reject(new Error(`Код завершения установщика: ${code}.\n${stderr || stdout}`));
                        }
                    });
                    proc.on('error', err => reject(err));
                });
                sendLog('✓ NeoForge 21.1.233 успешно установлен.');
            } catch (e) {
                sendDebug(`NeoForge install error: ${e.stack || e.message}`);
                isGameRunning = false;
                return { success: false, error: `Не удалось установить NeoForge 21.1.233:\n${e.message}` };
            }
        }

        // Prefetch Yggdrasil metadata for authlib-injector (bypass Localtunnel reminder)
        let authlibPrefetched = null;
        if (authlibPath && !authSession.isOffline) {
            try {
                const metaRes = await fetch(`${BASE_URL}/api/yggdrasil`, {
                    headers: {
                        'bypass-tunnel-reminder': 'true',
                        'User-Agent': 'localtunnel',
                        'Accept': 'application/json'
                    }
                });
                const metaText = await metaRes.text();
                const compactJson = JSON.stringify(JSON.parse(metaText));
                authlibPrefetched = Buffer.from(compactJson, 'utf8').toString('base64');
                sendDebug(`Prefetched Yggdrasil metadata (${compactJson.length} chars)`);
            } catch (e) {
                sendDebug(`Failed to prefetch Yggdrasil metadata: ${e.message}`);
            }
        }

        // Build launch options
        const opts = buildLaunchOptions(config, rootPath, javaPath, forgeInstallerPath, authlibPath, authSession, authlibPrefetched);

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
                const text = String(e).trim();
                if (text) sendLog(`[GAME] ${text}`);
            });
            
            launcher.on('error', (e) => {
                const text = String(e).trim();
                if (text) sendLog(`[GAME ERROR] ${text}`);
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
