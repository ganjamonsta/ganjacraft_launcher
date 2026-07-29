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
const PACKAGE_JSON = path.join(__dirname, 'package.json');
const PRIVATE_KEY_PATH = path.join(__dirname, 'private.pem');

// Deploy directories
const DEPLOY_WWW_DIR = path.resolve(__dirname, '../deploy_www');
const DEPLOY_FILES_DIR = path.join(DEPLOY_WWW_DIR, 'files');
const DEPLOY_API_DIR = path.join(DEPLOY_WWW_DIR, 'api/launcher/files');

// Ensure deploy dirs exist
if (!fs.existsSync(DEPLOY_API_DIR)) {
    fs.mkdirSync(DEPLOY_API_DIR, { recursive: true });
}



// Get Version
const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
const version = pkg.version;

// Find Archive
const files = fs.readdirSync(DIST_DIR);
const zipFile = files.find(f => f.endsWith('.zip') && !f.includes('blockmap') && !f.includes('-update')) || files.find(f => f.endsWith('.zip') && !f.includes('blockmap'));

if (!zipFile) {
    console.error('❌ Zip archive not found in dist/. Run "npm run build" first.');
    process.exit(1);
}

const sourceZip = path.join(DIST_DIR, zipFile);
console.log(`📦 Found full .zip: ${zipFile}`);

const updateZipName = `GanjaCraftLauncher-${version}-update.zip`;
const sourceUpdateZip = path.join(DIST_DIR, updateZipName);

console.log('⚡ Creating lightweight resources-only update zip...');
const resourcesDir = path.join(DIST_DIR, 'win-unpacked', 'resources');
try {
    const psCmd = `Compress-Archive -Path "${resourcesDir}" -DestinationPath "${sourceUpdateZip}" -Force`;
    execFileSync('powershell.exe', ['-Command', psCmd]);
    console.log(`✅ Update zip created: ${updateZipName}`);
} catch (e) {
    console.error('❌ Failed to create lightweight update zip, using full zip as fallback.', e.message);
    fs.copyFileSync(sourceZip, sourceUpdateZip);
}

// Get Update Zip Size
const updateStats = fs.statSync(sourceUpdateZip);
const zipSize = updateStats.size;
console.log(`📊 Update Zip Size: ${(zipSize / 1024 / 1024).toFixed(2)} MB`);

