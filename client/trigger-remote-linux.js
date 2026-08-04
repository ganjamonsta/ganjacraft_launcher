const path = require('path');
const fs = require('fs');
const { Client, utils } = require('ssh2');
require('dotenv').config({ path: path.join(__dirname, '../.env.deploy') });

const host = process.env.REMOTE_LINUX_SSH_HOST;
const port = parseInt(process.env.REMOTE_LINUX_SSH_PORT || '22', 10);
const username = process.env.REMOTE_LINUX_SSH_USER;
const password = process.env.REMOTE_LINUX_SSH_PASS;
const privateKey = process.env.REMOTE_LINUX_SSH_KEY;
const passphrase = process.env.REMOTE_LINUX_SSH_PASSPHRASE;
const remotePath = process.env.REMOTE_LINUX_PATH || '~/ganjacraft_launcher';
const token = process.env.GITHUB_TOKEN;

if (!host || !username) {
    console.log('💡 Remote Linux SSH settings (REMOTE_LINUX_SSH_HOST, REMOTE_LINUX_SSH_USER) not set in .env.deploy.');
    console.log('   Skipping remote Debian build.');
    process.exit(0);
}

console.log(`🐧 Connecting to remote Debian server (${username}@${host}:${port})...`);

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected! Triggering Linux build on Debian server...');
    
    const cmd = `cd ${remotePath}/client && git pull && export GH_TOKEN="${token}" && npm run build:renderer && ./node_modules/.bin/electron-builder --linux -p always`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('❌ SSH Command failed:', err.message);
            conn.end();
            process.exit(1);
        }
        
        stream.on('close', (code) => {
            conn.end();
            if (code === 0) {
                console.log('🎉 Remote Linux build & publish completed successfully!');
            } else {
                console.error(`❌ Remote Linux build exited with code ${code}`);
            }
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).on('error', (err) => {
    console.warn(`⚠️ Remote SSH connection failed: ${err.message}. Skipping Linux build.`);
    process.exit(0);
});

const connectConfig = { host, port, username };
if (password) connectConfig.password = password;
if (privateKey && fs.existsSync(privateKey)) {
    connectConfig.privateKey = fs.readFileSync(privateKey);
    if (passphrase) connectConfig.passphrase = passphrase;
}

conn.connect(connectConfig);
