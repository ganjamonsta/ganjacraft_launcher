/**
 * Ganj4Craft - Game Files Mirror Collector
 * Автоматический сборщик официальных файлов игры для размещения на внешнем VPS зеркале.
 * Сбирает ВСЮ игру: клиент, JSON версии, индекс ассетов, все библиотеки Minecraft и NeoForge, а также все ассеты игры (звуки, текстуры, шрифты).
 *
 * Использование:
 *   node scripts/collect-mirror.js [--output ./mirror] [--game-dir <path>] [--no-assets]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const {
    MC_VERSION,
    NEOFORGE_VERSION,
    VANILLA_VERSION_JSON_URL,
    VANILLA_VERSION_JAR_URL,
    NEOFORGE_INSTALLER_URL,
    AUTHLIB_INJECTOR_URL,
    MIRROR_FALLBACKS
} = require('../client/src/main-process/constants');

// Папки для поиска кэша по умолчанию
const DEFAULT_CACHE_DIRS = [
    's:\\Games\\Ganj4Craft Launcher\\game',
    's:\\Games\\LegacyLauncher_portable\\game',
    process.env.APPDATA ? path.join(process.env.APPDATA, '.minecraft') : '',
    path.join(__dirname, '../cache')
].filter(Boolean);

/**
 * Преобразовать имя библиотеки (maven coordinate) в относительный путь
 * Пример: "net.neoforged.fancymodloader:earlydisplay:4.0.42" -> "net/neoforged/fancymodloader/earlydisplay/4.0.42/earlydisplay-4.0.42.jar"
 */
function mavenNameToPath(name) {
    if (!name || typeof name !== 'string') return null;
    const [group, artifact, verAndMore] = name.split(':');
    if (!group || !artifact || !verAndMore) return null;
    const parts = verAndMore.split('@');
    const verPart = parts[0];
    const ext = parts[1] || 'jar';
    const verSub = verPart.split(':');
    const version = verSub[0];
    const classifier = verSub[1] ? `-${verSub[1]}` : '';
    const groupPath = group.replace(/\./g, '/');
    return `${groupPath}/${artifact}/${version}/${artifact}-${version}${classifier}.${ext}`;
}

/**
 * Получить список URL и относительных путей для библиотеки (включая classifiers)
 */
function getLibUrlAndPaths(lib) {
    const results = [];
    if (!lib) return results;

    const addEntry = (url, relPath, defaultRepo) => {
        if (!url && !relPath) return;
        let finalPath = relPath;
        if (!finalPath && url) {
            if (url.includes('libraries.minecraft.net/')) finalPath = url.split('libraries.minecraft.net/')[1];
            else if (url.includes('maven.neoforged.net/releases/')) finalPath = url.split('maven.neoforged.net/releases/')[1];
            else if (url.includes('maven.minecraftforge.net/')) finalPath = url.split('maven.minecraftforge.net/')[1];
            else finalPath = mavenNameToPath(lib.name);
        }
        let finalUrl = url;
        if (!finalUrl && finalPath) {
            const repo = (defaultRepo || lib.url || 'https://libraries.minecraft.net/').replace(/\/?$/, '/');
            finalUrl = `${repo}${finalPath}`;
        }
        if (finalUrl && finalPath) {
            results.push({ url: finalUrl, relPath: finalPath });
        }
    };

    if (lib.downloads) {
        if (lib.downloads.artifact) {
            addEntry(lib.downloads.artifact.url, lib.downloads.artifact.path, lib.url);
        }
        if (lib.downloads.classifiers && typeof lib.downloads.classifiers === 'object') {
            for (const key of Object.keys(lib.downloads.classifiers)) {
                const clf = lib.downloads.classifiers[key];
                if (clf) {
                    addEntry(clf.url, clf.path, lib.url);
                }
            }
        }
    } else if (lib.url || lib.name) {
        const pathFromName = mavenNameToPath(lib.name);
        if (pathFromName) {
            addEntry(null, pathFromName, lib.url);
        }
    }

    return results;
}

