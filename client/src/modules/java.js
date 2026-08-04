const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { downloadFile } = require('./updater');

const REQUIRED_JAVA_MAJOR = 21;

// Adoptium JRE 21 for Windows and Linux x64
const JAVA_URL_WIN = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse';
const JAVA_URL_LINUX = 'https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jre/hotspot/normal/eclipse';

function preferJavaw(javaCommandOrPath) {
    if (process.platform !== 'win32') return javaCommandOrPath;
    if (!javaCommandOrPath || typeof javaCommandOrPath !== 'string') return javaCommandOrPath;

    const lower = javaCommandOrPath.toLowerCase();
    if (lower === 'java') return 'javaw';
    if (lower === 'javaw') return 'javaw';

    if (lower.endsWith('java.exe')) {
        const candidate = javaCommandOrPath.replace(/java\.exe$/i, 'javaw.exe');
        try {
            if (fs.existsSync(candidate)) return candidate;
        } catch {}
    }
    return javaCommandOrPath;
}

/**
 * Умный резолвер пути к Java ("Защита от дурачка")
 * Автоматически находит javaw.exe/java.exe, даже если пользователь выберет папку, java.exe или сторонний файл в bin.
 */
function resolveJavaPath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') return inputPath;

    let trimmed = inputPath.trim().replace(/^["']|["']$/g, '');
    if (!trimmed) return trimmed;

    try {
        if (!fs.existsSync(trimmed)) {
            if (process.platform === 'win32' && !trimmed.toLowerCase().endsWith('.exe')) {
                if (fs.existsSync(trimmed + '.exe')) {
                    trimmed += '.exe';
                } else if (fs.existsSync(trimmed + 'w.exe')) {
                    trimmed += 'w.exe';
                }
            }
        }

        if (fs.existsSync(trimmed)) {
            const stat = fs.statSync(trimmed);

            if (stat.isDirectory()) {
                const candidates = process.platform === 'win32'
                    ? [
                        path.join(trimmed, 'bin', 'javaw.exe'),
                        path.join(trimmed, 'bin', 'java.exe'),
                        path.join(trimmed, 'javaw.exe'),
                        path.join(trimmed, 'java.exe'),
                    ]
                    : [
                        path.join(trimmed, 'bin', 'javaw'),
                        path.join(trimmed, 'bin', 'java'),
                        path.join(trimmed, 'javaw'),
                        path.join(trimmed, 'java'),
                    ];

                for (const candidate of candidates) {
                    if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
                        return preferJavaw(candidate);
                    }
                }
            } else {
                const dir = path.dirname(trimmed);
                const filename = path.basename(trimmed).toLowerCase();

                if (filename === 'javaw.exe' || filename === 'javaw') {
                    return trimmed;
                }
                if (filename === 'java.exe' || filename === 'java') {
                    return preferJavaw(trimmed);
                }

                const javawInDir = process.platform === 'win32'
                    ? path.join(dir, 'javaw.exe')
                    : path.join(dir, 'javaw');
                if (fs.existsSync(javawInDir)) {
                    return javawInDir;
                }

                const javaInDir = process.platform === 'win32'
                    ? path.join(dir, 'java.exe')
                    : path.join(dir, 'java');
                if (fs.existsSync(javaInDir)) {
                    return preferJavaw(javaInDir);
                }

                const parentBinJavaw = process.platform === 'win32'
                    ? path.join(dir, '..', 'bin', 'javaw.exe')
                    : path.join(dir, '..', 'bin', 'javaw');
                if (fs.existsSync(parentBinJavaw)) {
                    return parentBinJavaw;
                }
            }
        }
    } catch (err) {
        console.error('Error resolving Java path:', err);
    }

    return preferJavaw(trimmed);
}

function parseJavaMajor(versionOutput) {
    if (!versionOutput || typeof versionOutput !== 'string') return null;

    // Typical outputs:
    // - java version "1.8.0_361"
    // - openjdk version "17.0.9" 2023-10-17
    // - openjdk version "21" 2023-09-19
    const m = versionOutput.match(/version\s+"([^"]+)"/i);
    if (!m) return null;

    const v = m[1].trim();
    // Legacy: 1.8.x => major 8
    if (v.startsWith('1.')) {
        const parts = v.split('.');
        const major = Number.parseInt(parts[1], 10);
        return Number.isFinite(major) ? major : null;
    }

    const major = Number.parseInt(v.split('.')[0], 10);
    return Number.isFinite(major) ? major : null;
}

