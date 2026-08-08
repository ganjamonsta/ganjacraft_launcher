/**
 * GanjaCraft Launcher - File Downloader
 * Унифицированная функция загрузки файлов с поддержкой:
 * - Опциональной авторизации (X-Auth-Token)
 * - Атомарной записи через tmp файл
 * - Проверки хеша и размера
 * - Редиректов
 */

const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { getFileHash, safeUnlink, ensureDir, getTempPath } = require('./utils');

/**
 * Скачать файл по HTTPS
 * @param {string} url - URL файла
 * @param {string} dest - Путь назначения
 * @param {object} options - Опции
 * @param {number} options.timeoutMs - Таймаут в мс (default: 30000)
 * @param {string|null} options.expectedHash - Ожидаемый SHA1 хеш
 * @param {number|null} options.expectedSize - Ожидаемый размер в байтах
 * @param {number} options.maxRedirects - Макс. редиректов (default: 5)
 * @param {string|null} options.authToken - Токен авторизации (X-Auth-Token)
 * @param {boolean} options.createDir - Создавать директорию (default: true)
 * @param {boolean} options.atomicWrite - Атомарная запись через tmp (default: true)
 * @returns {Promise<void>}
 */
function downloadFile(url, dest, options = {}) {
    const {
        timeoutMs = 30_000,
        expectedHash = null,
        expectedSize = null,
        maxRedirects = 5,
        authToken = null,
        createDir = true,
        atomicWrite = true,
    } = options;

    return new Promise((resolve, reject) => {
        // Validate URL
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            reject(new Error(`Invalid URL: ${url}`));
            return;
        }

        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            reject(new Error(`Only http and https URLs are allowed: ${url}`));
            return;
        }

        // Create destination directory if needed
        if (createDir) {
            const destDir = path.dirname(dest);
            ensureDir(destDir);
        }

        // Use temp file for atomic writes
        const writePath = atomicWrite ? getTempPath(dest) : dest;

        // Build headers: send localtunnel bypass headers ONLY to localtunnel/zrok hosts
        const reqHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GanjaCraftLauncher/1.0'
        };
        if (parsedUrl.hostname.includes('loca.lt') || parsedUrl.hostname.includes('zrok.io')) {
            reqHeaders['User-Agent'] = 'localtunnel';
            reqHeaders['Bypass-Tunnel-Reminder'] = 'true';
        }
        if (authToken) {
            reqHeaders['X-Auth-Token'] = authToken;
        }

        // Build request options
        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            timeout: timeoutMs,
            headers: reqHeaders
        };

        const file = fs.createWriteStream(writePath);
        
        file.on('error', (err) => {
            safeUnlink(writePath);
            reject(err);
        });

        const httpModule = parsedUrl.protocol === 'https:' ? https : http;

        const req = httpModule.request(reqOptions, (res) => {
            // Handle redirects
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                file.close();
                safeUnlink(writePath);

                if (maxRedirects <= 0) {
                    reject(new Error(`Too many redirects: ${url}`));
                    return;
                }

                const location = res.headers.location;
                if (!location) {
                    reject(new Error(`Redirect without Location header: ${url}`));
                    return;
                }

                let redirectUrl;
                try {
                    redirectUrl = new URL(location, parsedUrl);
                } catch {
                    reject(new Error(`Invalid redirect URL: ${location}`));
                    return;
                }

                // Recurse with decremented redirects
                downloadFile(redirectUrl.toString(), dest, {
                    ...options,
                    maxRedirects: maxRedirects - 1
                }).then(resolve).catch(reject);
                return;
            }

            // Handle non-200 responses
            if (res.statusCode !== 200) {
                file.close();
                
                // Read response body for error details
                let body = '';
                res.on('data', chunk => body += chunk.toString());
                res.on('end', () => {
                    safeUnlink(writePath);
                    
                    let errorMsg = `HTTP ${res.statusCode}`;
                    if (body) {
                        try {
                            const parsed = JSON.parse(body);
                            if (parsed.detail) errorMsg += `: ${parsed.detail}`;
                            else if (parsed.message) errorMsg += `: ${parsed.message}`;
                        } catch {
                            if (body.length < 200) errorMsg += `: ${body}`;
                        }
                    }
                    reject(new Error(errorMsg));
                });
                return;
            }

            // Pipe response to file
            res.on('aborted', () => {
                safeUnlink(writePath);
                reject(new Error(`Download aborted: ${url}`));
            });
            
            res.on('error', (err) => {
                safeUnlink(writePath);
                reject(err);
            });

            res.pipe(file);

            file.on('finish', async () => {
                try {
                    file.close();

                    // Validate size
                    if (typeof expectedSize === 'number' && expectedSize >= 0) {
                        const stats = fs.statSync(writePath);
                        if (stats.size !== expectedSize) {
                            safeUnlink(writePath);
                            reject(new Error(`Size mismatch: expected ${expectedSize}, got ${stats.size}`));
                            return;
                        }
                    }

                    // Validate hash
                    if (typeof expectedHash === 'string' && expectedHash.length > 0) {
                        const actualHash = await getFileHash(writePath);
                        if (actualHash !== expectedHash) {
                            safeUnlink(writePath);
                            reject(new Error(`Hash mismatch: expected ${expectedHash}, got ${actualHash}`));
                            return;
                        }
                    }

                    // Atomic rename if using temp file
                    if (atomicWrite) {
                        try {
                            if (fs.existsSync(dest)) {
                                fs.rmSync(dest, { force: true });
                            }
                            fs.renameSync(writePath, dest);
                        } catch (err) {
                            safeUnlink(writePath);
                            reject(err);
                            return;
                        }
                    }

                    resolve();
                } catch (err) {
                    safeUnlink(writePath);
                    reject(err);
                }
            });
        });

        req.on('error', (err) => {
            file.close();
            safeUnlink(writePath);
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            file.close();
            safeUnlink(writePath);
            reject(new Error(`Timeout downloading: ${url}`));
        });

        req.end();
    });
}

/**
 * Скачать файл с автоматическими повторами при ошибке.
 * Покрывает периодические разрывы ZROK туннеля (~27 сек реконнект).
 * @param {string} url
 * @param {string} dest
 * @param {object} options - те же что у downloadFile
 * @param {number} maxRetries - количество попыток (default: 4)
 * @param {number} retryDelayMs - пауза между попытками в мс (default: 10000)
 */
async function downloadWithRetry(url, dest, options = {}, maxRetries = 4, retryDelayMs = 10_000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await downloadFile(url, dest, options);
            return;
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, retryDelayMs));
            }
        }
    }

    // Automatic mirror fallback if official repository failed
    try {
        const { getMirrorFallbackUrl } = require('../../main-process/constants');
        const mirrorUrl = getMirrorFallbackUrl(url);
        if (mirrorUrl && mirrorUrl !== url) {
            console.log(`[DOWNLOAD] Primary download failed for ${url} (${lastError?.message}). Retrying with mirror: ${mirrorUrl}`);
            for (let attempt = 1; attempt <= Math.min(maxRetries, 2); attempt++) {
                try {
                    await downloadFile(mirrorUrl, dest, options);
                    console.log(`[DOWNLOAD] Successfully downloaded from mirror: ${mirrorUrl}`);
                    return;
                } catch (err) {
                    lastError = err;
                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, retryDelayMs));
                    }
                }
            }
        }
    } catch (e) {
        console.warn(`[DOWNLOAD] Mirror fallback error for ${url}:`, e?.message);
    }

    throw lastError;
}

module.exports = { downloadFile, downloadWithRetry };
