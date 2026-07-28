/**
 * GanjaCraft Launcher - CurseForge Fingerprint Resolver Module
 * ИСКЛЮЧИТЕЛЬНО строгий резолвинг прямых CDN ссылок по Murmur2 хешам (POST /v1/fingerprints)
 * НИКАКОГО ТЕКСТОВОГО ПОИСКА И ПОДБОРА ИМЕН! Только 100% точные хеши.
 */

const https = require('https');

/**
 * Сформировать прямую ссылку на CurseForge Edge CDN
 */
function getCurseForgeDownloadUrl(fileObj) {
    if (!fileObj) return null;
    if (fileObj.downloadUrl) return fileObj.downloadUrl;
    if (fileObj.id && fileObj.fileName) {
        const id1 = Math.floor(fileObj.id / 1000);
        const id2 = fileObj.id % 1000;
        return `https://edge.forgecdn.net/files/${id1}/${id2}/${encodeURIComponent(fileObj.fileName)}`;
    }
    return null;
}

/**
 * Выполнить POST HTTP-запрос к CurseForge API (Fingerprints Batch)
 */
function makeCurseForgePostRequest(path, data, apiKey) {
    return new Promise((resolve) => {
        const payload = JSON.stringify(data);
        const req = https.request({
            hostname: 'api.curseforge.com',
            port: 443,
            path: path,
            method: 'POST',
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'x-api-key': apiKey
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(body));
                        return;
                    } catch (_) {}
                }
                resolve(null);
            });
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });

        req.write(payload);
        req.end();
    });
}

/**
 * Резолвинг прямых ссылок скачивания СТРОГО по Murmur2 хешам (1 Batch запрос)
 * НИКАКОГО поиска по названию файла.
 * @param {Array<{path: string, fingerprint?: number, murmur2?: number}>} files 
 * @param {string} apiKey 
 * @returns {Promise<Record<string, string>>} - Карта path -> downloadUrl
 */
async function resolveCurseForgeUrls(files, apiKey) {
    if (!apiKey || !files || files.length === 0) return {};

    const jarFiles = files.filter(f => f && typeof f.path === 'string' && f.path.endsWith('.jar'));
    if (jarFiles.length === 0) return {};

    const resultMap = {};
    const fpToPath = {};
    const fingerprintsList = [];

    // Собираем Murmur2 хеши из манифеста
    for (const f of jarFiles) {
        const fp = f.fingerprint || f.murmur2;
        if (fp && typeof fp === 'number') {
            fingerprintsList.push(fp);
            fpToPath[fp] = f.path;
        }
    }

    if (fingerprintsList.length === 0) return {};

    try {
        const fpRes = await makeCurseForgePostRequest('/v1/fingerprints', { fingerprints: fingerprintsList }, apiKey);
        if (fpRes && fpRes.data && fpRes.data.exactMatches && Array.isArray(fpRes.data.exactMatches)) {
            for (const match of fpRes.data.exactMatches) {
                if (match && match.file && match.file.id && match.file.fileName) {
                    const targetPath = fpToPath[match.id] || fpToPath[match.file.packageFingerprint] || fpToPath[match.file.fileFingerprint];
                    if (targetPath) {
                        const url = getCurseForgeDownloadUrl(match.file);
                        if (url) resultMap[targetPath] = url;
                    }
                }
            }
        }
    } catch (err) {
        console.warn(`[CurseForge Fingerprints] Warning: ${err.message}`);
    }

    return resultMap;
}

module.exports = { resolveCurseForgeUrls };
