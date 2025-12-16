const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_PATH = path.join(__dirname, 'package.json');

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

// 3. Run Build
console.log('🔨 Running build (electron-builder)...');
try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
    console.error('❌ Build failed!');
    process.exit(1);
}

// 4. Run Publish
console.log('📦 Publishing to local storage...');
try {
    execSync('node publish.js', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
    console.error('❌ Publish failed!');
    process.exit(1);
}

console.log('✅ Done! Update deployed successfully.');
