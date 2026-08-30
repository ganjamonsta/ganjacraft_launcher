const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Pure Node.js 64x32 PNG Generator for Minecraft Armor Textures
 */
function createPng(width, height, getPixelRgba) {
    // PNG Signature
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    // IHDR Chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8; // bit depth
    ihdrData[9] = 6; // color type: RGBA
    ihdrData[10] = 0; // compression
    ihdrData[11] = 0; // filter
    ihdrData[12] = 0; // interlace
    const ihdrChunk = createChunk('IHDR', ihdrData);

    // IDAT Chunk (Scanlines: filter byte 0 + RGBA pixels)
    const scanlineLength = 1 + width * 4;
    const rawData = Buffer.alloc(height * scanlineLength);

    for (let y = 0; y < height; y++) {
        const offset = y * scanlineLength;
        rawData[offset] = 0; // None filter
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = getPixelRgba(x, y);
            const pxOffset = offset + 1 + x * 4;
            rawData[pxOffset] = r;
            rawData[pxOffset + 1] = g;
            rawData[pxOffset + 2] = b;
            rawData[pxOffset + 3] = a;
        }
    }

    const compressed = zlib.deflateSync(rawData);
    const idatChunk = createChunk('IDAT', compressed);

    // IEND Chunk
    const iendChunk = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// CRC32 table & calculator
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
}

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── Генераторы текстур брони ──

const dstArmor = path.join(__dirname, '..', 'src', 'assets', 'equipment', 'armor');
if (!fs.existsSync(dstArmor)) fs.mkdirSync(dstArmor, { recursive: true });

// 1. Diamond Armor (Layer 1 & Layer 2)
function generateDiamondArmor() {
    const png1 = createPng(64, 32, (x, y) => {
        // Helmet: (0..32, 0..16), Body: (16..40, 16..32), Arms: (40..64, 16..32), Boots: (0..16, 16..32)
        const isHead = (x < 32 && y < 16) || (x >= 32 && x < 64 && y < 16);
        const isBody = (x >= 16 && x < 40 && y >= 16);
        const isArm = (x >= 40 && x < 64 && y >= 16);
        const isBoot = (x < 16 && y >= 16);

        if (!isHead && !isBody && !isArm && !isBoot) return [0, 0, 0, 0];

        // Cyan / Diamond shades
        const noise = ((x * 17 + y * 23) % 7) / 7;
        const r = Math.round(44 + noise * 30);
        const g = Math.round(216 + noise * 35);
        const b = Math.round(213 + noise * 40);
        const a = 255;

        // Dark border
        if (x === 0 || y === 0 || x === 31 || y === 15 || (x % 8 === 0) || (y % 8 === 0)) {
            return [Math.round(r * 0.7), Math.round(g * 0.7), Math.round(b * 0.7), 255];
        }
        return [r, g, b, a];
    });

    const png2 = createPng(64, 32, (x, y) => {
        // Leggings (Layer 2)
        const isLeg = (x < 32 && y >= 16);
        const isBelt = (x >= 16 && x < 40 && y >= 16 && y < 22);
        if (!isLeg && !isBelt) return [0, 0, 0, 0];

        const noise = ((x * 13 + y * 29) % 7) / 7;
        const r = Math.round(38 + noise * 25);
        const g = Math.round(195 + noise * 30);
        const b = Math.round(200 + noise * 35);
        return [r, g, b, 255];
    });

    fs.writeFileSync(path.join(dstArmor, 'diamond_armor.png'), png1);
    fs.writeFileSync(path.join(dstArmor, 'diamond_armor_legs.png'), png2);
    console.log('✅ Generated Diamond Armor Textures');
}

// 2. Netherite Armor (Layer 1 & Layer 2)
function generateNetheriteArmor() {
    const png1 = createPng(64, 32, (x, y) => {
        const isHead = (x < 32 && y < 16) || (x >= 32 && x < 64 && y < 16);
        const isBody = (x >= 16 && x < 40 && y >= 16);
        const isArm = (x >= 40 && x < 64 && y >= 16);
        const isBoot = (x < 16 && y >= 16);

        if (!isHead && !isBody && !isArm && !isBoot) return [0, 0, 0, 0];

        // Dark Netherite charcoal / bronze
        const noise = ((x * 19 + y * 31) % 8) / 8;
        const r = Math.round(52 + noise * 25);
        const g = Math.round(44 + noise * 20);
        const b = Math.round(48 + noise * 22);

        // Netherite gold/accent trim
        if ((x + y) % 9 === 0) {
            return [160, 120, 70, 255];
        }

        return [r, g, b, 255];
    });

    const png2 = createPng(64, 32, (x, y) => {
        const isLeg = (x < 32 && y >= 16);
        const isBelt = (x >= 16 && x < 40 && y >= 16 && y < 22);
        if (!isLeg && !isBelt) return [0, 0, 0, 0];

        const noise = ((x * 11 + y * 23) % 6) / 6;
        const r = Math.round(45 + noise * 20);
        const g = Math.round(38 + noise * 18);
        const b = Math.round(42 + noise * 18);
        return [r, g, b, 255];
    });

    fs.writeFileSync(path.join(dstArmor, 'netherite_armor.png'), png1);
    fs.writeFileSync(path.join(dstArmor, 'netherite_armor_legs.png'), png2);
    console.log('✅ Generated Netherite Armor Textures');
}

// 3. MekaSuit Cyber Armor (Layer 1 & Layer 2)
function generateMekaSuitArmor() {
    const png1 = createPng(64, 32, (x, y) => {
        const isHead = (x < 32 && y < 16) || (x >= 32 && x < 64 && y < 16);
        const isBody = (x >= 16 && x < 40 && y >= 16);
        const isArm = (x >= 40 && x < 64 && y >= 16);
        const isBoot = (x < 16 && y >= 16);

        if (!isHead && !isBody && !isArm && !isBoot) return [0, 0, 0, 0];

        // Cyber black / cyan LED lines
        const isLed = (x % 6 === 0 || y % 6 === 0) && ((x + y) % 3 === 0);
        if (isLed) {
            return [0, 242, 254, 255]; // Cyan LED
        }

        const r = 24;
        const g = 32;
        const b = 40;
        return [r, g, b, 255];
    });

    const png2 = createPng(64, 32, (x, y) => {
        const isLeg = (x < 32 && y >= 16);
        if (!isLeg) return [0, 0, 0, 0];

        const isLed = (x % 5 === 0 && y % 4 === 0);
        if (isLed) return [0, 242, 254, 255];

        return [20, 28, 36, 255];
    });

    fs.writeFileSync(path.join(dstArmor, 'mekasuit_armor.png'), png1);
    fs.writeFileSync(path.join(dstArmor, 'mekasuit_armor_legs.png'), png2);
    console.log('✅ Generated MekaSuit Cyber Armor Textures');
}

generateDiamondArmor();
generateNetheriteArmor();
generateMekaSuitArmor();
console.log('🎉 ALL ARMOR TEXTURES GENERATED!');
