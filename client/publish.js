const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execFileSync } = require('child_process');

// Load environment variables safely
const envDeployPath = path.join(__dirname, '../.env.deploy');
try {
    require('dotenv').config({ path: envDeployPath });
} catch {
    try { require('./node_modules/dotenv').config({ path: envDeployPath }); } catch {}
}

const BASE_URL = process.env.BASE_URL || 'https://gcrlauncher1.loca.lt';

const BOT_DIR_NAME = fs.existsSync(path.resolve(__dirname, '../../ganjacrafter_bot_renew')) ? 'ganjacrafter_bot_renew' : 'ganjacrafter_bot';

// Read API Token
const ENV_PATH = path.join(__dirname, `../../${BOT_DIR_NAME}/.env`);
let apiToken = '';
if (fs.existsSync(ENV_PATH)) {
    const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    const match = envContent.match(/API_AUTH_TOKEN=(.*)/);
    if (match) {
        apiToken = match[1].trim().replace(/['"]/g, '');
    }
}

const DIST_DIR = path.join(__dirname, 'dist');
// Target directory (Relative to repo root)
const TARGET_DIR = path.resolve(__dirname, `../../${BOT_DIR_NAME}/storage/launcher`);
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
console.log(`📦 Copying full .zip: ${zipFile}`);
fs.copyFileSync(sourceZip, targetZip);

// Create lightweight resources-only zip for fast updates
const updateZipName = `GanjaCraftLauncher-${version}-update.zip`;
const targetUpdateZip = path.join(TARGET_DIR, updateZipName);
const sourceUpdateZip = path.join(DIST_DIR, updateZipName);

console.log('⚡ Creating lightweight resources-only update zip...');
const resourcesDir = path.join(DIST_DIR, 'win-unpacked', 'resources');
try {
    // We use powershell to pack resources folder into a zip
    const psCmd = `Compress-Archive -Path "${resourcesDir}" -DestinationPath "${sourceUpdateZip}" -Force`;
    execFileSync('powershell.exe', ['-Command', psCmd]);
    fs.copyFileSync(sourceUpdateZip, targetUpdateZip);
    console.log(`✅ Update zip created: ${updateZipName}`);
} catch (e) {
    console.error('❌ Failed to create lightweight update zip, using full zip as fallback.', e.message);
    fs.copyFileSync(sourceZip, targetUpdateZip);
}

// Get Update Zip Size
const updateStats = fs.statSync(targetUpdateZip);
const zipSize = updateStats.size;
console.log(`📊 Update Zip Size: ${(zipSize / 1024 / 1024).toFixed(2)} MB`);

// Sign the update archive
let signature = '';
if (fs.existsSync(PRIVATE_KEY_PATH)) {
    console.log('🔐 Signing update...');
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
    const fileBuffer = fs.readFileSync(targetUpdateZip);
    signature = crypto.sign(null, fileBuffer, privateKey).toString('base64');
} else {
    console.warn('⚠️  Private key not found. Update will NOT be signed.');
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'ganjamonsta/ganjacraft_launcher';

// Upload to GitHub if token is provided
let githubDownloadUrl = null;

if (GITHUB_TOKEN) {
    console.log(`\n🐙 GITHUB_TOKEN found! Preparing to upload full launcher to GitHub Releases (${GITHUB_REPO})...`);
    try {
        const ghHeaders = {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'NodeJS/GanjaCraft-Publisher'
        };

        // 1. Get or Create Release
        let releaseId = null;
        let uploadUrl = null;
        
        console.log(`   -> Checking if release ${version} exists...`);
        const checkRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${version}`, {
            headers: ghHeaders
        });

        if (checkRes.ok) {
            const releaseData = await checkRes.json();
            releaseId = releaseData.id;
            uploadUrl = releaseData.upload_url.split('{')[0];
            console.log(`   -> Release exists (ID: ${releaseId})`);
        } else if (checkRes.status === 404) {
            console.log(`   -> Release not found. Creating new release ${version}...`);
            const createRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`, {
                method: 'POST',
                headers: { ...ghHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag_name: version,
                    name: `Launcher Update ${version}`,
                    body: `Full installer for GanjaCraft Launcher v${version}`,
                    draft: false,
                    prerelease: false
                })
            });
            if (!createRes.ok) {
                throw new Error(`Failed to create release: ${await createRes.text()}`);
            }
            const releaseData = await createRes.json();
            releaseId = releaseData.id;
            uploadUrl = releaseData.upload_url.split('{')[0];
            console.log(`   -> Created release (ID: ${releaseId})`);
        } else {
            throw new Error(`Failed to check release: ${await checkRes.text()}`);
        }

        // 2. Upload Asset
        console.log(`   -> Uploading ${zipFile} to GitHub... (This might take a minute depending on size)`);
        const fileData = fs.readFileSync(targetZip);
        
        // Ensure asset doesn't exist already to avoid upload errors
        const getAssetsRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/${releaseId}/assets`, { headers: ghHeaders });
        if (getAssetsRes.ok) {
            const assets = await getAssetsRes.json();
            const existingAsset = assets.find(a => a.name === zipFile);
            if (existingAsset) {
                console.log(`   -> Asset ${zipFile} already exists. Deleting it first...`);
                await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${existingAsset.id}`, {
                    method: 'DELETE',
                    headers: ghHeaders
                });
            }
        }

        const finalUploadUrl = `${uploadUrl}?name=${encodeURIComponent(zipFile)}`;
        const uploadRes = await fetch(finalUploadUrl, {
            method: 'POST',
            headers: {
                ...ghHeaders,
                'Content-Type': 'application/zip',
                'Content-Length': fileData.length
            },
            body: fileData
        });

        if (!uploadRes.ok) {
            throw new Error(`Failed to upload asset: ${await uploadRes.text()}`);
        }

        console.log(`✅ Successfully uploaded ${zipFile} to GitHub Releases!`);
        githubDownloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/${version}/${encodeURIComponent(zipFile)}`;

    } catch (e) {
        console.error('❌ GitHub Upload Error:', e.message);
        console.warn('⚠️ Falling back to SFTP for full zip...');
    }
}

// Update version.json (references the lightweight zip)
const versionJsonPath = path.join(TARGET_DIR, 'version.json');
const encodedFile = encodeURIComponent(updateZipName);
const versionData = {
    version: version,
    url: `${BASE_URL.replace(/\/$/, '')}/api/launcher/files/${encodedFile}`,
    fullUrl: githubDownloadUrl || `${BASE_URL.replace(/\/$/, '')}/api/launcher/files/${encodeURIComponent(zipFile)}`,
    signature: signature,
    zipSize: zipSize,
    releaseDate: new Date().toISOString(),
    type: "zip"
};

fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 4));

// Also populate deploy_www folder for easy upload to Nginx in Pterodactyl
const DEPLOY_WWW_DIR = path.resolve(__dirname, '../deploy_www');
const DEPLOY_FILES_DIR = path.join(DEPLOY_WWW_DIR, 'files');
const DEPLOY_API_DIR = path.join(DEPLOY_WWW_DIR, 'api/launcher/files');

fs.mkdirSync(DEPLOY_FILES_DIR, { recursive: true });
fs.mkdirSync(DEPLOY_API_DIR, { recursive: true });

// Clean old zips in deploy_www
if (fs.existsSync(DEPLOY_API_DIR)) {
    fs.readdirSync(DEPLOY_API_DIR).forEach(f => {
        if (f.startsWith('GanjaCraftLauncher-') && f.endsWith('.zip')) {
            try { fs.unlinkSync(path.join(DEPLOY_API_DIR, f)); } catch {}
        }
    });
}

// Copy new zips & version.json
if (!githubDownloadUrl) {
    // Only copy full zip to deploy_www if GitHub upload failed or wasn't used
    fs.copyFileSync(sourceZip, path.join(DEPLOY_API_DIR, zipFile));
} else {
    console.log(`ℹ️ Skipping copy of ${zipFile} to deploy_www because it's hosted on GitHub.`);
}

fs.copyFileSync(sourceUpdateZip, path.join(DEPLOY_API_DIR, updateZipName));
fs.writeFileSync(path.join(DEPLOY_API_DIR, 'version.json'), JSON.stringify(versionData, null, 4));

console.log('✅ Published successfully!');
console.log(`📁 Files ready in deploy_www/ for Nginx upload:`);
console.log(`   - deploy_www/api/launcher/files/${zipFile} (Full Install)`);
console.log(`   - deploy_www/api/launcher/files/${updateZipName} (Fast Update)`);
console.log(`   - deploy_www/api/launcher/files/version.json`);

// Old backend upload method is removed, replaced by GitHub and SFTP
})();