/**
 * Получить относительный путь зеркала по официальному URL
 */
function getMirrorRelativePath(url, customRelPath = null) {
    if (!url) return null;
    for (const rule of MIRROR_FALLBACKS) {
        if (url.startsWith(rule.from)) {
            const relative = customRelPath || url.slice(rule.from.length);
            const folderName = rule.to.replace(/\/$/, '').split('/').pop();
            return path.join(folderName, relative);
        }
    }
    if (url.includes('piston-meta.mojang.com/')) {
        return path.join('piston-meta', url.split('piston-meta.mojang.com/')[1]);
    }
    if (url.includes('piston-data.mojang.com/')) {
        return path.join('piston-data', url.split('piston-data.mojang.com/')[1]);
    }
    if (url.includes('maven.neoforged.net/releases/')) {
        return path.join('maven', customRelPath || url.split('maven.neoforged.net/releases/')[1]);
    }
    if (url.includes('libraries.minecraft.net/')) {
        return path.join('libraries', customRelPath || url.split('libraries.minecraft.net/')[1]);
    }
    if (url.includes('github.com/')) {
        return path.join('github', url.split('github.com/')[1]);
    }
    if (url.includes('resources.download.minecraft.net/')) {
        return path.join('assets', customRelPath || url.split('resources.download.minecraft.net/')[1]);
    }
    return null;
}

/**
 * Скачать файл по HTTPS с редиректами
 */
function downloadFileSimple(url, dest, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const file = fs.createWriteStream(dest);

        const req = https.get(url, { headers: { 'User-Agent': 'GanjaCraft-MirrorCollector/1.0' } }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
                file.close();
                try { fs.unlinkSync(dest); } catch {}
                downloadFileSimple(res.headers.location, dest, maxRedirects - 1).then(resolve).catch(reject);
                return;
            }

            if (res.statusCode !== 200) {
                file.close();
                try { fs.unlinkSync(dest); } catch {}
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }

            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        });

        req.on('error', (err) => {
            file.close();
            try { fs.unlinkSync(dest); } catch {}
            reject(err);
        });
    });
}

/**
 * Проверить и скопировать из локального кэша или скачать с официального URL
 */
async function collectFile(url, destPath, cacheCandidates = []) {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
        return { status: 'EXISTS', path: destPath };
    }

    // Пробуем скопировать из кэша
    for (const cand of cacheCandidates) {
        if (cand && fs.existsSync(cand) && fs.statSync(cand).size > 0) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(cand, destPath);
            return { status: 'COPIED', path: destPath, source: cand };
        }
    }

    // Скачиваем из интернета
    await downloadFileSimple(url, destPath);
    return { status: 'DOWNLOADED', path: destPath };
}

