const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const path = require('path');

function resolveUnderRoot(rootPath, relativePath) {
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
        throw new Error('Invalid manifest path');
    }

    // Disallow absolute paths and obvious traversal.
    if (path.isAbsolute(relativePath)) {
        throw new Error(`Absolute paths are not allowed in manifest: ${relativePath}`);
    }

    const rootResolved = path.resolve(rootPath);
    const destResolved = path.resolve(rootPath, relativePath);
    const rootWithSep = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;
    if (!destResolved.startsWith(rootWithSep)) {
        throw new Error(`Path traversal detected in manifest path: ${relativePath}`);
    }
    return destResolved;
}

function downloadFile(url, dest, options = {}) {
    const {
        timeoutMs = 30_000,
        expectedHash = null,
        expectedSize = null,
        maxRedirects = 5,
    } = options;

    return new Promise((resolve, reject) => {
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            reject(new Error(`Invalid URL: ${url}`));
            return;
        }

        if (parsedUrl.protocol !== 'https:') {
            reject(new Error(`Only https URLs are allowed: ${url}`));
            return;
        }

        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const tmpDest = `${dest}.tmp-${crypto.randomUUID()}`;

        const request = https.get(parsedUrl, (response) => {
            // Handle Redirects
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                if (maxRedirects <= 0) {
                    reject(new Error(`Too many redirects while downloading: ${url}`));
                    return;
                }
                const location = response.headers.location;
                if (!location) {
                    reject(new Error(`Redirect without Location header while downloading: ${url}`));
                    return;
                }

                let redirected;
                try {
                    redirected = new URL(location, parsedUrl);
                } catch {
                    reject(new Error(`Invalid redirect URL while downloading: ${url}`));
                    return;
                }

                downloadFile(redirected.toString(), dest, {
                    timeoutMs,
                    expectedHash,
                    expectedSize,
                    maxRedirects: maxRedirects - 1,
                }).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            
            const file = fs.createWriteStream(tmpDest);
            file.on('error', (err) => {
                try { if (fs.existsSync(tmpDest)) fs.unlinkSync(tmpDest); } catch {}
                reject(err);
            });

            response.on('aborted', () => {
                try { if (fs.existsSync(tmpDest)) fs.unlinkSync(tmpDest); } catch {}
                reject(new Error(`Download aborted: ${url}`));
            });
            response.on('error', (err) => {
                try { if (fs.existsSync(tmpDest)) fs.unlinkSync(tmpDest); } catch {}
                reject(err);
            });

            response.pipe(file);
            file.on('finish', async () => {
                try {
                    file.close();
                    if (typeof expectedSize === 'number' && expectedSize >= 0) {
                        const stats = fs.statSync(tmpDest);
                        if (stats.size !== expectedSize) {
                            try { fs.unlinkSync(tmpDest); } catch {}
                            reject(new Error(`Size mismatch after download: expected ${expectedSize}, got ${stats.size}`));
                            return;
                        }
                    }

                    if (typeof expectedHash === 'string' && expectedHash.length > 0) {
                        const actualHash = await getFileHash(tmpDest);
                        if (actualHash !== expectedHash) {
                            try { fs.unlinkSync(tmpDest); } catch {}
                            reject(new Error(`Hash mismatch after download`));
                            return;
                        }
                    }

                    // Replace destination atomically-ish.
                    try { if (fs.existsSync(dest)) fs.rmSync(dest, { force: true }); } catch {}
                    fs.renameSync(tmpDest, dest);
                    resolve();
                } catch (err) {
                    try { if (fs.existsSync(tmpDest)) fs.unlinkSync(tmpDest); } catch {}
                    reject(err);
                }
            });
        });

        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`Timeout downloading: ${url}`));
        });
        
        request.on('error', (err) => {
            try { if (fs.existsSync(tmpDest)) fs.unlinkSync(tmpDest); } catch {}
            reject(err);
        });
    });
}

function getFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function syncFiles(rootPath, manifestUrl, sendLog, onProgress, disabledMods = [], checkCancelled = () => false) {
    sendLog('Проверка обновлений...');
    
    // 1. Download Manifest
    const manifestPath = path.join(rootPath, 'manifest.json');
    try {
        await downloadFile(manifestUrl, manifestPath, { timeoutMs: 10_000 });
    } catch (e) {
        sendLog('Ошибка загрузки манифеста: ' + e.message);
        throw e;
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
        sendLog('Ошибка чтения манифеста: некорректный JSON');
        throw e;
    }

    if (!manifest || !Array.isArray(manifest.files)) {
        throw new Error('Invalid manifest format: files[] is missing');
    }

    sendLog(`Найдено ${manifest.files.length} файлов в манифесте.`);

    let processed = 0;
    let downloaded = 0;
    const totalFiles = manifest.files.length;
    const CONCURRENCY = 4; // Parallel downloads

    // Helper for concurrency
    async function processFile(file) {
        // Check Cancellation
        if (checkCancelled()) {
            throw new Error('CANCELLED');
        }

        // Check if disabled
        if (file && typeof file.path === 'string' && disabledMods.includes(file.path)) {
            const localPath = resolveUnderRoot(rootPath, file.path);
            if (fs.existsSync(localPath)) {
                sendLog(`Удаление отключенного мода: ${file.path}`);
                try { fs.rmSync(localPath, { force: true }); } catch {}
            }
            return;
        }

        if (!file || typeof file.path !== 'string' || typeof file.url !== 'string' || typeof file.hash !== 'string') {
            throw new Error('Invalid manifest file entry');
        }

        const localPath = resolveUnderRoot(rootPath, file.path);
        const localDir = path.dirname(localPath);

        // PROTECT USER OPTIONS vs FORCE UPDATE SERVER UI
        // Some files should always be updated (server-controlled UI/menus)
        // Others should be protected (user keybinds, graphics settings)
        const isServerControlled = (
            file.path.startsWith('fancymenu_data/') ||
            file.path.startsWith('config/fancymenu/') ||
            file.path.startsWith('config/fancymenu-') ||
            file.path.startsWith('resourcepacks/[GanjaCraft]') ||
            file.path.startsWith('kubejs/')
        );

        // User-controlled files: protect if they exist locally
        const isUserProtected = (
            file.path === 'options.txt' ||
            file.path === 'servers.dat' ||
            (file.path.startsWith('config/') && !isServerControlled)
        );

        if (isUserProtected && fs.existsSync(localPath)) {
            processed++;
            if (onProgress) {
                onProgress({ task: processed, total: totalFiles, type: 'mods' });
            }
            return;
        }

        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        let needDownload = false;

        if (!fs.existsSync(localPath)) {
            needDownload = true;
        } else {
            // Optimization: Check size first
            let sizeMismatch = false;
            if (file.size) {
                const stats = fs.statSync(localPath);
                if (stats.size !== file.size) {
                    sendLog(`Размер не совпадает: ${file.path}`);
                    sizeMismatch = true;
                    needDownload = true;
                }
            }

            if (!sizeMismatch) {
                // Check Hash
                const localHash = await getFileHash(localPath);
                if (localHash !== file.hash) {
                    // sendLog(`Хеш не совпадает: ${file.path}`); // Too verbose
                    needDownload = true;
                }
            }
        }

        if (needDownload) {
            // sendLog(`Загрузка: ${file.path}`); // Too verbose for 100+ files
            await downloadFile(file.url, localPath, {
                expectedHash: file.hash,
                expectedSize: typeof file.size === 'number' ? file.size : null,
            });
            downloaded++;
        }
        
        processed++;
        if (onProgress) {
            onProgress({ task: processed, total: totalFiles, type: 'mods' });
        }
    }

    // Run with concurrency limit
    const queue = [...manifest.files];
    const workers = [];

    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push((async () => {
            while (queue.length > 0) {
                const file = queue.shift();
                try {
                    await processFile(file);
                } catch (err) {
                    if (err.message === 'CANCELLED') throw err;
                    sendLog(`Ошибка обработки ${file.path}: ${err.message}`);
                    // Optional: Retry logic could go here
                    throw err; 
                }
            }
        })());
    }

    await Promise.all(workers);
    sendLog('Все файлы проверены.');

    // Cleanup: Remove unmanaged files in 'mods' directory
    const modsDir = path.join(rootPath, 'mods');
    if (fs.existsSync(modsDir)) {
        const localFiles = fs.readdirSync(modsDir);
        const manifestMods = new Set(
            manifest.files
                .filter(f => f.path.startsWith('mods/') && !disabledMods.includes(f.path))
                .map(f => path.normalize(f.path))
        );

        for (const file of localFiles) {
            const fullPath = path.join(modsDir, file);
            try {
                if (fs.statSync(fullPath).isDirectory()) continue;
            } catch (e) { continue; }

            const relativePath = path.join('mods', file);
            const normalizedPath = path.normalize(relativePath);

            if (!manifestMods.has(normalizedPath)) {
                sendLog(`Удаление лишнего файла: ${relativePath}`);
                try {
                    fs.unlinkSync(fullPath);
                } catch (e) {
                    sendLog(`Не удалось удалить ${relativePath}: ${e.message}`);
                }
            }
        }
    }

    // Cleanup: Remove unmanaged thingpacks (JsonThings custom content)
    const thingpacksDir = path.join(rootPath, 'thingpacks');
    if (fs.existsSync(thingpacksDir)) {
        const manifestThingpacks = new Set(
            manifest.files
                .filter(f => f.path.startsWith('thingpacks/'))
                .map(f => f.path.split('/')[1]) // Get thingpack folder name
        );

        const localThingpacks = fs.readdirSync(thingpacksDir);
        for (const pack of localThingpacks) {
            const fullPath = path.join(thingpacksDir, pack);
            try {
                if (!fs.statSync(fullPath).isDirectory()) continue;
            } catch (e) { continue; }

            if (!manifestThingpacks.has(pack)) {
                sendLog(`Удаление старого thingpack: ${pack}`);
                try {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                } catch (e) {
                    sendLog(`Не удалось удалить thingpack ${pack}: ${e.message}`);
                }
            }
        }
    }

    // Cleanup: Remove unmanaged KubeJS scripts (only in synced folders)
    // We only sync client_scripts, startup_scripts, and assets - leave server_scripts alone
    const kubejsDir = path.join(rootPath, 'kubejs');
    const kubejsSyncedFolders = ['client_scripts', 'startup_scripts', 'assets'];
    
    if (fs.existsSync(kubejsDir)) {
        // Get all manifest kubejs paths normalized
        const manifestKubejs = new Set(
            manifest.files
                .filter(f => f.path.startsWith('kubejs/'))
                .map(f => path.normalize(f.path))
        );

        // Recursively clean only synced kubejs subdirectories
        const cleanKubejsDir = (dir, relBase) => {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relPath = path.join(relBase, entry.name);
                const normalizedPath = path.normalize(relPath);

                if (entry.isDirectory()) {
                    cleanKubejsDir(fullPath, relPath);
                    // Remove empty directories
                    try {
                        const remaining = fs.readdirSync(fullPath);
                        if (remaining.length === 0) {
                            fs.rmdirSync(fullPath);
                        }
                    } catch (e) { /* ignore */ }
                } else {
                    if (!manifestKubejs.has(normalizedPath)) {
                        sendLog(`Удаление устаревшего скрипта: ${relPath}`);
                        try {
                            fs.unlinkSync(fullPath);
                        } catch (e) {
                            sendLog(`Не удалось удалить ${relPath}: ${e.message}`);
                        }
                    }
                }
            }
        };

        // Only clean synced folders, not the entire kubejs directory
        for (const folder of kubejsSyncedFolders) {
            const folderPath = path.join(kubejsDir, folder);
            if (fs.existsSync(folderPath)) {
                cleanKubejsDir(folderPath, path.join('kubejs', folder));
            }
        }
    }

    // Cleanup: Remove outdated [GanjaCraft] resourcepacks (server-controlled)
    const resourcepacksDir = path.join(rootPath, 'resourcepacks');
    if (fs.existsSync(resourcepacksDir)) {
        // Get manifest resourcepack names (only [GanjaCraft]* ones)
        const manifestResourcepacks = new Set(
            manifest.files
                .filter(f => f.path.startsWith('resourcepacks/') && f.path.includes('[GanjaCraft]'))
                .map(f => {
                    // resourcepacks/[GanjaCraft] Main/... -> [GanjaCraft] Main
                    const parts = f.path.split('/');
                    return parts[1] || '';
                })
                .filter(name => name.startsWith('[GanjaCraft]'))
        );

        const localPacks = fs.readdirSync(resourcepacksDir);
        for (const pack of localPacks) {
            // Only cleanup [GanjaCraft]* packs, leave user packs alone
            if (!pack.startsWith('[GanjaCraft]')) continue;

            const fullPath = path.join(resourcepacksDir, pack);
            
            if (!manifestResourcepacks.has(pack)) {
                sendLog(`Удаление устаревшего ресурспака: ${pack}`);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(fullPath);
                    }
                } catch (e) {
                    sendLog(`Не удалось удалить ${pack}: ${e.message}`);
                }
            }
        }
    }

    // Cleanup: Remove outdated fancymenu_data files (server-controlled UI)
    const fancymenuDir = path.join(rootPath, 'fancymenu_data');
    if (fs.existsSync(fancymenuDir)) {
        const manifestFancymenu = new Set(
            manifest.files
                .filter(f => f.path.startsWith('fancymenu_data/'))
                .map(f => path.normalize(f.path))
        );

        const cleanFancymenuDir = (dir, relBase) => {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relPath = path.join(relBase, entry.name);
                const normalizedPath = path.normalize(relPath);

                if (entry.isDirectory()) {
                    cleanFancymenuDir(fullPath, relPath);
                    try {
                        const remaining = fs.readdirSync(fullPath);
                        if (remaining.length === 0) {
                            fs.rmdirSync(fullPath);
                        }
                    } catch (e) { /* ignore */ }
                } else {
                    if (!manifestFancymenu.has(normalizedPath)) {
                        sendLog(`Удаление устаревшего UI файла: ${relPath}`);
                        try {
                            fs.unlinkSync(fullPath);
                        } catch (e) {
                            sendLog(`Не удалось удалить ${relPath}: ${e.message}`);
                        }
                    }
                }
            }
        };

        cleanFancymenuDir(fancymenuDir, 'fancymenu_data');
    }

    if (downloaded > 0) {
        sendLog(`Обновление завершено. Скачано: ${downloaded}`);
    } else {
        sendLog('Обновление завершено. Файлы проверены.');
    }
}

