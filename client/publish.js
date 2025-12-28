const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execFileSync } = require('child_process');

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
// Target directory (Relative to repo root)
const TARGET_DIR = path.resolve(__dirname, '../../ganjacrafter_bot/storage/launcher');
const PACKAGE_JSON = path.join(__dirname, 'package.json');
const PRIVATE_KEY_PATH = path.join(__dirname, 'private.pem');

const CLIENT_EXTRACT_DIR = path.join(TARGET_DIR, 'client');
const CLIENT_MANIFEST_NAME = 'client-manifest.json';
const CLIENT_MANIFEST_PATH = path.join(TARGET_DIR, CLIENT_MANIFEST_NAME);

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

function tryExtractZip(zipPath, outDir) {
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outDir, { recursive: true });

    // Prefer tar (available on modern Windows + Linux). Fallback to PowerShell.
    try {
        execFileSync('tar', ['-xf', zipPath, '-C', outDir], { stdio: 'ignore' });
        return;
    } catch (e) {
        // continue
    }

    if (process.platform === 'win32') {
        // Expand-Archive requires PowerShell 5+ (present on Win10/11)
        const ps = 'powershell';
        const cmd = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force`;
        execFileSync(ps, ['-NoProfile', '-NonInteractive', '-Command', cmd], { stdio: 'ignore' });
        return;
    }

    throw new Error('No ZIP extractor available (tar failed, and not Windows for PowerShell fallback)');
}

function walkFiles(rootDir) {
    const out = [];
    const stack = [rootDir];
    while (stack.length) {
        const dir = stack.pop();
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                stack.push(full);
            } else if (ent.isFile()) {
                out.push(full);
            }
        }
    }
    return out;
}

function sha256FileSync(filePath) {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

function toPosixRelative(rootDir, filePath) {
    const rel = path.relative(rootDir, filePath);
    return rel.split(path.sep).join('/');
}

console.log('🧾 Generating incremental client manifest...');
// Extract into a temp folder first, then mirror the layout to TARGET_DIR/client (for server-side extract step).
// We only need the extracted tree locally to compute file hashes.
const tmpExtract = path.join(os.tmpdir(), `ganjacraft-launcher-${Date.now()}-${Math.random().toString(16).slice(2)}`);
try {
    tryExtractZip(sourceZip, tmpExtract);
    const filesList = walkFiles(tmpExtract);

    const manifest = {
        version,
        generatedAt: new Date().toISOString(),
        hash: 'sha256',
        files: filesList
            .map(fp => {
                const st = fs.statSync(fp);
                return {
                    path: toPosixRelative(tmpExtract, fp),
                    size: st.size,
                    sha256: sha256FileSync(fp),
                };
            })
            .sort((a, b) => a.path.localeCompare(b.path)),
    };

    const manifestBytes = Buffer.from(JSON.stringify(manifest), 'utf-8');
    fs.writeFileSync(CLIENT_MANIFEST_PATH, manifestBytes);
    console.log(`   Wrote ${CLIENT_MANIFEST_NAME} with ${manifest.files.length} files.`);
} finally {
    try { if (fs.existsSync(tmpExtract)) fs.rmSync(tmpExtract, { recursive: true, force: true }); } catch {}
}

// Sign the archive
let signature = '';
let manifestSignature = '';
if (fs.existsSync(PRIVATE_KEY_PATH)) {
    console.log('🔐 Signing update...');
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
    const fileBuffer = fs.readFileSync(sourceZip);
    signature = crypto.sign(null, fileBuffer, privateKey).toString('base64');

    console.log('🔐 Signing manifest...');
    const manifestBuffer = fs.readFileSync(CLIENT_MANIFEST_PATH);
    manifestSignature = crypto.sign(null, manifestBuffer, privateKey).toString('base64');
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
    // Incremental update fields (preferred by new bootstrap)
    baseUrl: 'https://ganjacraft.ru/api/launcher/files/client',
    manifestUrl: `https://ganjacraft.ru/api/launcher/files/${encodeURIComponent(CLIENT_MANIFEST_NAME)}`,
    manifestSignature: manifestSignature,
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
    await uploadFile(CLIENT_MANIFEST_PATH);
})();

