/**
 * GanjaCraft Launcher - CurseForge CDN Resolver Module
 * Поддержка поиска и скачивания модов с CurseForge CDN (edge.forgecdn.net)
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
 * Выполнить GET HTTP-запрос к CurseForge API
 */
function makeCurseForgeApiRequest(path, apiKey) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.curseforge.com',
            port: 443,
            path: path,
            method: 'GET',
            timeout: 5000,
            headers: {
                'Accept': 'application/json',
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

        req.end();
    });
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
 * Запросить CurseForge API для поиска прямых ссылок скачивания
 * @param {Array<{path: string, hash?: string, fingerprint?: number, url: string}>} files 
 * @param {string} apiKey 
 * @returns {Promise<Record<string, string>>} - Карта path -> downloadUrl
 */
async function resolveCurseForgeUrls(files, apiKey) {
    if (!apiKey || !files || files.length === 0) return {};

    const jarFiles = files.filter(f => f && typeof f.path === 'string' && f.path.endsWith('.jar'));
    if (jarFiles.length === 0) return {};

    const resultMap = {};

    // 1. Попытка через Batch Fingerprints API (если отпечатки есть в манифесте)
    const fpToPath = {};
    const fingerprintsList = [];

    for (const f of jarFiles) {
        const fp = f.fingerprint || f.murmur2;
        if (fp && typeof fp === 'number') {
            fingerprintsList.push(fp);
            fpToPath[fp] = f.path;
        }
    }

    if (fingerprintsList.length > 0) {
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
        } catch (_) {}
    }

    // 2. Очищенный поиск по имени файла для модов без отпечка
    const unmappedFiles = jarFiles.filter(f => !resultMap[f.path]);
    for (const f of unmappedFiles) {
        const fullFilename = f.path.split(/[/\\]/).pop();
        const rawBasename = fullFilename.replace(/\.jar$/i, '');
        const cleanName = rawBasename.replace(/^client[-_]/i, '');

        let searchSlug = cleanName
            .split(/[-_]\d+/)[0]
            .split(/[-_](neoforge|forge|fabric|mc)/i)[0];

        if (!searchSlug || searchSlug.length < 2) continue;

        try {
            const url = await resolveSingleModUrl(searchSlug, fullFilename, cleanName, apiKey);
            if (url) {
                resultMap[f.path] = url;
            }
        } catch (_) {}
    }

    return resultMap;
}

/**
 * Найти ссылку скачивания для конкретного мода
 */
async function resolveSingleModUrl(searchSlug, fullFilename, cleanName, apiKey) {
    const searchRes = await makeCurseForgeApiRequest(`/v1/mods/search?gameId=432&searchFilter=${encodeURIComponent(searchSlug)}`, apiKey);
    if (!searchRes || !searchRes.data || !Array.isArray(searchRes.data) || searchRes.data.length === 0) {
        return null;
    }

    const targetJarLower = fullFilename.toLowerCase();
    const cleanJarLower = `${cleanName.toLowerCase()}.jar`;

    for (const mod of searchRes.data) {
        if (mod.latestFiles && Array.isArray(mod.latestFiles)) {
            for (const fileObj of mod.latestFiles) {
                if (!fileObj || !fileObj.fileName) continue;
                const fNameLower = fileObj.fileName.toLowerCase();

                if (fNameLower === targetJarLower || fNameLower === cleanJarLower) {
                    const dlUrl = getCurseForgeDownloadUrl(fileObj);
                    if (dlUrl) return dlUrl;
                }
            }
        }

        if (mod.id) {
            const filesRes = await makeCurseForgeApiRequest(`/v1/mods/${mod.id}/files?pageSize=50`, apiKey);
            if (filesRes && filesRes.data && Array.isArray(filesRes.data)) {
                for (const fileObj of filesRes.data) {
                    if (!fileObj || !fileObj.fileName) continue;
                    const fNameLower = fileObj.fileName.toLowerCase();

                    if (fNameLower === targetJarLower || fNameLower === cleanJarLower) {
                        const dlUrl = getCurseForgeDownloadUrl(fileObj);
                        if (dlUrl) return dlUrl;
                    }
                }

                for (const fileObj of filesRes.data) {
                    if (!fileObj || !fileObj.fileName) continue;
                    const fNameLower = fileObj.fileName.toLowerCase();
                    if (fNameLower.includes(searchSlug.toLowerCase()) && fNameLower.includes('1.21.1')) {
                        const dlUrl = getCurseForgeDownloadUrl(fileObj);
                        if (dlUrl) return dlUrl;
                    }
                }
            }
        }
    }

    return null;
}

module.exports = { resolveCurseForgeUrls };