// Sign the archives
let signature = '';
let fullSignature = '';
if (fs.existsSync(PRIVATE_KEY_PATH)) {
    console.log('🔐 Signing updates...');
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
    
    const updateBuffer = fs.readFileSync(sourceUpdateZip);
    signature = crypto.sign(null, updateBuffer, privateKey).toString('base64');
    
    const fullBuffer = fs.readFileSync(sourceZip);
    fullSignature = crypto.sign(null, fullBuffer, privateKey).toString('base64');
} else {
    console.warn('⚠️  Private key not found. Updates will NOT be signed.');
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'ganjamonsta/ganjacraft_launcher';

// Upload to GitHub if token is provided
let githubDownloadUrl = null;
let githubUpdateDownloadUrl = null;

(async () => {
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

        // Helper to upload an asset
        const uploadAsset = async (filePath, fileName) => {
            console.log(`   -> Uploading ${fileName} to GitHub...`);
            const fileData = fs.readFileSync(filePath);
            
            if (assetsList) {
                const existingAsset = assetsList.find(a => a.name === fileName);
                if (existingAsset) {
                    console.log(`   -> Asset ${fileName} already exists. Deleting it first...`);
                    await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${existingAsset.id}`, {
                        method: 'DELETE',
                        headers: ghHeaders
                    });
                    assetsList = assetsList.filter(a => a.id !== existingAsset.id);
                }
            }

            const contentType = fileName.endsWith('.json') ? 'application/json' : (fileName.endsWith('.exe') ? 'application/octet-stream' : 'application/zip');
            const finalUploadUrl = `${uploadUrl}?name=${encodeURIComponent(fileName)}`;
            const uploadRes = await fetch(finalUploadUrl, {
                method: 'POST',
                headers: {
                    ...ghHeaders,
                    'Content-Type': contentType,
                    'Content-Length': fileData.length
                },
                body: fileData
            });

            if (!uploadRes.ok) {
                throw new Error(`Failed to upload asset ${fileName}: ${await uploadRes.text()}`);
            }

            console.log(`✅ Successfully uploaded ${fileName} to GitHub Releases!`);
            return `https://github.com/${GITHUB_REPO}/releases/download/${version}/${encodeURIComponent(fileName)}`;
        };

        // 2. Fetch asset list for deletion check
        let assetsList = null;
        const getAssetsRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/${releaseId}/assets`, { headers: ghHeaders });
        if (getAssetsRes.ok) {
            assetsList = await getAssetsRes.json();
        }

        githubDownloadUrl = await uploadAsset(sourceZip, zipFile);
        githubUpdateDownloadUrl = await uploadAsset(sourceUpdateZip, updateZipName);
        
        // 3. Prepare and upload bootstrap.json & GanjaCraft.exe
        const exeFile = 'GanjaCraft.exe';
        const exePath = path.join(DEPLOY_API_DIR, exeFile);
        if (fs.existsSync(exePath)) {
            const githubExeUrl = await uploadAsset(exePath, exeFile);
            
            const bootstrapJsonPath = path.join(DEPLOY_API_DIR, 'bootstrap.json');
            if (fs.existsSync(bootstrapJsonPath)) {
                const bootstrapData = JSON.parse(fs.readFileSync(bootstrapJsonPath, 'utf-8'));
                bootstrapData.url = githubExeUrl;
                fs.writeFileSync(bootstrapJsonPath, JSON.stringify(bootstrapData, null, 4));
                await uploadAsset(bootstrapJsonPath, 'bootstrap.json');
                console.log(`✅ Updated & uploaded bootstrap.json to GitHub URL`);
            }
        }

        const versionJsonPath = path.join(DEPLOY_API_DIR, 'version.json');
        const versionData = {
            version: version,
            url: githubUpdateDownloadUrl,
            fullUrl: githubDownloadUrl,
            signature: signature,
            fullSignature: fullSignature,
            zipSize: zipSize,
            releaseDate: new Date().toISOString(),
            type: "zip"
        };
        fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 4));
        await uploadAsset(versionJsonPath, 'version.json');
        console.log(`✅ Updated & uploaded version.json to GitHub URL`);

    } catch (e) {
        console.error('❌ GitHub Upload Error:', e.message);
        console.warn('⚠️ Falling back to SFTP for zips...');
    }
}

// Fallback version.json writing if GitHub token wasn't provided
const versionJsonPath = path.join(DEPLOY_API_DIR, 'version.json');
if (!fs.existsSync(versionJsonPath)) {
    const versionData = {
        version: version,
        url: githubUpdateDownloadUrl || `https://github.com/ganjamonsta/ganjacraft_launcher/releases/download/${version}/${encodeURIComponent(updateZipName)}`,
        fullUrl: githubDownloadUrl || `https://github.com/ganjamonsta/ganjacraft_launcher/releases/download/${version}/${encodeURIComponent(zipFile)}`,
        signature: signature,
        fullSignature: fullSignature,
        zipSize: zipSize,
        releaseDate: new Date().toISOString(),
        type: "zip"
    };
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 4));
}

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
    fs.copyFileSync(sourceZip, path.join(DEPLOY_API_DIR, zipFile));
} else {
    console.log(`ℹ️ Skipping copy of ${zipFile} to deploy_www because it's hosted on GitHub.`);
}

fs.copyFileSync(sourceUpdateZip, path.join(DEPLOY_API_DIR, updateZipName));

console.log('✅ Published successfully!');
console.log(`📁 Files ready in deploy_www/ for Nginx upload:`);
console.log(`   - deploy_www/api/launcher/files/${zipFile} (Full Install)`);
console.log(`   - deploy_www/api/launcher/files/${updateZipName} (Fast Update)`);
console.log(`   - deploy_www/api/launcher/files/version.json`);

})();

