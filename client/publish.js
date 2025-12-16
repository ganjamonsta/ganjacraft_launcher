const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST_DIR = path.join(__dirname, 'dist');
// Target directory explicitly requested by user
const TARGET_DIR = 'D:\\GanjaCraft\\git\\ganjacrafter_bot\\storage\\launcher';
const PACKAGE_JSON = path.join(__dirname, 'package.json');
const PRIVATE_KEY_PATH = path.join(__dirname, 'private.pem');

// Ensure target dir exists
if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Get Version
const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
const version = pkg.version;

// Find Executable
const files = fs.readdirSync(DIST_DIR);
const exeFile = files.find(f => f.endsWith('.exe') && !f.includes('blockmap'));
const ymlFile = 'latest.yml';

if (!exeFile) {
    console.error('❌ Executable not found in dist/. Run "npm run build" first.');
    process.exit(1);
}

// Copy Executable
const sourceExe = path.join(DIST_DIR, exeFile);
const targetExe = path.join(TARGET_DIR, exeFile);
console.log(`📦 Copying .exe: ${exeFile}`);
fs.copyFileSync(sourceExe, targetExe);

// Sign the executable
let signature = '';
if (fs.existsSync(PRIVATE_KEY_PATH)) {
    console.log('🔐 Signing update...');
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
    const fileBuffer = fs.readFileSync(sourceExe);
    signature = crypto.sign(null, fileBuffer, privateKey).toString('base64');
} else {
    console.warn('⚠️  Private key not found. Update will NOT be signed.');
}

// Copy latest.yml (Required for electron-updater)
const sourceYml = path.join(DIST_DIR, ymlFile);
const targetYml = path.join(TARGET_DIR, ymlFile);

if (fs.existsSync(sourceYml)) {
    console.log(`📄 Copying latest.yml`);
    fs.copyFileSync(sourceYml, targetYml);
} else {
    console.warn('⚠️ latest.yml not found! Auto-updates might not work.');
}

// Update version.json (For legacy clients to upgrade to this version)
const versionJsonPath = path.join(TARGET_DIR, 'version.json');
const versionData = {
    version: version,
    url: `https://ganjacraft.ru/api/launcher/files/${exeFile}`,
    signature: signature,
    releaseDate: new Date().toISOString()
};

fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 4));

console.log('✅ Published successfully!');
console.log(`   Updated version.json: ${JSON.stringify(versionData, null, 2)}`);

