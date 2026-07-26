const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables safely
const envDeployPath = path.join(__dirname, '.env.deploy');
try {
    require('./client/node_modules/dotenv').config({ path: envDeployPath });
} catch {
    try { require('dotenv').config({ path: envDeployPath }); } catch {}
}

const GAME_DIR = process.env.GAME_DIR || 's:\\Games\\LegacyLauncher_portable\\game\\home\\neoforge-21.1.233';
const BASE_URL = process.env.BASE_URL || 'https://gcrlauncher.share.zrok.io';
const FILES_BASE_URL = `${BASE_URL}/files`;

const DEPLOY_WWW_DIR = path.join(__dirname, 'deploy_www');
const DEPLOY_FILES_DIR = path.join(DEPLOY_WWW_DIR, 'files');
const CLIENT_MANIFEST_PATH = path.join(__dirname, 'client', 'manifest.json');

// Folders to include in manifest and sync
const INCLUDE_FOLDERS = [
    'mods',
    'config',
    'kubejs',
    'resourcepacks',
    'tacz',
    'defaultconfigs',
    'versions',
    'libraries'
];

// Individual root files to include
const INCLUDE_FILES = [
    'authlib-injector.jar',
    'forge-21.1.233-installer.jar'
];

// Ignored file/directory patterns
const IGNORE_PATTERNS = [
    'manifest.json',
    '.git',
    '__pycache__',
    'session.lock',
    'cache',
    'saves',
    'logs',
    'screenshots',
    'crash-reports',
    'options.txt',
    'servers.dat'
];

function shouldIgnore(relPath) {
    const norm = relPath.replace(/\\/g, '/');
    return IGNORE_PATTERNS.some(p => norm === p || norm.includes(`/${p}/`) || norm.endsWith(`/${p}`));
}

function isOptional(relPath) {
    const norm = relPath.replace(/\\/g, '/');
    if (norm.startsWith('mods/') && norm.endsWith('.jar')) {
        const filename = norm.split('/').pop().toLowerCase();
        return filename.startsWith('client-');
    }
    return false;
}

function getSha1(filePath) {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha1').update(buffer).digest('hex');
}

function getAllFiles(dir, baseDir = dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

        if (shouldIgnore(relPath)) return;

        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllFiles(fullPath, baseDir));
        } else {
            results.push({ fullPath, relPath, size: stat.size });
        }
    });

    return results;
}

function generateManifest() {
    console.log('\n======================================================');
    console.log('🔄 Сканирование сборки и генерация manifest.json...');
    console.log(`📁 Путь к сборке: ${GAME_DIR}`);
    console.log('======================================================');

    if (!fs.existsSync(GAME_DIR)) {
        console.warn(`⚠️ Директория сборки не найдена по пути: ${GAME_DIR}`);
        console.warn(`   Укажите корректный GAME_DIR в файле .env.deploy`);
        return;
    }

    let allCollectedFiles = [];

    // Scan included folders
    INCLUDE_FOLDERS.forEach(folder => {
        const folderPath = path.join(GAME_DIR, folder);
        if (fs.existsSync(folderPath)) {
            console.log(`🔍 Сканирование папки: ${folder}...`);
            const files = getAllFiles(folderPath, GAME_DIR);
            allCollectedFiles = allCollectedFiles.concat(files);
        }
    });

    // Scan individual root files
    INCLUDE_FILES.forEach(fileName => {
        const filePath = path.join(GAME_DIR, fileName);
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            allCollectedFiles.push({ fullPath: filePath, relPath: fileName, size: stat.size });
        }
    });

    console.log(`\n📊 Найдено файлов для манифеста: ${allCollectedFiles.length}`);

    // Build manifest entries
    const manifestFiles = [];
    fs.mkdirSync(DEPLOY_FILES_DIR, { recursive: true });

    allCollectedFiles.forEach(({ fullPath, relPath, size }) => {
        const hash = getSha1(fullPath);
        const url = `${FILES_BASE_URL}/${relPath}`;
        const optional = isOptional(relPath);

        manifestFiles.push({
            path: relPath,
            hash: hash,
            size: size,
            url: url,
            optional: optional
        });
    });

    // Sort entries by path
    manifestFiles.sort((a, b) => a.path.localeCompare(b.path));

    const manifestData = { files: manifestFiles };
    const manifestJsonString = JSON.stringify(manifestData, null, 2);

    // Save manifest.json to deploy_www/files/manifest.json
    const deployManifestPath = path.join(DEPLOY_FILES_DIR, 'manifest.json');
    fs.writeFileSync(deployManifestPath, manifestJsonString, 'utf-8');

    // Save manifest.json to client/manifest.json
    fs.mkdirSync(path.dirname(CLIENT_MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(CLIENT_MANIFEST_PATH, manifestJsonString, 'utf-8');

    console.log('✅ Манифест успешно сгенерирован и синхронизирован!');
    console.log(`   - ${deployManifestPath}`);
    console.log(`   - ${CLIENT_MANIFEST_PATH}`);
}

generateManifest();
