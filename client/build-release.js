const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PACKAGE_PATH = path.join(__dirname, 'package.json');
const SRC_DIR = path.join(__dirname, 'src');
const HASH_FILE = path.join(__dirname, 'last_build.hash');

function getDirHash(dir) {
    const hash = crypto.createHash('md5');
    const files = fs.readdirSync(dir).sort();
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            hash.update(getDirHash(filePath));
        } else {
            hash.update(fs.readFileSync(filePath));
        }
    }
    return hash.digest('hex');
}

// 0. Check for changes
console.log('🔍 Checking for changes...');
const currentHash = getDirHash(SRC_DIR);
let lastHash = '';

if (fs.existsSync(HASH_FILE)) {
    lastHash = fs.readFileSync(HASH_FILE, 'utf-8').trim();
}

if (currentHash === lastHash) {
    console.log('💤 No changes detected in src/. Skipping build.');
    process.exit(0);
}

// 1. Read package.json
console.log('📖 Reading package.json...');
const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf-8'));
const currentVersion = pkg.version;
console.log(`🔹 Current version: ${currentVersion}`);

// 2. Increment Version (Patch)
const parts = currentVersion.split('.').map(Number);
parts[2] += 1; // Increment patch
const newVersion = parts.join('.');
pkg.version = newVersion;

console.log(`🚀 Bumping version to: ${newVersion}`);
fs.writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2));

// Auto Git Commit & Push so the remote Linux server gets exact same code
try {
    console.log('📤 Auto-committing and pushing release version to Git...');
    execSync('git add package.json last_build.hash', { stdio: 'ignore', cwd: __dirname });
    execSync(`git commit -m "chore: release v${newVersion}"`, { stdio: 'ignore', cwd: __dirname });
    execSync('git push', { stdio: 'ignore', cwd: __dirname });
    console.log('✅ Git repository synced!');
} catch (e) {
    console.warn('⚠️ Auto git push skipped or already up to date.');
}

// 2.5 Clean dist
console.log('🧹 Cleaning dist folder...');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
}

// 3. Run Build & Publish
console.log('🔨 Running build and publishing to GitHub (electron-builder -p always)...');

// Load environment variables to get GITHUB_TOKEN
const envDeployPath = path.join(__dirname, '../.env.deploy');
try {
    require('dotenv').config({ path: envDeployPath });
} catch (e) {
    console.warn('⚠️ Could not load .env.deploy', e.message);
}

// Pass GITHUB_TOKEN as GH_TOKEN to electron-builder
const env = { ...process.env };
if (env.GITHUB_TOKEN && !env.GH_TOKEN) {
    env.GH_TOKEN = env.GITHUB_TOKEN;
}

try {
    execSync('npm run build:renderer && npx electron-builder --win -p always', { stdio: 'inherit', cwd: __dirname, env: env });
    execSync('node trigger-remote-linux.js', { stdio: 'inherit', cwd: __dirname, env: env });
} catch (e) {
    console.error('❌ Build or Publish failed!');
    process.exit(1);
}

console.log('✅ Done! Update built and published to GitHub successfully.');

// Save new hash
fs.writeFileSync(HASH_FILE, currentHash);


