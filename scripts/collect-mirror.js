/**
 * GanjaCraft - Game Files Mirror Collector
 * Автоматический сборщик официальных файлов игры для размещения на внешнем VPS зеркале.
 *
 * Использование:
 *   node scripts/collect-mirror.js [--output ./mirror] [--game-dir <path>]
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
    URL_REWRITES
} = require('../client/src/main-process/constants');

// Папки для поиска кэша по умолчанию
const DEFAULT_CACHE_DIRS = [
    's:\\Games\\LegacyLauncher_portable\\game',
    process.env.APPDATA ? path.join(process.env.APPDATA, '.minecraft') : '',
    path.join(__dirname, '../cache')
].filter(Boolean);

/**
 * Получить относительный путь зеркала по официальному URL
 */
function getMirrorRelativePath(url) {
    if (!url) return null;
    for (const rule of URL_REWRITES) {
        if (url.startsWith(rule.from)) {
            const prefix = rule.to.split('/').pop() || rule.to.split('/').slice(-2)[0];
            // rule.to = 'https://ganj4craft.ru/mirror/libraries/' -> prefix 'libraries'
            const relative = url.slice(rule.from.length);
            const folderName = rule.to.replace(/\/$/, '').split('/').pop();
            return path.join(folderName, relative);
        }
    }
    // Fallback для известных хостов
    if (url.includes('piston-meta.mojang.com/')) {
        return path.join('piston-meta', url.split('piston-meta.mojang.com/')[1]);
    }
    if (url.includes('piston-data.mojang.com/')) {
        return path.join('piston-data', url.split('piston-data.mojang.com/')[1]);
    }
    if (url.includes('maven.neoforged.net/releases/')) {
        return path.join('maven', url.split('maven.neoforged.net/releases/')[1]);
    }
    if (url.includes('libraries.minecraft.net/')) {
        return path.join('libraries', url.split('libraries.minecraft.net/')[1]);
    }
    if (url.includes('github.com/')) {
        return path.join('github', url.split('github.com/')[1]);
    }
    if (url.includes('resources.download.minecraft.net/')) {
        return path.join('assets', url.split('resources.download.minecraft.net/')[1]);
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
    console.log('        GanjaCraft - Game Files Mirror Collector');
    console.log('============================================================');

    const args = process.argv.slice(2);
    let outputDir = path.join(__dirname, '../mirror');
    const customCacheDirs = [...DEFAULT_CACHE_DIRS];

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--output' && args[i + 1]) {
            outputDir = path.resolve(args[++i]);
        } else if (args[i] === '--game-dir' && args[i + 1]) {
            customCacheDirs.unshift(path.resolve(args[++i]));
        }
    }

    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`[INFO] Папка зеркала: ${outputDir}`);
    console.log(`[INFO] Поиск локального кэша: ${customCacheDirs.join(', ')}`);

    const filesToCollect = new Map();

    const addFile = (url, cachePaths = []) => {
        if (!url || typeof url !== 'string') return;
        const rel = getMirrorRelativePath(url);
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

    // 2. Скачиваем или читаем 1.21.1.json для парсинга библиотек
    console.log('[INFO] Подготовка Minecraft 1.21.1 JSON для списка библиотек...');
    const vanillaJsonRel = getMirrorRelativePath(VANILLA_VERSION_JSON_URL);
    const vanillaJsonDest = path.join(outputDir, vanillaJsonRel);
    await collectFile(VANILLA_VERSION_JSON_URL, vanillaJsonDest, customCacheDirs.map(d => path.join(d, 'versions', MC_VERSION, `${MC_VERSION}.json`)));

    let vanillaLibsCount = 0;
    try {
        const vanillaJson = JSON.parse(fs.readFileSync(vanillaJsonDest, 'utf8'));
        if (Array.isArray(vanillaJson.libraries)) {
            for (const lib of vanillaJson.libraries) {
                if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.url && lib.downloads.artifact.path) {
                    const libUrl = lib.downloads.artifact.url;
                    const libPath = lib.downloads.artifact.path;
                    addFile(libUrl, customCacheDirs.map(d => path.join(d, 'libraries', libPath)));
                    vanillaLibsCount++;
                }
            }
        }
    } catch (e) {
        console.warn(`[WARN] Ошибка чтения 1.21.1.json: ${e.message}`);
    }

    // 3. Читаем локальный NeoForge JSON если есть (из кэша)
    const neoforgeVerId = `neoforge-${NEOFORGE_VERSION}`;
    let neoLibsCount = 0;
    for (const d of customCacheDirs) {
        const neoJsonPath = path.join(d, 'versions', neoforgeVerId, `${neoforgeVerId}.json`);
        if (fs.existsSync(neoJsonPath)) {
            try {
                const neoJson = JSON.parse(fs.readFileSync(neoJsonPath, 'utf8'));
                if (Array.isArray(neoJson.libraries)) {
                    for (const lib of neoJson.libraries) {
                        const libUrl = lib.url ? `${lib.url}${lib.name.replace(/\./g, '/')}` : (lib.downloads && lib.downloads.artifact ? lib.downloads.artifact.url : null);
                        const libPath = lib.downloads && lib.downloads.artifact ? lib.downloads.artifact.path : null;
                        if (libUrl && libPath) {
                            addFile(libUrl, customCacheDirs.map(c => path.join(c, 'libraries', libPath)));
                            neoLibsCount++;
                        }
                    }
                }
                break;
            } catch {}
        }
    }

    console.log(`[INFO] Найдено файлов для зеркала: ${filesToCollect.size} (Minecraft libs: ${vanillaLibsCount}, NeoForge libs: ${neoLibsCount})`);

    let copied = 0;
    let downloaded = 0;
    let existing = 0;
    let failed = 0;
    let i = 1;

    for (const [url, item] of filesToCollect.entries()) {
        const dest = path.join(outputDir, item.relative);
        process.stdout.write(`\r[INFO] Обработка [${i++}/${filesToCollect.size}]: ${item.relative.slice(0, 50).padEnd(50, ' ')}`);
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
    console.log('        СБОР ЗЕРКАЛА ЗАВЕРШЕН УСПЕШНО!');
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
