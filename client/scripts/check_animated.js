const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const itemsDir = path.join(__dirname, '..', 'src', 'assets', 'equipment', 'items');

// PNG Header parser
function getPngDimensions(buf) {
    if (buf.length < 24) return null;
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) return null;
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    return { w, h };
}

// Check which files are animated sprite strips (h > w)
const files = fs.readdirSync(itemsDir);
const animated = [];

for (const f of files) {
    if (f.endsWith('.png')) {
        const buf = fs.readFileSync(path.join(itemsDir, f));
        const dim = getPngDimensions(buf);
        if (dim && dim.h > dim.w && dim.h % dim.w === 0) {
            animated.push({ file: f, w: dim.w, h: dim.h, frames: dim.h / dim.w });
        }
    }
}

console.log('Found animated strips:', animated);
