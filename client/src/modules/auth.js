const https = require('https');
const http = require('http');

function authenticateYggdrasilOnce(authUrl, username, token, clientVersion = null, manifestHash = null) {
    return new Promise((resolve, reject) => {
        // Use Node's built-in crypto.randomUUID (available in Node 16+)
        const clientToken = require('crypto').randomUUID();
        
        const payload = {
            agent: { name: "Minecraft", version: 1 },
            username: username,
            password: token,
            clientToken: clientToken,
            requestUser: true
        };
        if (clientVersion) payload.clientVersion = clientVersion;
        if (manifestHash) payload.manifestHash = manifestHash;

        const data = JSON.stringify(payload);

        const httpModule = authUrl.startsWith('https') ? https : http;

        const req = httpModule.request(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'User-Agent': 'localtunnel',
                'Bypass-Tunnel-Reminder': 'true'
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const response = JSON.parse(body);
                        resolve({
                            accessToken: response.accessToken,
                            clientToken: response.clientToken,
                            uuid: response.selectedProfile.id,
                            name: response.selectedProfile.name
                        });
                    } catch (e) {
                        reject(new Error("Invalid JSON response from auth server"));
                    }
                } else {
                    reject(new Error(`Auth failed: ${res.statusCode} - ${body}`));
                }
            });
        });

        req.setTimeout(25_000, () => {
            req.destroy(new Error('Auth request timeout (25s)'));
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function authenticateYggdrasil(authUrl, username, token, retries = 2, clientVersion = null, manifestHash = null) {
    const candidateUrls = Array.from(new Set([authUrl].filter(Boolean)));

    let lastError;
    for (const url of candidateUrls) {
        for (let i = 1; i <= retries; i++) {
            try {
                return await authenticateYggdrasilOnce(url, username, token, clientVersion, manifestHash);
            } catch (e) {
                lastError = e;
                if (i < retries) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
    }
    throw lastError;
}

module.exports = { authenticateYggdrasil };
