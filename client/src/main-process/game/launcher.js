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
const { checkAndDownloadJava, getJavaVersionInfo, REQUIRED_JAVA_MAJOR, preferJavaw, resolveJavaPath } = require('../../modules/java');
const { loadConfig, saveConfig } = require('../../modules/config');
const { cleanZeroByteFiles, isZipIntact } = require('./integrity');
const { ensureVanillaVersionFiles, preflightNeoForgeLibraries, ensureNeoForgeVersionJsonMerged, ensureAssetIndex, parseNeoForgeJvmArgs, verifyNeoForgeLibraries } = require('./neoforge');
const { 
    NEOFORGE_VERSION,
    MC_VERSION,
    MANIFEST_URL,
    NEOFORGE_INSTALLER_URL,
    AUTHLIB_INJECTOR_URL,
    YGGDRASIL_AUTH_URL,
    BASE_URL,
    API_BASE,
    DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS,
    JVM_OPTIMIZATION_ARGS,
} = require('../constants');

// Global state
const launcher = new Client();
let isGameRunning = false;
let isLaunchCancelled = false;

// Monkey-patch MCLC Handler to support fallback to VPS mirror on download failure
const MCLCHandler = require('minecraft-launcher-core/components/handler');
const originalDownloadAsync = MCLCHandler.prototype.downloadAsync;
const { getMirrorFallbackUrl } = require('../constants');

MCLCHandler.prototype.downloadAsync = async function(url, directory, name, retry, type) {
    const fallbackUrl = getMirrorFallbackUrl(url);
    const filePath = path.join(directory, name);
    
    // Try original URL first
    const result = await originalDownloadAsync.call(this, url, directory, name, retry, type);
    
    // MCLC may leave a 0-byte file on failure — clean it up
    if (!result) {
        try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
                fs.unlinkSync(filePath);
                this.client.emit('debug', `[MCLC]: Cleaned up 0-byte file: ${name}`);
            }
        } catch {}
    }
    
    // MCLC resolves with `false` on 404, or `undefined` on error
    if (!result && fallbackUrl) {
        this.client.emit('debug', `[MCLC]: Original URL failed (${url}). Falling back to mirror: ${fallbackUrl}`);
        // Try fallback URL, without passing fallback logic further down
        const mirrorResult = await originalDownloadAsync.call(this, fallbackUrl, directory, name, retry, type);
        
        // Clean up 0-byte file from mirror failure too
        if (!mirrorResult) {
            try {
                if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
                    fs.unlinkSync(filePath);
                }
            } catch {}
        }
        return mirrorResult;
    }
    
    return result;
};

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
                return DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS.some(p => fileName.toLowerCase().includes(p.toLowerCase()));
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
    const logStream = fs.createWriteStream(logFile, { flags: 'w' });

    logStream.write(`--- Log started at ${new Date().toISOString()} ---\n`);

    const sendLog = (msg) => {
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('log-message', msg);
        }
        const timestamp = new Date().toISOString();
        if (logStream && !logStream.destroyed) {
            logStream.write(`[${timestamp}] ${msg}\n`);
        }
    };

    const sendDebug = (msg) => {
        const timestamp = new Date().toISOString();
        if (logStream && !logStream.destroyed) {
            logStream.write(`[${timestamp}] [DEBUG] ${msg}\n`);
        }
    };

    return { logStream, sendLog, sendDebug };
}

let activeModWatcher = null;
let watcherDebounceTimeout = null;
let watcherInterval = null;
const { isModDisabled } = require('../../modules/updater/utils');

/**
 * Запустить слежение за папкой mods/ во время игры
 */
