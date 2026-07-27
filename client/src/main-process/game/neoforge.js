/**
 * GanjaCraft Launcher - NeoForge Management
 * Управление NeoForge: preflight, version files
 */

const fs = require('fs');
const path = require('path');
const { downloadFile } = require('../../modules/updater');
const { isZipIntact, ensureWritableFilePath } = require('./integrity');
const { 
    MC_VERSION,
    VANILLA_VERSION_JSON_URL,
    VANILLA_VERSION_JAR_URL,
    URL_REWRITES,
} = require('../constants');

/**
 * Переписать URL через наш mirror
 * @param {string} url - Оригинальный URL
 * @returns {string} - Переписанный URL
 */
function rewriteKnownUrl(url) {
    if (!url || typeof url !== 'string') return url;

    for (const [from, to] of URL_REWRITES) {
        if (url.startsWith(from)) {
            return to + url.slice(from.length);
        }
    }
    return url;
}

/**
 * Переписать URLs в version JSON
 * @param {Object} versionJson - JSON версии Minecraft
 * @returns {Object} - Модифицированный JSON
 */
function rewriteVersionJsonUrls(versionJson) {
    if (!versionJson || typeof versionJson !== 'object') return versionJson;

    // Top-level downloads
    if (versionJson.downloads) {
        if (versionJson.downloads.client?.url) {
            versionJson.downloads.client.url = rewriteKnownUrl(versionJson.downloads.client.url);
        }
        if (versionJson.downloads.server?.url) {
            versionJson.downloads.server.url = rewriteKnownUrl(versionJson.downloads.server.url);
        }
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
                    if (item?.url) {
                        item.url = rewriteKnownUrl(item.url);
                    }
                }
            }
        }
    }

    return versionJson;
}

/**
 * Убедиться, что vanilla version files существуют
 * @param {string} rootPath - Корневой путь установки
 * @param {Function} sendLog - Функция логирования
 */
async function ensureVanillaVersionFiles(rootPath, sendLog) {
    const versionDir = path.join(rootPath, 'versions', MC_VERSION);
    const versionJsonPath = path.join(versionDir, `${MC_VERSION}.json`);
    const versionJarPath = path.join(versionDir, `${MC_VERSION}.jar`);

    if (!fs.existsSync(versionDir)) {
        fs.mkdirSync(versionDir, { recursive: true });
    }

    // Ensure version JSON exists and is usable
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
        // Rewrite in-place to ensure new mirror rules apply after updates
        try {
            const parsed = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
            rewriteVersionJsonUrls(parsed);
            fs.writeFileSync(versionJsonPath, JSON.stringify(parsed, null, 2), 'utf8');
        } catch {
            // Ignore; will be handled on next run.
        }
    }

    // Ensure client jar exists
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

/**
 * Preflight проверка NeoForge библиотек на доступность записи
 * @param {string} rootPath - Корневой путь установки
 * @param {Function} sendLog - Функция логирования
 * @param {Function} sendDebug - Функция дебаг-логирования
 */
async function preflightNeoForgeLibraries(rootPath, sendLog, sendDebug) {
    const librariesDir = path.join(rootPath, 'libraries');
    
    const criticalLibs = [
        path.join(librariesDir, 'net', 'neoforged', 'fancymodloader', 'loader', '4.0.42', 'loader-4.0.42.jar'),
    ];

    for (const libPath of criticalLibs) {
        if (!fs.existsSync(libPath)) {
            sendDebug(`Preflight: ${path.basename(libPath)} does not exist yet.`);
            continue;
        }
        
        try {
            await ensureWritableFilePath(libPath);
            sendDebug(`Preflight: ${path.basename(libPath)} is writable.`);
        } catch (e) {
            sendDebug(`Preflight: ${path.basename(libPath)} write check failed: ${e.message}`);
        }
    }
}

/**
 * Объединить библиотеки 1.21.1.json с neoforge JSON для MCLC
 * @param {string} rootPath - Корневой путь установки
 * @param {Function} [sendDebug] - Функция дебаг-логирования
 */
function ensureNeoForgeVersionJsonMerged(rootPath, sendDebug) {
    const neoforgeVerId = `neoforge-21.1.233`;
    const neoforgeJsonPath = path.join(rootPath, 'versions', neoforgeVerId, `${neoforgeVerId}.json`);
    const vanillaJsonPath = path.join(rootPath, 'versions', MC_VERSION, `${MC_VERSION}.json`);

    if (!fs.existsSync(neoforgeJsonPath) || !fs.existsSync(vanillaJsonPath)) return;

    try {
        const neoJson = JSON.parse(fs.readFileSync(neoforgeJsonPath, 'utf8'));
        const vanillaJson = JSON.parse(fs.readFileSync(vanillaJsonPath, 'utf8'));

        if (!neoJson.id.startsWith(MC_VERSION)) {
            neoJson.id = `${MC_VERSION}-${neoJson.id}`;
        }

        const existingNames = new Set((neoJson.libraries || []).map(l => l.name));
        let added = 0;
        if (Array.isArray(vanillaJson.libraries)) {
            for (const lib of vanillaJson.libraries) {
                if (!existingNames.has(lib.name)) {
                    neoJson.libraries.push(lib);
                    existingNames.add(lib.name);
                    added++;
                }
            }
        }

        // Merge vanilla game arguments (--username, --version, --accessToken, etc.) with NeoForge game arguments (--fml...)
        const vanillaGameArgs = (vanillaJson.arguments && Array.isArray(vanillaJson.arguments.game)) ? vanillaJson.arguments.game : [];
        const neoGameArgs = (neoJson.arguments && Array.isArray(neoJson.arguments.game)) ? neoJson.arguments.game : [];

        // Add vanilla args that are not already present in neoJson.arguments.game
        neoJson.arguments = neoJson.arguments || {};
        const mergedGameArgs = [...vanillaGameArgs];
        for (const arg of neoGameArgs) {
            if (typeof arg === 'string' && !mergedGameArgs.includes(arg)) {
                mergedGameArgs.push(arg);
            } else if (typeof arg !== 'string') {
                mergedGameArgs.push(arg);
            }
        }
        neoJson.arguments.game = mergedGameArgs;

        rewriteVersionJsonUrls(neoJson);
        fs.writeFileSync(neoforgeJsonPath, JSON.stringify(neoJson, null, 2), 'utf8');
        if (sendDebug) sendDebug(`Merged ${added} vanilla libraries into ${neoforgeVerId}.json (total: ${neoJson.libraries.length}, game args: ${neoJson.arguments.game.length})`);
    } catch (e) {
        if (sendDebug) sendDebug(`Failed to merge version JSONs: ${e.message}`);
    }
}

module.exports = {
    rewriteKnownUrl,
    rewriteVersionJsonUrls,
    ensureVanillaVersionFiles,
    preflightNeoForgeLibraries,
    ensureNeoForgeVersionJsonMerged,
    // Alias for backward compatibility
    preflightForgeLibraries: preflightNeoForgeLibraries,
};
