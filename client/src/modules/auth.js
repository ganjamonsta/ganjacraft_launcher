const https = require('https');
const http = require('http');

function authenticateYggdrasil(authUrl, username, token) {
    return new Promise((resolve, reject) => {
        // Use Node's built-in crypto.randomUUID (available in Node 16+)
        const clientToken = require('crypto').randomUUID();
        
        const data = JSON.stringify({
            agent: { name: "Minecraft", version: 1 },
            username: username,
            password: token,
            clientToken: clientToken,
            requestUser: true
        });

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

        req.setTimeout(10_000, () => {
            req.destroy(new Error('Auth request timeout'));
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

module.exports = { authenticateYggdrasil };