function startModWatcher(rootPath, config, gameProc, sendLog) {
    stopModWatcher();

    const modsDir = path.join(rootPath, 'mods');
    if (!fs.existsSync(modsDir)) return;

    const manifestPath = path.join(rootPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;

    let manifestMods;
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const disabledMods = Array.isArray(config.disabledMods) ? config.disabledMods : [];
        manifestMods = new Set(
            (manifest.files || [])
                .filter(f => f && typeof f.path === 'string' && f.path.startsWith('mods/') && !isModDisabled(f.path, disabledMods))
                .map(f => path.normalize(f.path).toLowerCase())
        );
    } catch (e) {
        sendLog(`[SECURITY] Ошибка чтения манифеста для слежки: ${e.message}`);
        return;
    }

    sendLog(`[SECURITY] Запуск отслеживания папки модов (PID игры: ${gameProc?.pid || 'unknown'})...`);

    const checkModsFolder = () => {
        if (!isGameRunning || !fs.existsSync(modsDir)) return;

        let detectedCheat = false;
        const cheatsFound = [];

        function scanDir(dir) {
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch { return; }

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relPath = path.relative(rootPath, fullPath);
                const normalizedPath = path.normalize(relPath).toLowerCase();

                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else {
                    if (!manifestMods.has(normalizedPath)) {
                        detectedCheat = true;
                        cheatsFound.push({ fullPath, relPath });
                    }
                }
            }
        }

        scanDir(modsDir);

        if (detectedCheat) {
            for (const cheat of cheatsFound) {
                sendLog(`[SECURITY GUARD] СТОРОННИЙ МОД ОБНАРУЖЕН: ${cheat.relPath}`);
                try {
                    fs.unlinkSync(cheat.fullPath);
                    sendLog(`[SECURITY GUARD] Успешно удалён сторонний мод: ${cheat.relPath}`);
                } catch (e) {
                    sendLog(`[SECURITY GUARD] Не удалось удалить ${cheat.relPath}: ${e.message}`);
                }
            }

            sendLog('[SECURITY GUARD] ОБНАРУЖЕН СТОРОННИЙ МОД/ЧИТ! ПРИНУДИТЕЛЬНОЕ УБИЙСТВО ИГРЫ!');
            if (gameProc && gameProc.pid) {
                const pid = gameProc.pid;
                sendLog(`[SECURITY GUARD] Убийство процесса игры (PID: ${pid})...`);
                if (process.platform === 'win32') {
                    try {
                        require('child_process').execSync(`taskkill /F /T /PID ${pid}`);
                    } catch (err) {
                        sendLog(`[SECURITY GUARD] taskkill err: ${err.message}`);
                    }
                }
                try {
                    gameProc.kill('SIGKILL');
                } catch {}
            }
        }
    };

    // 1. Сразу проверяем при старте
    checkModsFolder();

    // 2. Отслеживаем события ФС на уровне ядра ОС (0% нагрузки на диск/HDD)
    try {
        activeModWatcher = fs.watch(modsDir, { recursive: true }, () => {
            if (watcherDebounceTimeout) clearTimeout(watcherDebounceTimeout);
            watcherDebounceTimeout = setTimeout(checkModsFolder, 200);
        });
    } catch (e) {
        sendLog(`[SECURITY] Ошибка fs.watch: ${e.message}`);
    }
}

/**
 * Остановить слежение за папкой mods/
 */