// === Admin Dev Tools Functions ===

/**
 * Sync a specific category of files from manifest
 * @param {string} rootPath - Game installation directory
 * @param {string} manifestUrl - URL to manifest.json
 * @param {string} category - Category to sync: 'mods', 'config', 'kubejs', 'resourcepacks', 'thingpacks'
 * @param {object} options - Sync options
 * @param {boolean} options.force - Force re-download all files (ignore hash match)
 * @param {string[]} options.kubejsFolders - KubeJS subfolders to sync
 * @param {function} options.sendLog - Log callback
 */
async function syncCategory(rootPath, manifestUrl, category, options = {}) {
    const { force = false, kubejsFolders = ['client_scripts', 'startup_scripts', 'server_scripts'], sendLog = () => {} } = options;

    // Download manifest
    const manifestPath = path.join(rootPath, 'manifest.json');
    try {
        await downloadFile(manifestUrl, manifestPath, { timeoutMs: 10_000 });
    } catch (e) {
        throw new Error(`Ошибка загрузки манифеста: ${e.message}`);
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
        throw new Error('Ошибка чтения манифеста: некорректный JSON');
    }

    if (!manifest || !Array.isArray(manifest.files)) {
        throw new Error('Invalid manifest format');
    }

    // Filter files by category
    let files = [];
    switch (category) {
        case 'mods':
            files = manifest.files.filter(f => f.path.startsWith('mods/') && f.path.endsWith('.jar'));
            break;
        case 'config':
            files = manifest.files.filter(f => f.path.startsWith('config/'));
            break;
        case 'kubejs':
            files = manifest.files.filter(f => {
                if (!f.path.startsWith('kubejs/')) return false;
                // Check if file is in selected subfolders
                const subPath = f.path.substring('kubejs/'.length);
                return kubejsFolders.some(folder => subPath.startsWith(folder + '/') || subPath === folder);
            });
            break;
        case 'resourcepacks':
            files = manifest.files.filter(f => f.path.startsWith('resourcepacks/'));
            break;
        case 'thingpacks':
            files = manifest.files.filter(f => f.path.startsWith('thingpacks/'));
            break;
        default:
            throw new Error(`Unknown category: ${category}`);
    }

    sendLog(`Найдено ${files.length} файлов в категории ${category}`);

    let downloaded = 0;
    let skipped = 0;

    for (const file of files) {
        if (!file || typeof file.path !== 'string' || typeof file.url !== 'string') {
            continue;
        }

        const localPath = resolveUnderRoot(rootPath, file.path);
        const localDir = path.dirname(localPath);

        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        let needDownload = force;

        if (!needDownload) {
            if (!fs.existsSync(localPath)) {
                needDownload = true;
            } else if (file.hash) {
                const localHash = await getFileHash(localPath);
                if (localHash !== file.hash) {
                    needDownload = true;
                }
            }
        }

        if (needDownload) {
            sendLog(`Загрузка: ${file.path}`);
            try {
                await downloadFile(file.url, localPath, {
                    expectedHash: force ? null : file.hash,
                    expectedSize: typeof file.size === 'number' ? file.size : null,
                });
                downloaded++;
            } catch (e) {
                sendLog(`Ошибка загрузки ${file.path}: ${e.message}`);
            }
        } else {
            skipped++;
        }
    }

    sendLog(`Готово. Скачано: ${downloaded}, пропущено: ${skipped}`);
    return { downloaded, skipped, total: files.length };
}

