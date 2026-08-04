const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'dist');
const DEPLOY_WWW_DIR = path.resolve(__dirname, '../deploy_www');
const DEPLOY_API_DIR = path.join(DEPLOY_WWW_DIR, 'api/launcher/files');

// Ensure deploy dirs exist
if (!fs.existsSync(DEPLOY_API_DIR)) {
    fs.mkdirSync(DEPLOY_API_DIR, { recursive: true });
}

// Clean old files in deploy_www
if (fs.existsSync(DEPLOY_API_DIR)) {
    fs.readdirSync(DEPLOY_API_DIR).forEach(f => {
        if (f.endsWith('.exe') || f.endsWith('.blockmap') || f === 'latest.yml') {
            try { fs.unlinkSync(path.join(DEPLOY_API_DIR, f)); } catch {}
        }
    });
}

// Find files to publish
const filesToPublish = fs.readdirSync(DIST_DIR).filter(f => 
    f.endsWith('.exe') || 
    f.endsWith('.blockmap') || 
    f === 'latest.yml'
);

if (filesToPublish.length === 0) {
    console.error('❌ No release files found in dist/. Run "npm run build" first.');
    process.exit(1);
}

// Copy files
filesToPublish.forEach(f => {
    console.log(`📦 Copying ${f}...`);
    fs.copyFileSync(path.join(DIST_DIR, f), path.join(DEPLOY_API_DIR, f));
});

console.log('✅ Published successfully!');
console.log(`📁 Files ready in deploy_www/ for Nginx upload:`);
filesToPublish.forEach(f => console.log(`   - deploy_www/api/launcher/files/${f}`));

