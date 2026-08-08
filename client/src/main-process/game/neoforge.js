/**
 * GanjaCraft Launcher - NeoForge Management
 * Управление NeoForge: preflight, version files
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { downloadFile } = require('../../modules/updater');
const { isZipIntact, ensureWritableFilePath } = require('./integrity');
const { 
    MC_VERSION,
    NEOFORGE_VERSION,
    VANILLA_VERSION_JSON_URL,
    VANILLA_VERSION_JAR_URL,
    MIRROR_FALLBACKS,
    getMirrorFallbackUrl,
} = require('../constants');



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
            // No rewrite needed; MCLC handler patched to fallback to mirror
            // fs.writeFileSync(versionJsonPath, JSON.stringify(parsed, null, 2), 'utf8');
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
 * Парсит modulepath (-p) и другие JVM аргументы из NeoForge version.json
 * Возвращает готовые аргументы с подстановкой ${library_directory} и ${classpath_separator}
 */
function parseNeoForgeJvmArgs(rootPath) {
    const neoforgeVerId = `neoforge-${NEOFORGE_VERSION}`;
    const jsonPath = path.join(rootPath, 'versions', neoforgeVerId, `${neoforgeVerId}.json`);
    if (!fs.existsSync(jsonPath)) return null;

    try {
        const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const jvmArgs = json.arguments?.jvm;
        if (!Array.isArray(jvmArgs)) return null;

        const libraryDir = path.join(rootPath, 'libraries');
        const separator = process.platform === 'win32' ? ';' : ':';

        // Flatten jvmArgs strings and rule objects
        const rawStrings = [];
        for (const item of jvmArgs) {
            if (typeof item === 'string') {
                rawStrings.push(item);
            } else if (item && typeof item === 'object' && item.value) {
                let allowed = true;
                if (Array.isArray(item.rules)) {
                    for (const rule of item.rules) {
                        if (rule.os && rule.os.name) {
                            const osName = rule.os.name;
                            const isWin = process.platform === 'win32';
                            const isMac = process.platform === 'darwin';
                            const isLinux = process.platform === 'linux';
                            if (rule.action === 'allow') {
                                if (osName === 'windows' && !isWin) allowed = false;
                                if (osName === 'osx' && !isMac) allowed = false;
                                if (osName === 'linux' && !isLinux) allowed = false;
                            } else if (rule.action === 'disallow') {
                                if (osName === 'windows' && isWin) allowed = false;
                                if (osName === 'osx' && isMac) allowed = false;
                                if (osName === 'linux' && isLinux) allowed = false;
                            }
                        }
                    }
                }
                if (allowed) {
                    if (Array.isArray(item.value)) {
                        rawStrings.push(...item.value);
                    } else if (typeof item.value === 'string') {
                        rawStrings.push(item.value);
                    }
                }
            }
        }

        const args = [];
        for (let i = 0; i < rawStrings.length; i++) {
            const arg = rawStrings[i];
            if (typeof arg !== 'string') continue;

            if (arg === '-cp' && rawStrings[i+1] === '${classpath}') {
                i++; // skip both
                continue;
            }
            if (arg.includes('${natives_directory}')) continue;
            if (arg.includes('-Dminecraft.launcher')) continue;

            args.push(arg
                .replace(/\$\{library_directory\}/g, libraryDir)
                .replace(/\$\{classpath_separator\}/g, separator)
                .replace(/\$\{version_name\}/g, MC_VERSION)
            );
        }
        return args;
    } catch (e) {
        return null;
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
    const neoforgeVerId = `neoforge-${NEOFORGE_VERSION}`;
    const jsonPath = path.join(rootPath, 'versions', neoforgeVerId, `${neoforgeVerId}.json`);
    
    if (!fs.existsSync(jsonPath)) {
        sendDebug('Preflight: NeoForge version JSON not found, skipping.');
        return;
    }
    
    let criticalLibPaths = [];
    try {
        const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const jvmArgs = json.arguments?.jvm || [];
        
        // Найти -p аргумент и извлечь пути библиотек
        const pIdx = jvmArgs.indexOf('-p');
        if (pIdx >= 0 && typeof jvmArgs[pIdx + 1] === 'string') {
            const modulepathStr = jvmArgs[pIdx + 1];
            criticalLibPaths = modulepathStr
                .split(/\$\{classpath_separator\}/)
                .map(p => p.replace(/\$\{library_directory\}/g, librariesDir))
                .filter(Boolean);
        }
    } catch (e) {
        sendDebug(`Preflight: Failed to parse version JSON: ${e.message}`);
    }

    for (const libPath of criticalLibPaths) {
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
 * Перезаписать URL в version JSON на зеркало согласно правилам URL_REWRITES
 * @param {object} json - Version JSON объект
 */

/**
 * Объединить библиотеки 1.21.1.json с neoforge JSON для MCLC
 * @param {string} rootPath - Корневой путь установки
 * @param {Function} [sendDebug] - Функция дебаг-логирования
 */
function ensureNeoForgeVersionJsonMerged(rootPath, sendDebug) {
    const neoforgeVerId = `neoforge-${NEOFORGE_VERSION}`;
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

        // Ensure assetIndex is inherited from vanilla (MCLC needs it)
        if (!neoJson.assetIndex && vanillaJson.assetIndex) {
            neoJson.assetIndex = vanillaJson.assetIndex;
        }
        // Ensure assets field is inherited
        if (!neoJson.assets && vanillaJson.assets) {
            neoJson.assets = vanillaJson.assets;
        }
        // Ensure downloads are inherited (MCLC uses downloads.client.url for jar)
        if (!neoJson.downloads && vanillaJson.downloads) {
            neoJson.downloads = vanillaJson.downloads;
        }

        // Merge vanilla game arguments with NeoForge game arguments if missing
        const vanillaGameArgs = (vanillaJson.arguments && Array.isArray(vanillaJson.arguments.game)) ? vanillaJson.arguments.game : [];
        neoJson.arguments = neoJson.arguments || {};
        const neoGameArgs = Array.isArray(neoJson.arguments.game) ? neoJson.arguments.game : [];

        const mergedGameArgs = [...neoGameArgs];
        for (const arg of vanillaGameArgs) {
            if (typeof arg === 'string') {
                if (!mergedGameArgs.includes(arg)) {
                    mergedGameArgs.push(arg);
                }
            } else if (typeof arg === 'object' && arg !== null) {
                const argStr = JSON.stringify(arg);
                const isDup = mergedGameArgs.some(a => typeof a === 'object' && a !== null && JSON.stringify(a) === argStr);
                if (!isDup) {
                    mergedGameArgs.push(arg);
                }
            }
        }
        neoJson.arguments.game = mergedGameArgs;

        // Merge vanilla JVM arguments with NeoForge JVM arguments (crucial for -cp ${classpath})
        const vanillaJvmArgs = (vanillaJson.arguments && Array.isArray(vanillaJson.arguments.jvm)) ? vanillaJson.arguments.jvm : [];
        const neoJvmArgs = (neoJson.arguments && Array.isArray(neoJson.arguments.jvm)) ? neoJson.arguments.jvm : [];
        
        // ВАЖНО: Нельзя дедуплицировать строковые аргументы (например, --add-opens), так как они идут парами.
        // Просто объединяем массивы, как это делает наследование в Minecraft.
        // Но чтобы избежать дублирования при повторных запусках (так как мы перезаписываем тот же файл),
        // проверим, содержит ли уже neoJvmArgs ванильные аргументы.
        
        let mergedJvmArgs = [...neoJvmArgs];
        // Если в neoJvmArgs нет типичного ванильного аргумента, значит это чистый forge-файл
        const hasVanilla = neoJvmArgs.some(arg => typeof arg === 'string' && arg.includes('${natives_directory}'));
        
        if (!hasVanilla) {
            mergedJvmArgs = [...vanillaJvmArgs, ...neoJvmArgs];
        }
        
        neoJson.arguments.jvm = mergedJvmArgs;

        fs.writeFileSync(neoforgeJsonPath, JSON.stringify(neoJson, null, 2), 'utf8');
        if (sendDebug) sendDebug(`Merged ${added} vanilla libraries into ${neoforgeVerId}.json (total: ${neoJson.libraries.length}, game args: ${mergedGameArgs.length})`);
    } catch (e) {
        if (sendDebug) sendDebug(`Failed to merge version JSONs: ${e.message}`);
    }
}

/**
 * Убедиться, что валидный индекс ресурсов 1.21.1 существует и не пуст
 * @param {string} rootPath - Корневой путь установки
 * @param {Function} [sendLog] - Функция логирования
 */
async function ensureAssetIndex(rootPath, sendLog) {
    const assetIndexDir = path.join(rootPath, 'assets', 'indexes');
    if (!fs.existsSync(assetIndexDir)) {
        fs.mkdirSync(assetIndexDir, { recursive: true });
    }

    const indexFiles = [
        path.join(assetIndexDir, '17.json'),
        path.join(assetIndexDir, `${MC_VERSION}.json`),
        path.join(assetIndexDir, `neoforge-${NEOFORGE_VERSION}.json`)
    ];

    let needDownload = false;
    for (const f of indexFiles) {
        if (!fs.existsSync(f)) {
            needDownload = true;
            break;
        }
        try {
            const content = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (!content.objects || Object.keys(content.objects).length === 0) {
                needDownload = true;
                break;
            }
        } catch {
            needDownload = true;
            break;
        }
    }

    if (needDownload) {
        if (sendLog) sendLog('Загрузка индекса ресурсов Minecraft 1.21.1...');
        const assetIndexUrl = 'https://piston-meta.mojang.com/v1/packages/d1aa1019d308e98dcd0cc6ee5da5cf19569d8c81/17.json';
        const tmpFile = path.join(assetIndexDir, '17.json.tmp');
        await downloadFile(assetIndexUrl, tmpFile, { timeoutMs: 30_000 });
        const parsed = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
        const jsonStr = JSON.stringify(parsed, null, 2);
        
        for (const f of indexFiles) {
            fs.writeFileSync(f, jsonStr, 'utf8');
        }
        try { fs.unlinkSync(tmpFile); } catch {}
        if (sendLog) sendLog('Индекс ресурсов Minecraft 1.21.1 готов.');
    }
}

/**
 * Преобразовать name библиотеки (group:artifact:version[:classifier]) в относительный путь
 */
function nameToPath(name) {
    if (!name || typeof name !== 'string') return null;
    const parts = name.split(':');
    if (parts.length < 3) return null;
    const [group, artifact, version, classifier] = parts;
    const groupPath = group.replace(/\./g, '/');
    const filename = classifier 
        ? `${artifact}-${version}-${classifier}.jar`
        : `${artifact}-${version}.jar`;
    return `${groupPath}/${artifact}/${version}/${filename}`;
}

/**
 * Проверить SHA1 хеши и ZIP-структуру NeoForge библиотек, удалить повреждённые
 * @returns {Promise<number>} Количество удалённых повреждённых файлов
 */
async function verifyNeoForgeLibraries(rootPath, sendLog, sendDebug) {
    const neoforgeVerId = `neoforge-${NEOFORGE_VERSION}`;
    const jsonPath = path.join(rootPath, 'versions', neoforgeVerId, `${neoforgeVerId}.json`);
    if (!fs.existsSync(jsonPath)) return 0;
    
    let json;
    try {
        json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
        return 0;
    }

    const libraries = json.libraries || [];
    const librariesDir = path.join(rootPath, 'libraries');
    let corrupted = 0;
    
    for (const lib of libraries) {
        let relPath = lib.downloads?.artifact?.path;
        if (!relPath && lib.name) {
            relPath = nameToPath(lib.name);
        }
        if (!relPath) continue;

        const filePath = path.join(librariesDir, ...relPath.split('/'));
        if (!fs.existsSync(filePath)) continue; // Will be downloaded by MCLC
        
        let isCorrupted = false;

        // 1. Check SHA1 if artifact.sha1 exists
        const expectedSha1 = lib.downloads?.artifact?.sha1;
        if (expectedSha1) {
            try {
                const hash = crypto.createHash('sha1');
                const stream = fs.createReadStream(filePath);
                for await (const chunk of stream) {
                    hash.update(chunk);
                }
                const actual = hash.digest('hex');
                
                if (actual !== expectedSha1) {
                    if (sendDebug) sendDebug(`SHA1 mismatch: ${relPath} (expected ${expectedSha1}, got ${actual}). Deleting.`);
                    isCorrupted = true;
                }
            } catch (e) {
                if (sendDebug) sendDebug(`Failed to verify SHA1 for ${relPath}: ${e.message}`);
            }
        }

        // 2. Check ZIP structure for JAR files if not already flagged as corrupted
        if (!isCorrupted && filePath.endsWith('.jar')) {
            try {
                const intact = await isZipIntact(filePath);
                if (!intact) {
                    if (sendDebug) sendDebug(`Corrupted JAR file detected (failed ZIP check): ${relPath}. Deleting.`);
                    isCorrupted = true;
                }
            } catch (e) {
                if (sendDebug) sendDebug(`Failed ZIP check for ${relPath}: ${e.message}`);
            }
        }

        if (isCorrupted) {
            try { fs.unlinkSync(filePath); } catch {}
            corrupted++;
        }
    }
    
    return corrupted;
}

module.exports = {
    ensureVanillaVersionFiles,
    preflightNeoForgeLibraries,
    ensureNeoForgeVersionJsonMerged,
    ensureAssetIndex,
    parseNeoForgeJvmArgs,
    verifyNeoForgeLibraries,
};
