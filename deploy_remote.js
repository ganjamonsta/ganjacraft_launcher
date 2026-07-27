const path = require('path');
const fs = require('fs');

// Try loading .env.deploy or .env
const envDeployPath = path.join(__dirname, '.env.deploy');
try {
    require('./client/node_modules/dotenv').config({ path: envDeployPath });
} catch {
    try { require('dotenv').config({ path: envDeployPath }); } catch {}
}

const Client = require('./client/node_modules/ssh2-sftp-client');

const host = process.env.SFTP_HOST || '192.168.1.8';
const port = parseInt(process.env.SFTP_PORT || '2022', 10);
const username = process.env.SFTP_USER || '';
const password = process.env.SFTP_PASS || '';
const remotePath = process.env.SFTP_REMOTE_PATH || '/www';
const localDeployDir = path.join(__dirname, 'deploy_www');

async function deploy() {
    if (!username || !password || password === 'your_pterodactyl_password') {
        console.log('\n======================================================');
        console.log('⚠️  Авто-загрузка на сервер пропущена!');
        console.log('    Заполните SFTP данные в файле .env.deploy:');
        console.log('    SFTP_HOST, SFTP_PORT, SFTP_USER, SFTP_PASS');
        console.log('======================================================\n');
        return;
    }

    if (!fs.existsSync(localDeployDir)) {
        console.error('❌ Папка deploy_www не найдена. Сначала выполните сборку.');
        return;
    }

    const sftp = new Client();
    console.log(`\n🚀 Запуск SFTP авто-деплоя в Pterodactyl (${host}:${port})...`);

    try {
        await sftp.connect({
            host,
            port,
            username,
            password,
            retries: 2
        });

        console.log('✅ SFTP соединение установлено.');
        
        console.log(`📦 Загрузка сборок лаунчера в ${remotePath}...`);

        // Ensure remote dir exists
        try {
            await sftp.mkdir(remotePath, true);
        } catch (_) {}

        // Upload launcher build files (version.json, bootstrap.json, .exe, .zip)
        const localApiDir = path.join(localDeployDir, 'api', 'launcher', 'files');
        if (fs.existsSync(localApiDir)) {
            const apiFiles = fs.readdirSync(localApiDir);
            for (const file of apiFiles) {
                const localFile = path.join(localApiDir, file);
                const remoteFile = `${remotePath}/${file}`;
                console.log(`   -> Uploading ${file}`);
                await sftp.fastPut(localFile, remoteFile);
            }
        }

        console.log('\n🎉 УСПЕХ! Манифест и сборка лаунчера мгновенно выгружены на сервер!');
    } catch (err) {
        console.error(`❌ Ошибка SFTP загрузки: ${err.message}`);
    } finally {
        await sftp.end();
    }
}

deploy();
