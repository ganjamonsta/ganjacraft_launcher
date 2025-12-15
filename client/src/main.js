const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { Client, Authenticator } = require('minecraft-launcher-core');

const launcher = new Client();
const FORGE_VERSION = '1.20.1-47.4.0';
const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${FORGE_VERSION}/forge-${FORGE_VERSION}-installer.jar`;
const MANIFEST_URL = 'https://ganjacraft.ru/files/manifest.json';

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

function getFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function syncFiles(rootPath, sendLog) {
    sendLog('Проверка обновлений модпака...');
    
    // 1. Скачиваем манифест
    const manifestPath = path.join(rootPath, 'manifest.json');
    try {
        await downloadFile(MANIFEST_URL, manifestPath);
    } catch (e) {
        sendLog('Ошибка скачивания манифеста: ' + e.message);
        throw e;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    sendLog(`Найдено ${manifest.files.length} файлов в манифесте.`);

    let downloaded = 0;
    
    for (const file of manifest.files) {
        const localPath = path.join(rootPath, file.path);
        const localDir = path.dirname(localPath);

        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        let needDownload = false;

        if (!fs.existsSync(localPath)) {
            needDownload = true;
        } else {
            const localHash = await getFileHash(localPath);
            if (localHash !== file.hash) {
                needDownload = true;
            }
        }

        if (needDownload) {
            sendLog(`Скачивание: ${file.path} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            try {
                await downloadFile(file.url, localPath);
                downloaded++;
            } catch (e) {
                sendLog(`Ошибка скачивания ${file.path}: ${e.message}`);
            }
        }
    }

    if (downloaded > 0) {
        sendLog(`Обновление завершено. Скачано файлов: ${downloaded}`);
    } else {
        sendLog('Все файлы актуальны.');
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('src/index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Обработка запуска игры
ipcMain.handle('launch-game', async (event, options) => {
    const rootPath = path.join(app.getPath('appData'), '.ganjacraft');
    if (!fs.existsSync(rootPath)) fs.mkdirSync(rootPath, { recursive: true });

    const logFile = path.join(rootPath, 'launcher.log');
    // Очищаем лог при новом запуске
    fs.writeFileSync(logFile, `--- Log started at ${new Date().toISOString()} ---\n`);

    const sendLog = (msg) => {
        event.sender.send('log-message', msg);
        // Пишем в файл
        try {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
        } catch (e) {
            console.error("Failed to write log:", e);
        }
    };

    sendLog('Запуск игры с параметрами: ' + JSON.stringify(options));

    // Проверяем и качаем Forge
    const forgeInstallerPath = path.join(rootPath, `forge-${FORGE_VERSION}-installer.jar`);
    if (!fs.existsSync(forgeInstallerPath)) {
        sendLog('Скачивание Forge Installer...');
        try {
            await downloadFile(FORGE_INSTALLER_URL, forgeInstallerPath);
            sendLog('Forge Installer скачан.');
        } catch (e) {
            console.error('Failed to download Forge:', e);
            return { success: false, error: "Не удалось скачать Forge: " + e.message };
        }
    } else {
        sendLog('Forge Installer уже найден.');
    }

    // Синхронизация модов
    try {
        await syncFiles(rootPath, sendLog);
    } catch (e) {
        sendLog('ВНИМАНИЕ: Не удалось обновить моды. Игра может работать некорректно.');
        console.error(e);
    }

    const opts = {
        clientPackage: null, // null = ванильная версия, или url к zip
        authorization: Authenticator.getAuth(options.username), // Оффлайн/Пиратка режим для теста
        root: rootPath,
        version: {
            number: "1.20.1", // Версия майнкрафта
            type: "release"
        },
        forge: forgeInstallerPath, // Путь к инсталлеру Forge
        memory: {
            max: "6G", // Увеличил для модов
            min: "2G"
        }
    };

    sendLog('Запуск Minecraft Core...');
    
    try {
        launcher.on('debug', (e) => sendLog(`[DEBUG] ${e}`));
        launcher.on('data', (e) => sendLog(`[GAME] ${e}`));
        launcher.on('progress', (e) => sendLog(`[PROGRESS] ${e.type} - ${e.task} (${e.total})`));
        
        await launcher.launch(opts);
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: error.message };
    }
});
