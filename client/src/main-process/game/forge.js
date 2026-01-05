/**
 * GanjaCraft Launcher - Forge Management
 * Управление Forge: preflight, version files
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
 * Preflight проверка Forge библиотек на доступность записи
 * @param {string} rootPath - Корневой путь установки
 * @param {Function} sendLog - Функция логирования
 * @param {Function} sendDebug - Функция дебаг-логирования
 */
async function preflightForgeLibraries(rootPath, sendLog, sendDebug) {
    const librariesDir = path.join(rootPath, 'libraries');
    
    const criticalLibs = [
        path.join(librariesDir, 'cpw', 'mods', 'modlauncher', '10.0.9', 'modlauncher-10.0.9.jar'),
        path.join(librariesDir, 'cpw', 'mods', 'securejarhandler', '2.1.10', 'securejarhandler-2.1.10.jar'),
    ];

    for (const libPath of criticalLibs) {
        // Skip if file doesn't exist - MCLC will download it
        if (!fs.existsSync(libPath)) {
            sendDebug(`Preflight: ${path.basename(libPath)} does not exist yet.`);
            continue;
        }
        
        // Ensure file is writable (not locked by AV)
        try {
            await ensureWritableFilePath(libPath);
            sendDebug(`Preflight: ${path.basename(libPath)} is writable.`);
        } catch (e) {
            sendDebug(`Preflight: ${path.basename(libPath)} write check failed: ${e.message}`);
            // Don't throw - repairCriticalFiles already handles re-downloads
        }
    }
}

module.exports = {
    rewriteKnownUrl,
    rewriteVersionJsonUrls,
    ensureVanillaVersionFiles,
    preflightForgeLibraries,
};
