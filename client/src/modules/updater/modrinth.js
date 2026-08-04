/**
 * GanjaCraft Launcher - Modrinth Resolver Module
 * Позволяет автоматически резолвить CDN ссылки Modrinth по SHA1 хешам модов
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let modrinthCache = null;
let cachePath = null;

function loadCache() {
    if (modrinthCache) return modrinthCache;
    try {
        const userData = app ? app.getPath('userData') : process.cwd();
        cachePath = path.join(userData, 'modrinth-cache.json');
        if (fs.existsSync(cachePath)) {
            modrinthCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        } else {
            modrinthCache = {};
        }
    } catch {
        modrinthCache = {};
    }
    return modrinthCache;
}

function saveCache() {
    if (modrinthCache && cachePath) {
        try {
            fs.writeFileSync(cachePath, JSON.stringify(modrinthCache, null, 2));
        } catch {}
    }
}

/**
 * Запросить Modrinth CDN URLs для списка SHA1 хешей (Batch Request)
 * @param {string[]} hashes - Массив SHA1 хешей файлов (.jar)
 * @returns {Promise<Record<string, string>>} - Карта sha1 -> cdn_url
 */
async function resolveModrinthUrls(hashes) {
    if (!hashes || hashes.length === 0) return {};

    const cache = loadCache();
    const resultMap = {};
    const missingHashes = [];

    // Check cache first
    for (const hash of hashes) {
        const h = hash.toLowerCase();
        if (cache[h] && cache[h].cdnUrl) {
            resultMap[h] = cache[h];
        } else {
            missingHashes.push(h);
        }
    }

    if (missingHashes.length === 0) return resultMap;

    // Modrinth API лимит 100 хешей за 1 запрос
    const BATCH_SIZE = 100;
    let hasUpdates = false;

    for (let i = 0; i < missingHashes.length; i += BATCH_SIZE) {
        const chunk = missingHashes.slice(i, i + BATCH_SIZE);
        try {
            const chunkMap = await resolveChunk(chunk);
            for (const [hash, data] of Object.entries(chunkMap)) {
                cache[hash] = data;
                resultMap[hash] = data;
                hasUpdates = true;
            }
        } catch (err) {
            console.warn(`[Modrinth] Warning: Failed to resolve batch: ${err.message}`);
        }
    }

    if (hasUpdates) {
        saveCache();
    }

    return resultMap;
}

function resolveChunk(hashes) {
    return new Promise((resolve) => {
        const payload = JSON.stringify({
            hashes: hashes,
            algorithm: 'sha1'
        });

        const req = https.request({
            hostname: 'api.modrinth.com',
            port: 443,
            path: '/v2/version_files',
            method: 'POST',
            timeout: 10_000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'User-Agent': 'ganjamonsta/ganjacraft-launcher/1.0.0 (contact@ganjacraft.ru)'
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(body);
                        const resultMap = {};
                        for (const hash of Object.keys(parsed)) {
                            const versionFile = parsed[hash];
                            if (versionFile && Array.isArray(versionFile.files) && versionFile.files.length > 0) {
                                const primaryFile = versionFile.files.find(f => f.primary) || versionFile.files[0];
                                if (primaryFile && primaryFile.url) {
                                    resultMap[hash.toLowerCase()] = {
                                        cdnUrl: primaryFile.url,
                                        projectId: versionFile.project_id || null
                                    };
                                }
                            }
                        }
                        resolve(resultMap);
                    } catch {
                        resolve({});
                    }
                } else {
                    resolve({});
                }
            });
        });

        req.on('error', () => resolve({}));
        req.on('timeout', () => {
            req.destroy();
            resolve({});
        });

        req.write(payload);
        req.end();
    });
}

module.exports = { resolveModrinthUrls };