function getJavaVersionInfo(javaCommandOrPath, { timeoutMs = 5000 } = {}) {
    return new Promise((resolve) => {
        if (!javaCommandOrPath) return resolve(null);

        let output = '';
        let settled = false;

        const child = spawn(javaCommandOrPath, ['-version'], {
            windowsHide: true,
        });

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            try { child.kill(); } catch {}
            resolve(null);
        }, timeoutMs);

        const finish = (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (code !== 0 && !output) return resolve(null);
            const major = parseJavaMajor(output);
            if (!major) return resolve(null);
            resolve({ major, raw: output });
        };

        child.stdout?.on('data', (d) => { output += d.toString(); });
        child.stderr?.on('data', (d) => { output += d.toString(); });
        child.on('error', () => finish(1));
        child.on('close', (code) => finish(code));
    });
}

async function checkAndDownloadJava(dataDir, sendLog) {
    const runtimeDir = path.join(dataDir, 'runtime');
    const javaDir = path.join(runtimeDir, 'java');
    
    // 1. Check if local java exists
    const javaExec = process.platform === 'win32'
        ? path.join(javaDir, 'bin', 'java.exe')
        : path.join(javaDir, 'bin', 'java');
    const javawExec = process.platform === 'win32'
        ? path.join(javaDir, 'bin', 'javaw.exe')
        : null;
    const preferredLocalExec = (javawExec && fs.existsSync(javawExec)) ? javawExec : javaExec;

    if (fs.existsSync(javaExec)) {
        const info = await getJavaVersionInfo(preferredLocalExec);
        if (info && info.major >= 21 && info.major <= 22) {
            sendLog('Используется локальная Java 21: ' + preferredLocalExec);
            return preferredLocalExec;
        }
        sendLog(`Локальная Java найдена (Java ${info ? info.major : '?'}), но для NeoForge 1.21.1 требуется Java 21. Скачивание актуальной Java 21...`);
    }

    // 2. Check for System Java (must be Java 21 or 22 for NeoForge 1.21.1 compatibility)
    try {
        const systemJava = await checkSystemJava();
        if (systemJava && systemJava.major >= 21 && systemJava.major <= 22) {
            sendLog(`Найдена системная Java (подходит): Java ${systemJava.major}`);
            return systemJava.command; // typically 'java'
        } else if (systemJava && systemJava.major > 22) {
            sendLog(`Системная Java ${systemJava.major} несовместима с NeoForge 1.21.1 (требуется Java 21). Скачивание стабильной Java 21 JRE...`);
        }
    } catch (e) {
        // Ignore error, proceed to download
    }

    // 3. Download if not found (or system Java is too old)
    sendLog(`Подходящая Java не найдена. Скачивание JRE ${REQUIRED_JAVA_MAJOR}...`);
    
    if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });

    const isWin = process.platform === 'win32';
    const zipPath = path.join(runtimeDir, isWin ? 'java.zip' : 'java.tar.gz');
    const url = isWin ? JAVA_URL_WIN : JAVA_URL_LINUX;

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
            if (!isWin) {
                try { fs.chmodSync(javaExec, 0o755); } catch {}
            }
            const info = await getJavaVersionInfo(javaExec);
            if (!info || info.major < REQUIRED_JAVA_MAJOR) {
                throw new Error(`Скачанная Java имеет неподходящую версию. Требуется Java ${REQUIRED_JAVA_MAJOR}+.`);
            }
            return javaExec;
        } else {
            throw new Error('Не удалось найти бинарник Java после распаковки.');
        }
    } catch (e) {
        sendLog('Ошибка при установке Java: ' + e.message);
        // Cleanup on failure
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        throw e;
    }
}

function checkSystemJava() {
    return new Promise(async (resolve) => {
        if (process.platform === 'win32') {
            const infoW = await getJavaVersionInfo('javaw').catch(() => null);
            if (infoW && infoW.major >= REQUIRED_JAVA_MAJOR) {
                return resolve({ command: 'javaw', major: infoW.major, raw: infoW.raw });
            }
        }

        const info = await getJavaVersionInfo('java').catch(() => null);
        if (!info) return resolve(null);
        if (info.major < REQUIRED_JAVA_MAJOR) return resolve(null);
        resolve({ command: preferJavaw('java'), major: info.major, raw: info.raw });
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
            // Use tar on Linux/macOS
            const tar = spawn('tar', ['-xzf', zipPath, '-C', destDir]);
            tar.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Tar extraction failed with code ${code}`));
            });
            tar.on('error', (err) => {
                reject(err);
            });
        }
    });
}

module.exports = {
    REQUIRED_JAVA_MAJOR,
    parseJavaMajor,
    getJavaVersionInfo,
    checkAndDownloadJava,
    preferJavaw,
    resolveJavaPath,
};
