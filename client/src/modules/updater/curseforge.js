/**
 * GanjaCraft Launcher - CurseForge CDN Resolver Module
 * Поддержка скачивания модов с CurseForge CDN (edge.forgecdn.net)
 */

const https = require('https');

/**
 * Попробовать срезолвить CurseForge CDN URLs для хешей/файлов
 * @param {Array<{hash: string, path: string, url: string}>} files 
 * @returns {Promise<Record<string, string>>} - Карта sha1 -> cdn_url
 */
async function resolveCurseForgeUrls(files) {
    if (!files || files.length === 0) return {};
    
    // Результаты резолва
    const resultMap = {};
    return resultMap;
}

module.exports = { resolveCurseForgeUrls };