function stopModWatcher() {
    if (watcherDebounceTimeout) {
        clearTimeout(watcherDebounceTimeout);
        watcherDebounceTimeout = null;
    }
    if (activeModWatcher) {
        try {
            activeModWatcher.close();
        } catch {}
        activeModWatcher = null;
    }
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
    let javaPath = config.javaPath ? resolveJavaPath(config.javaPath) : null;
    
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
    const forgeInstallerPath = path.join(rootPath, `neoforge-${NEOFORGE_VERSION}-installer.jar`);
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
        sendDebug(`Downloading Forge from ${NEOFORGE_INSTALLER_URL}`);
        await downloadFile(NEOFORGE_INSTALLER_URL, forgeInstallerPath, { timeoutMs: 120_000 });
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
 * Обязательные ресурспаки, которые всегда должны быть включены.
 * Игрок не может их убрать — лаунчер восстанавливает их при каждом запуске.
 */
const REQUIRED_RESOURCE_PACKS = [
    'file/[GanjaCraft] Main'
];

/**
 * Гарантировать наличие обязательных ресурспаков в options.txt
 * Добавляет паки в начало списка (перед vanilla/mod_resources), не трогая пользовательские.
 */
function ensureRequiredResourcePacks(rootPath, sendLog, sendDebug) {
    const optionsPath = path.join(rootPath, 'options.txt');

    try {
        let content = '';
        if (fs.existsSync(optionsPath)) {
            content = fs.readFileSync(optionsPath, 'utf-8');
        }

        // Parse the resourcePacks line
        const rpLineRegex = /^resourcePacks:(\[.*?\])\r?$/m;
        const match = content.match(rpLineRegex);

        let currentPacks = [];
        if (match) {
            try {
                currentPacks = JSON.parse(match[1]);
            } catch {
                currentPacks = [];
            }
        }

        // Add required packs if missing, placing them before 'vanilla' and 'mod_resources'
        let changed = false;
        for (const required of REQUIRED_RESOURCE_PACKS) {
            if (!currentPacks.includes(required)) {
                // Insert before 'vanilla' or 'mod_resources' if present, else at start
                const insertIdx = currentPacks.findIndex(p => p === 'vanilla' || p === 'mod_resources');
                if (insertIdx >= 0) {
                    currentPacks.splice(insertIdx, 0, required);
                } else {
                    currentPacks.unshift(required);
                }
                changed = true;
                sendDebug(`Required resource pack added to options.txt: ${required}`);
            }
        }

        if (changed || !match) {
            const newRpLine = `resourcePacks:${JSON.stringify(currentPacks)}`;
            if (match) {
                // Replace existing line
                content = content.replace(rpLineRegex, newRpLine);
            } else {
                // Append the line at end of file
                content = content.trimEnd() + '\n' + newRpLine + '\n';
            }
            fs.writeFileSync(optionsPath, content, 'utf-8');
            sendLog(`[SETUP] Ресурспаки обновлены в options.txt: ${JSON.stringify(currentPacks)}`);
        } else {
            sendDebug('Required resource packs already present in options.txt.');
        }
    } catch (e) {
        sendDebug(`ensureRequiredResourcePacks error: ${e.message}`);
        sendLog('Предупреждение: не удалось обновить options.txt с обязательными ресурспаками.');
    }
}

/**
 * Синхронизация модов
 */
async function syncMods(event, rootPath, config, sendLog, sendDebug) {
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

    // Ensure required resource packs are always active in options.txt
    ensureRequiredResourcePacks(rootPath, sendLog, sendDebug);
}

/**
 * Построить опции для MCLC
 */
function buildLaunchOptions(config, rootPath, javaPath, forgeInstallerPath, authlibPath, authSession, authlibPrefetched) {
    // Read NeoForge JVM args directly from version.json
    const parsedJvmArgs = parseNeoForgeJvmArgs(rootPath);
    
    let neoforgeModuleArgs;
    if (parsedJvmArgs) {
        // Parsed from version.json — exact paths, no guessing
        neoforgeModuleArgs = parsedJvmArgs;
    } else {
        // Fallback: if version.json is not yet created (first install), 
        // use empty — installer will create it on next run
        neoforgeModuleArgs = [];
    }

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

    const nativesDir = path.join(rootPath, 'natives');
    if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true });

    const assetIndexDir = path.join(rootPath, 'assets', 'indexes');
    if (!fs.existsSync(assetIndexDir)) {
        fs.mkdirSync(assetIndexDir, { recursive: true });
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
                `Критичные файлы NeoForge повреждены или не скачались.\n\n` +
                `Быстрое решение:\n` +
                `1) Удалите папку: ${rootPath}\\libraries\\cpw\\mods\\\n` +
                `2) Попробуйте запустить игру ещё раз (лаунчер переcкачает файлы)\n\n` +
                `Если не сработало:\n` +
                `3) Скопируйте файлы из рабочей установки GanjaCraft:\n` +
                `   - bootstraplauncher-2.0.2.jar\n` +
                `   - securejarhandler-3.0.8.jar\n` +
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
                `   ${rootPath}\\libraries\\cpw\\mods\\bootstraplauncher\\2.0.2\\bootstraplauncher-2.0.2.jar\n` +
                `   ${rootPath}\\libraries\\cpw\\mods\\securejarhandler\\3.0.8\\securejarhandler-3.0.8.jar\n\n` +
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

    const { logStream, sendLog, sendDebug } = createLoggers(event, rootPath, config);

    sendLog('Запуск с конфигурацией: ' + JSON.stringify(config));

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
            await syncMods(event, rootPath, config, sendLog, sendDebug);
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
            sendLog(`Первичная установка NeoForge ${NEOFORGE_VERSION} (~15-30 сек)...`);
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
                sendLog(`✓ NeoForge ${NEOFORGE_VERSION} успешно установлен.`);
            } catch (e) {
                sendDebug(`NeoForge install error: ${e.stack || e.message}`);
                isGameRunning = false;
                return { success: false, error: `Не удалось установить NeoForge ${NEOFORGE_VERSION}:\n${e.message}` };
            }
        }

        // Ensure NeoForge version JSON is merged with vanilla 1.21.1 libraries BEFORE passing it to MCLC
        ensureNeoForgeVersionJsonMerged(rootPath, sendDebug);

        // Verify NeoForge library SHA1 hashes (delete corrupted, MCLC will re-download)
        try {
            const corrupted = await verifyNeoForgeLibraries(rootPath, sendLog, sendDebug);
            if (corrupted > 0) {
                sendDebug(`Deleted ${corrupted} corrupted libraries. MCLC will re-download them.`);
            }
        } catch (e) {
            sendDebug(`Library verification failed: ${e.message}`);
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

        // Ensure real Minecraft 1.21.1 asset index (17.json) exists and is populated
        await ensureAssetIndex(rootPath, sendLog);

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

        // Preflight checks
        try {
            sendDebug('Preflight: checking NeoForge library writability...');
            await preflightNeoForgeLibraries(rootPath, sendLog, sendDebug);
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
            stopModWatcher();
            sendLog(`[LAUNCHER] Игра закрылась с кодом ${code}`);
            sendDebug(`Game closed with code ${code}`);
            
            if (logStream) logStream.end();

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

            launcher.launch(opts).then((proc) => {
                if (proc) {
                    sendDebug(`Game process spawned with PID: ${proc.pid}`);
                    startModWatcher(rootPath, config, proc, sendLog);
                }
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
