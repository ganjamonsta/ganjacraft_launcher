const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { downloadFile } = require('./updater');

// Adoptium JRE 17 for Windows x64
const JAVA_URL_WIN = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse';

async function checkAndDownloadJava(dataDir, sendLog) {
    const runtimeDir = path.join(dataDir, 'runtime');
    const javaDir = path.join(runtimeDir, 'java');
    
    // 1. Check if local java exists
    const javaExec = process.platform === 'win32' 
        ? path.join(javaDir, 'bin', 'java.exe')
        : path.join(javaDir, 'bin', 'java');

    if (fs.existsSync(javaExec)) {
        sendLog('Используется локальная Java: ' + javaExec);
        return javaExec;
    }

    // 2. Check for System Java
    try {
        const systemJava = await checkSystemJava();
        if (systemJava) {
            sendLog('Найдена системная Java: ' + systemJava);
            return systemJava; // Return 'java' or path
        }
    } catch (e) {
        // Ignore error, proceed to download
    }

    // 3. Download if not found
    sendLog('Java не найдена. Скачивание JRE 17...');
    
    if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });

    const zipPath = path.join(runtimeDir, 'java.zip');
    const url = process.platform === 'win32' ? JAVA_URL_WIN : null;

    if (!url) {
        sendLog('Автоматическое скачивание Java не поддерживается для этой ОС. Используется системная Java.');
        return null; // Fallback to system java
    }

    try {
        await downloadFile(url, zipPath);
        sendLog('Java скачана. Распаковка...');

        await extractZip(zipPath, runtimeDir);
        sendLog('Распаковка завершена.');

        // Find the extracted folder (it usually has a versioned name)
        const files = fs.readdirSync(runtimeDir);
        const extractedFolder = files.find(f => {
            const fullPath = path.join(runtimeDir, f);
            return fs.statSync(fullPath).isDirectory() && f !== 'java';
        });
        
        if (extractedFolder) {
            const fullExtractedPath = path.join(runtimeDir, extractedFolder);
            // Rename to 'java'
            if (fs.existsSync(javaDir)) fs.rmSync(javaDir, { recursive: true, force: true });
            
            // Retry loop for rename (sometimes antivirus or file locks delay it)
            let retries = 3;
            while (retries > 0) {
                try {
                    fs.renameSync(fullExtractedPath, javaDir);
                    break;
                } catch (e) {
                    retries--;
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        // Cleanup zip
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

        if (fs.existsSync(javaExec)) {
            return javaExec;
        } else {
            throw new Error('Не удалось найти java.exe после распаковки.');
        }
    } catch (e) {
        sendLog('Ошибка при установке Java: ' + e.message);
        // Cleanup on failure
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        throw e;
    }
}

function checkSystemJava() {
    return new Promise((resolve) => {
        const check = spawn('java', ['-version']);
        let output = '';
        
        // java -version prints to stderr
        check.stderr.on('data', (data) => {
            output += data.toString();
        });

        check.on('error', () => resolve(null));
        
        check.on('close', (code) => {
            if (code === 0) {
                // Parse version
                // Examples: 
                // java version "1.8.0_311" -> 1.8 -> 8
                // openjdk version "17.0.2" -> 17
                const match = output.match(/version "(\d+)(\.(\d+))?/);
                if (match) {
                    let major = parseInt(match[1]);
                    if (major === 1) {
                        // Handle 1.8, 1.7 etc
                        major = parseInt(match[3]);
                    }
                    
                    if (major >= 17) {
                        resolve('java');
                        return;
                    }
                }
            }
            resolve(null);
        });
    });
}

function extractZip(zipPath, destDir) {
    return new Promise((resolve, reject) => {
        if (process.platform === 'win32') {
            // Use PowerShell to unzip
            const powershell = spawn('powershell.exe', [
                '-NoProfile',
                '-Command',
                `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`
            ]);
            
            powershell.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`PowerShell extraction failed with code ${code}`));
            });
            
            powershell.on('error', (err) => {
                reject(err);
            });
        } else {
            reject(new Error('Unzip not implemented for non-Windows yet.'));
        }
    });
}

module.exports = { checkAndDownloadJava };
