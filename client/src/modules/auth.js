const https = require('https');
const crypto = require('crypto');

function authenticateYggdrasil(authUrl, username, token) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            agent: { name: "Minecraft", version: 1 },
            username: username,
            password: token,
            clientToken: crypto.randomUUID(),
            requestUser: true
        });

        const req = https.request(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
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
