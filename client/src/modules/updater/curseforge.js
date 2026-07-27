/**
 * GanjaCraft Launcher - CurseForge CDN Resolver Module
 * Поддержка поиска и скачивания модов с CurseForge CDN (edge.forgecdn.net)
 */

const https = require('https');

/**
 * Запросить CurseForge API для поиска прямых ссылок скачивания
 * @param {Array<{path: string, hash?: string, url: string}>} files 
 * @param {string} apiKey 
 * @returns {Promise<Record<string, string>>} - Карта path -> downloadUrl
 */
async function resolveCurseForgeUrls(files, apiKey) {
    if (!apiKey || !files || files.length === 0) return {};

    const jarFiles = files.filter(f => f && typeof f.path === 'string' && f.path.endsWith('.jar'));
    if (jarFiles.length === 0) return {};

    const resultMap = {};

    for (const f of jarFiles) {
        const basename = f.path.split(/[/\\]/).pop().replace(/\.jar$/i, '');
        const slugMatch = basename.split(/[-_]/)[0];
        if (!slugMatch || slugMatch.length < 3) continue;

        try {
            const url = await searchCurseForgeMod(slugMatch, basename, apiKey);
            if (url) {
                resultMap[f.path] = url;
            }
        } catch (_) {}
    }

    return resultMap;
}

function searchCurseForgeMod(slug, fullFilename, apiKey) {
    return new Promise((resolve) => {
        const searchPath = `/v1/mods/search?gameId=432&searchFilter=${encodeURIComponent(slug)}`;
        
        const req = https.request({
            hostname: 'api.curseforge.com',
            port: 443,
            path: searchPath,
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
                        const parsed = JSON.parse(body);
                        if (parsed.data && Array.isArray(parsed.data)) {
                            for (const mod of parsed.data) {
                                if (mod.latestFiles && Array.isArray(mod.latestFiles)) {
                                    for (const fileObj of mod.latestFiles) {
                                        if (fileObj.downloadUrl && fileObj.fileName && 
                                            fileObj.fileName.toLowerCase() === `${fullFilename.toLowerCase()}.jar`) {
                                            resolve(fileObj.downloadUrl);
                                            return;
                                        }
                                    }
                                }
                            }
                        }
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

module.exports = { resolveCurseForgeUrls };