/**
 * Delete all files in a category
 * @param {string} rootPath - Game installation directory
 * @param {string} category - Category to delete
 */
async function deleteCategory(rootPath, category) {
    let targetPath;
    let deletePattern = null;

    switch (category) {
        case 'mods':
            targetPath = path.join(rootPath, 'mods');
            break;
        case 'config':
            targetPath = path.join(rootPath, 'config');
            break;
        case 'kubejs':
            targetPath = path.join(rootPath, 'kubejs');
            break;
        case 'resourcepacks':
            targetPath = path.join(rootPath, 'resourcepacks');
            deletePattern = /^\[GanjaCraft\]/; // Only delete server resourcepacks
            break;
        case 'thingpacks':
            targetPath = path.join(rootPath, 'thingpacks');
            break;
        default:
            throw new Error(`Unknown category: ${category}`);
    }

    if (!fs.existsSync(targetPath)) {
        return { deleted: 0, message: 'Папка не существует' };
    }

    let deleted = 0;

    if (deletePattern) {
        // Selective deletion (e.g., only [GanjaCraft] resourcepacks)
        const entries = fs.readdirSync(targetPath);
        for (const entry of entries) {
            if (deletePattern.test(entry)) {
                const fullPath = path.join(targetPath, entry);
                try {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    deleted++;
                } catch (e) {
                    console.error(`Failed to delete ${fullPath}:`, e);
                }
            }
        }
    } else {
        // Delete entire directory contents
        const entries = fs.readdirSync(targetPath);
        for (const entry of entries) {
            const fullPath = path.join(targetPath, entry);
            try {
                fs.rmSync(fullPath, { recursive: true, force: true });
                deleted++;
            } catch (e) {
                console.error(`Failed to delete ${fullPath}:`, e);
            }
        }
    }

    return { deleted, message: `Удалено ${deleted} элементов` };
}