async function runCollector() {
    console.log('============================================================');
    console.log('        Ganj4Craft - Game Files Mirror Collector');
    console.log('============================================================');

    const args = process.argv.slice(2);
    let outputDir = path.join(__dirname, '../mirror');
    let includeAssets = true;
    const customCacheDirs = [...DEFAULT_CACHE_DIRS];

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--output' && args[i + 1]) {
            outputDir = path.resolve(args[++i]);
        } else if (args[i] === '--game-dir' && args[i + 1]) {
            customCacheDirs.unshift(path.resolve(args[++i]));
        } else if (args[i] === '--no-assets' || args[i] === '--libs-only') {
            includeAssets = false;
        }
    }

    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`[INFO] Папка зеркала: ${outputDir}`);
    console.log(`[INFO] Поиск локального кэша: ${customCacheDirs.join(', ')}`);
    console.log(`[INFO] Сбор ассетов игры: ${includeAssets ? 'ВКЛЮЧЕН (вся игра)' : 'ВЫКЛЮЧЕН (--no-assets)'}`);

    const filesToCollect = new Map();

    const addFile = (url, cachePaths = [], customRelPath = null) => {
        if (!url || typeof url !== 'string') return;
        const rel = getMirrorRelativePath(url, customRelPath);
        if (!rel) return;
        if (!filesToCollect.has(url)) {
            filesToCollect.set(url, { relative: rel, cachePaths: [] });
        }
        const item = filesToCollect.get(url);
        for (const p of cachePaths) {
            if (p && !item.cachePaths.includes(p)) {
                item.cachePaths.push(p);
            }
        }
    };

    // 1. Основные критичные файлы
    addFile(VANILLA_VERSION_JSON_URL, customCacheDirs.map(d => path.join(d, 'versions', MC_VERSION, `${MC_VERSION}.json`)));
    addFile(VANILLA_VERSION_JAR_URL, customCacheDirs.map(d => path.join(d, 'versions', MC_VERSION, `${MC_VERSION}.jar`)));
    addFile(NEOFORGE_INSTALLER_URL, customCacheDirs.map(d => path.join(d, `neoforge-${NEOFORGE_VERSION}-installer.jar`)));
    addFile(AUTHLIB_INJECTOR_URL, customCacheDirs.map(d => path.join(d, 'authlib-injector.jar')));

    const assetIndexUrl = 'https://piston-meta.mojang.com/v1/packages/d1aa1019d308e98dcd0cc6ee5da5cf19569d8c81/17.json';
    addFile(assetIndexUrl, customCacheDirs.map(d => path.join(d, 'assets', 'indexes', '17.json')));

    // 2. Скачиваем или читаем 1.21.1.json для списка библиотек Minecraft
    console.log('[INFO] Чтение Minecraft 1.21.1 JSON для списка библиотек...');
    const vanillaJsonRel = getMirrorRelativePath(VANILLA_VERSION_JSON_URL);
    const vanillaJsonDest = path.join(outputDir, vanillaJsonRel);
    await collectFile(VANILLA_VERSION_JSON_URL, vanillaJsonDest, customCacheDirs.map(d => path.join(d, 'versions', MC_VERSION, `${MC_VERSION}.json`)));

    let vanillaLibsCount = 0;
    try {
        const vanillaJson = JSON.parse(fs.readFileSync(vanillaJsonDest, 'utf8'));
        if (Array.isArray(vanillaJson.libraries)) {
            for (const lib of vanillaJson.libraries) {
                const entries = getLibUrlAndPaths(lib);
                for (const entry of entries) {
                    addFile(entry.url, customCacheDirs.map(d => path.join(d, 'libraries', entry.relPath)), entry.relPath);
                    vanillaLibsCount++;
                }
            }
        }
    } catch (e) {
        console.warn(`[WARN] Ошибка чтения 1.21.1.json: ${e.message}`);
    }

    // 3. Читаем NeoForge JSON для списка библиотек NeoForge
    console.log('[INFO] Чтение NeoForge JSON для списка библиотек...');
    const neoforgeVerId = `neoforge-${NEOFORGE_VERSION}`;
    let neoLibsCount = 0;
    for (const d of customCacheDirs) {
        const neoJsonPath = path.join(d, 'versions', neoforgeVerId, `${neoforgeVerId}.json`);
        if (fs.existsSync(neoJsonPath)) {
            try {
                const neoJson = JSON.parse(fs.readFileSync(neoJsonPath, 'utf8'));
                if (Array.isArray(neoJson.libraries)) {
                    for (const lib of neoJson.libraries) {
                        const entries = getLibUrlAndPaths(lib);
                        for (const entry of entries) {
                            addFile(entry.url, customCacheDirs.map(c => path.join(c, 'libraries', entry.relPath)), entry.relPath);
                            neoLibsCount++;
                        }
                    }
                }
                break;
            } catch {}
        }
    }

    // 4. Читаем индекс ассетов (17.json) для добавления ВСЕХ ассетов игры (звуки, текстуры, языковые файлы и т.д.)
    let assetsCount = 0;
    if (includeAssets) {
        console.log('[INFO] Чтение индекса ассетов 17.json для сбора всех ресурсов игры...');
        const assetIndexRel = getMirrorRelativePath(assetIndexUrl);
        const assetIndexDest = path.join(outputDir, assetIndexRel);
        await collectFile(assetIndexUrl, assetIndexDest, customCacheDirs.map(d => path.join(d, 'assets', 'indexes', '17.json')));

        try {
            const idxObj = JSON.parse(fs.readFileSync(assetIndexDest, 'utf8'));
            if (idxObj && idxObj.objects && typeof idxObj.objects === 'object') {
                for (const key of Object.keys(idxObj.objects)) {
                    const obj = idxObj.objects[key];
                    if (obj && obj.hash && typeof obj.hash === 'string') {
                        const prefix = obj.hash.slice(0, 2);
                        const assetUrl = `https://resources.download.minecraft.net/${prefix}/${obj.hash}`;
                        const relPath = `${prefix}/${obj.hash}`;
                        addFile(assetUrl, customCacheDirs.map(d => path.join(d, 'assets', 'objects', prefix, obj.hash)), relPath);
                        assetsCount++;
                    }
                }
            }
        } catch (e) {
            console.warn(`[WARN] Ошибка чтения 17.json: ${e.message}`);
        }
    }

    console.log(`[INFO] ВСЕГО ФАЙЛОВ ДЛЯ ЗЕРКАЛА: ${filesToCollect.size} (Minecraft libs: ${vanillaLibsCount}, NeoForge libs: ${neoLibsCount}, Ассеты игры: ${assetsCount})`);
    console.log('[INFO] Начинаем сбор и копирование...');

    let copied = 0;
    let downloaded = 0;
    let existing = 0;
    let failed = 0;
    let i = 1;

    for (const [url, item] of filesToCollect.entries()) {
        const dest = path.join(outputDir, item.relative);
        if (i % 10 === 0 || i === filesToCollect.size || i <= 5) {
            process.stdout.write(`\r[INFO] Обработка [${i}/${filesToCollect.size}]: ${item.relative.slice(0, 48).padEnd(48, ' ')}`);
        }
        i++;
        try {
            const res = await collectFile(url, dest, item.cachePaths);
            if (res.status === 'COPIED') copied++;
            else if (res.status === 'DOWNLOADED') downloaded++;
            else if (res.status === 'EXISTS') existing++;
        } catch (e) {
            failed++;
        }
    }
    console.log('');

    // Считаем общий размер
    let totalSize = 0;
    const countDir = (dir) => {
        if (!fs.existsSync(dir)) return;
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of list) {
            const full = path.join(dir, item.name);
            if (item.isDirectory()) countDir(full);
            else if (item.isFile()) totalSize += fs.statSync(full).size;
        }
    };
    countDir(outputDir);

    console.log('============================================================');
    console.log('        СБОР ПОЛНОГО ЗЕРКАЛА ИГРЫ ЗАВЕРШЕН!');
    console.log('============================================================');
    console.log(`Уже было в зеркале:     ${existing}`);
    console.log(`Скопировано из кэша:    ${copied}`);
    console.log(`Скачано с серверов:     ${downloaded}`);
    console.log(`Ошибок:                 ${failed}`);
    console.log(`Общий размер зеркала:   ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Папка для заливки:      ${outputDir}`);
    console.log('------------------------------------------------------------');
    console.log('Инструкция по развертыванию:');
    console.log('1. Залейте содержимое папки mirror на ваш веб-сервер VPS в папку /mirror');
    console.log('   (например, /home/container/www/files/mirror или /var/www/html/mirror).');
    console.log('2. Убедитесь, что файлы доступны по адресам https://ganj4craft.ru/mirror/<путь>');
    console.log('3. Лаунчер автоматически использует зеркало при недоступности официальных серверов!');
    console.log('============================================================');
}

runCollector().catch(e => {
    console.error('Критическая ошибка сборщика:', e);
    process.exit(1);
});
