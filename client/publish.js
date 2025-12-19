const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Read API Token
const ENV_PATH = path.join(__dirname, '../../ganjacrafter_bot/.env');
let apiToken = '';
if (fs.existsSync(ENV_PATH)) {
    const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    const match = envContent.match(/API_AUTH_TOKEN=(.*)/);
    if (match) {
        apiToken = match[1].trim().replace(/['"]/g, '');
    }
}

const DIST_DIR = path.join(__dirname, 'dist');
// Target directory explicitly requested by user
const TARGET_DIR = 'D:\\GanjaCraft\\git\\ganjacrafter_bot\\storage\\launcher';
const PACKAGE_JSON = path.join(__dirname, 'package.json');
const PRIVATE_KEY_PATH = path.join(__dirname, 'private.pem');

// Ensure target dir exists
if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Clean up old versions in target dir
console.log('🧹 Cleaning up old versions on server...');
const targetFiles = fs.readdirSync(TARGET_DIR);
targetFiles.forEach(file => {
    // Delete old launcher archives (GanjaCraftLauncher-*.zip)
    if (file.startsWith('GanjaCraftLauncher-') && file.endsWith('.zip')) {
        console.log(`   Deleting old file: ${file}`);
        fs.unlinkSync(path.join(TARGET_DIR, file));
    }
});

// Get Version
const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
const version = pkg.version;

// Find Archive
const files = fs.readdirSync(DIST_DIR);
const zipFile = files.find(f => f.endsWith('.zip') && !f.includes('blockmap'));

if (!zipFile) {
    console.error('❌ Zip archive not found in dist/. Run "npm run build" first.');
    process.exit(1);
}

// Copy Archive
const sourceZip = path.join(DIST_DIR, zipFile);
const targetZip = path.join(TARGET_DIR, zipFile);
console.log(`📦 Copying .zip: ${zipFile}`);
fs.copyFileSync(sourceZip, targetZip);

// Sign the archive
let signature = '';
if (fs.existsSync(PRIVATE_KEY_PATH)) {
    console.log('🔐 Signing update...');
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
    const fileBuffer = fs.readFileSync(sourceZip);
    signature = crypto.sign(null, fileBuffer, privateKey).toString('base64');
} else {
    console.warn('⚠️  Private key not found. Update will NOT be signed.');
}

// Update version.json
const versionJsonPath = path.join(TARGET_DIR, 'version.json');
const encodedFile = encodeURIComponent(zipFile);
const versionData = {
    version: version,
    url: `https://ganjacraft.ru/api/launcher/files/${encodedFile}`,
    signature: signature,
    releaseDate: new Date().toISOString(),
    type: "zip"
};

fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 4));

console.log('✅ Published successfully!');
console.log(`   Updated version.json: ${JSON.stringify(versionData, null, 2)}`);

async function uploadFile(filePath) {
    if (!apiToken) {
        console.warn('⚠️ API Token not found. Skipping upload.');
        return;
    }
    
    const fileName = path.basename(filePath);
    const url = 'https://ganjacraft.ru/api/admin/upload/launcher';
    console.log(`☁️ Uploading ${fileName} to ${url}...`);
    
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);
    const formData = new FormData();
    formData.append('file', blob, fileName);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-API-Token': apiToken
            },
            body: formData
        });
        
        if (response.ok) {
            console.log(`✅ Upload success: ${fileName}`);
        } else {
            console.error(`❌ Upload failed: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
        }
    } catch (e) {
        console.error(`❌ Upload error: ${e.message}`);
    }
}

(async () => {
    await uploadFile(targetZip);
    await uploadFile(versionJsonPath);
})();