/**
 * Count files in each category (both local and manifest)
 * @param {string} rootPath - Game installation directory
 * @param {string} manifestUrl - URL to manifest.json
 */
async function getCategoryCounts(rootPath, manifestUrl) {
    // Try to download fresh manifest
    let manifest = null;
    try {
        const manifestPath = path.join(rootPath, 'manifest.json');
        await downloadFile(manifestUrl, manifestPath, { timeoutMs: 10_000 });
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
        // Use local manifest if download fails
        try {
            const localManifest = path.join(rootPath, 'manifest.json');
            if (fs.existsSync(localManifest)) {
                manifest = JSON.parse(fs.readFileSync(localManifest, 'utf-8'));
            }
        } catch {}
    }

    const counts = {
        mods: { local: 0, manifest: 0 },
        config: { local: 0, manifest: 0 },
        kubejs: { local: 0, manifest: 0 },
        resourcepacks: { local: 0, manifest: 0 },
        thingpacks: { local: 0, manifest: 0 }
    };

    // Count local files
    const countLocalFiles = (dir, recursive = true) => {
        if (!fs.existsSync(dir)) return 0;
        let count = 0;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile()) {
                    count++;
                } else if (entry.isDirectory() && recursive) {
                    count += countLocalFiles(path.join(dir, entry.name), true);
                }
            }
        } catch {}
        return count;
    };

    counts.mods.local = countLocalFiles(path.join(rootPath, 'mods'), false);
    counts.config.local = countLocalFiles(path.join(rootPath, 'config'), true);
    counts.kubejs.local = countLocalFiles(path.join(rootPath, 'kubejs'), true);
    counts.resourcepacks.local = countLocalFiles(path.join(rootPath, 'resourcepacks'), true);
    counts.thingpacks.local = countLocalFiles(path.join(rootPath, 'thingpacks'), true);

    // Count manifest files
    if (manifest && Array.isArray(manifest.files)) {
        for (const f of manifest.files) {
            if (!f || typeof f.path !== 'string') continue;
            if (f.path.startsWith('mods/')) counts.mods.manifest++;
            else if (f.path.startsWith('config/')) counts.config.manifest++;
            else if (f.path.startsWith('kubejs/')) counts.kubejs.manifest++;
            else if (f.path.startsWith('resourcepacks/')) counts.resourcepacks.manifest++;
            else if (f.path.startsWith('thingpacks/')) counts.thingpacks.manifest++;
        }
    }

    return counts;
}

