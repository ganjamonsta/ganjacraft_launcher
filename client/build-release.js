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

// 2.2 Generate / Process Release Notes
const userNote = process.argv.slice(2).join(' ').trim();
console.log('📝 Generating launcher changelog...');

function generateGitChanges() {
    try {
        const rootDir = path.join(__dirname, '..');
        const rawLog = execSync('git log -n 15 --pretty=format:"%s"', { encoding: 'utf-8', cwd: rootDir });
        const commits = rawLog.split('\n')
            .map(s => s.trim())
            .filter(s => s && !s.toLowerCase().startsWith('chore: release') && !s.toLowerCase().startsWith('merge '));
        
        if (commits.length === 0) {
            return ['⚡ Оптимизация и повышение стабильности клиента'];
        }

        return commits.slice(0, 7).map(c => {
            let clean = c.replace(/^(feat|fix|refactor|style|docs|perf|test)(\(.*?\))?:\s*/i, '').trim();
            clean = clean.charAt(0).toUpperCase() + clean.slice(1);
            const lower = c.toLowerCase();
            if (lower.startsWith('feat') || lower.includes('добавлен') || lower.includes('новый')) return `✨ ${clean}`;
            if (lower.startsWith('fix') || lower.includes('исправлен') || lower.includes('поправ')) return `🐛 ${clean}`;
            if (lower.startsWith('perf') || lower.startsWith('refactor') || lower.includes('оптимиз')) return `⚡ ${clean}`;
            return `• ${clean}`;
        });
    } catch {
        return ['⚡ Обновление компонентов и оптимизация лаунчера'];
    }
}

const changesList = generateGitChanges();
const RELEASES_FILE = path.join(__dirname, 'src/assets/launcher_releases.json');
let releasesList = [];

if (fs.existsSync(RELEASES_FILE)) {
    try {
        releasesList = JSON.parse(fs.readFileSync(RELEASES_FILE, 'utf-8'));
        if (!Array.isArray(releasesList)) releasesList = [];
    } catch {
        releasesList = [];
    }
}

releasesList = releasesList.filter(r => r.version !== newVersion);
const newReleaseEntry = {
    version: newVersion,
    date: new Date().toISOString(),
    timestamp: Math.floor(Date.now() / 1000),
    title: userNote ? `Релиз v${newVersion}` : `Обновление лаунчера v${newVersion}`,
    description: userNote || (changesList.length > 0 ? changesList[0].replace(/^[^\wа-яА-ЯёЁ]+/, '') : 'Улучшения и исправления клиента'),
    changes: changesList
};
releasesList.unshift(newReleaseEntry);
fs.writeFileSync(RELEASES_FILE, JSON.stringify(releasesList, null, 2), 'utf-8');
console.log(`✅ Launcher changelog entry created for v${newVersion}`);

// Auto Git Commit & Push so the remote Linux server gets exact same version and code
try {
    console.log('📤 Auto-committing and pushing release version to Git...');
    const rootDir = path.join(__dirname, '..');
    execSync('git add -A', { stdio: 'inherit', cwd: rootDir });
    const commitMsg = userNote ? `chore: release v${newVersion} - ${userNote}` : `chore: release v${newVersion}`;
    execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { stdio: 'inherit', cwd: rootDir });
    execSync('git push', { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Git repository synced!');
} catch (e) {
    console.error('❌ Failed to sync Git repository! Aborting build to prevent version desync.');
    process.exit(1);
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