/**
 * Fetch server_scripts from admin manifest endpoint
 * Server scripts are normally NOT included in the regular manifest for players
 * @param {string} rootPath - Game installation directory
 * @param {string} manifestUrl - Base manifest URL (will request admin variant)
 * @param {function} sendLog - Log callback
 */
async function fetchServerScripts(rootPath, manifestUrl, sendLog = () => {}) {
    // For now, we'll just sync the kubejs/server_scripts from the regular manifest
    // In future, could add an admin-only endpoint with extended manifest
    
    sendLog('Загрузка server_scripts из манифеста...');
    
    const manifestPath = path.join(rootPath, 'manifest.json');
    try {
        await downloadFile(manifestUrl, manifestPath, { timeoutMs: 10_000 });
    } catch (e) {
        throw new Error(`Ошибка загрузки манифеста: ${e.message}`);
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
        throw new Error('Ошибка чтения манифеста');
    }

    if (!manifest || !Array.isArray(manifest.files)) {
        throw new Error('Invalid manifest format');
    }

    // Filter for server_scripts
    const serverScripts = manifest.files.filter(f => 
        f.path.startsWith('kubejs/server_scripts/')
    );

    if (serverScripts.length === 0) {
        sendLog('server_scripts не найдены в манифесте');
        return { downloaded: 0, message: 'Нет server_scripts в манифесте' };
    }

    sendLog(`Найдено ${serverScripts.length} server_scripts файлов`);

    let downloaded = 0;
    for (const file of serverScripts) {
        const localPath = resolveUnderRoot(rootPath, file.path);
        const localDir = path.dirname(localPath);

        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        sendLog(`Загрузка: ${file.path}`);
        try {
            await downloadFile(file.url, localPath, {
                expectedHash: file.hash,
                expectedSize: typeof file.size === 'number' ? file.size : null,
            });
            downloaded++;
        } catch (e) {
            sendLog(`Ошибка: ${e.message}`);
        }
    }

    sendLog(`Готово. Скачано: ${downloaded} файлов`);
    return { downloaded, total: serverScripts.length };
}

module.exports = { downloadFile, getFileHash, syncFiles, syncCategory, deleteCategory, getCategoryCounts, fetchServerScripts };
