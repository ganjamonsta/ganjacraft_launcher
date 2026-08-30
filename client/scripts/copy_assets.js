const fs = require('fs');
const path = require('path');

const srcTacz = 's:\\Games\\LegacyLauncher_portable\\game\\home\\neoforge-21.1.247\\tacz\\tacz_default_gun\\assets\\tacz';
const srcMods = 's:\\Games\\LegacyLauncher_portable\\game\\home\\neoforge-21.1.247\\.mods_sources';

const dstTacz = path.join(__dirname, '..', 'src', 'assets', 'tacz');
const dstEquip = path.join(__dirname, '..', 'src', 'assets', 'equipment');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

ensureDir(path.join(dstTacz, 'hud'));
ensureDir(path.join(dstTacz, 'sounds'));
ensureDir(path.join(dstTacz, 'geo'));
ensureDir(path.join(dstTacz, 'uv'));

ensureDir(path.join(dstEquip, 'items'));
ensureDir(path.join(dstEquip, 'armor'));
ensureDir(path.join(dstEquip, 'backpacks'));

// 1. Copy TACZ HUD & Geo & UV Textures
const guns = [
    'ak47', 'deagle', 'spas_12', 'vector45', 'p90', 'ai_awp', 'rpg7', 
    'minigun', 'm4a1', 'glock_17', 'm107', 'scar_h', 'aa12', 'm870', 'hk_mp5a5'
];

for (const gun of guns) {
    // HUD
    const hudSrc = path.join(srcTacz, 'textures', 'gun', 'hud', `${gun}.png`);
    if (fs.existsSync(hudSrc)) {
        fs.copyFileSync(hudSrc, path.join(dstTacz, 'hud', `${gun}.png`));
    }
    // GEO JSON
    const geoSrc = path.join(srcTacz, 'geo_models', 'gun', `${gun}_geo.json`);
    if (fs.existsSync(geoSrc)) {
        fs.copyFileSync(geoSrc, path.join(dstTacz, 'geo', `${gun}_geo.json`));
        console.log('Copied TACZ Geo:', `${gun}_geo.json`);
    }
    // UV PNG
    const uvSrc = path.join(srcTacz, 'textures', 'gun', 'uv', `${gun}.png`);
    if (fs.existsSync(uvSrc)) {
        fs.copyFileSync(uvSrc, path.join(dstTacz, 'uv', `${gun}.png`));
        console.log('Copied TACZ UV:', `${gun}.png`);
    }
}

// 2. Copy TACZ Sounds
const soundFiles = [
    { src: path.join(srcTacz, 'tacz_sounds', 'ak47', 'ak47_shoot.ogg'), dst: 'ak47_shoot.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'deagle', 'deagle_shoot.ogg'), dst: 'deagle_shoot.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'spas_12', 'spas12_shoot.ogg'), dst: 'spas12_shoot.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'victor45', 'victor45_shoot.ogg'), dst: 'victor45_shoot.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'p90', 'p90_shoot.ogg'), dst: 'p90_shoot.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'ai_awp', 'awp_shoot.ogg'), dst: 'awp_shoot.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'rpg7', 'rpg7_shoot.ogg'), dst: 'rpg7_shoot.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'minigun', 'minigun_shoot.ogg'), dst: 'minigun_shoot.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'head_hit.ogg'), dst: 'head_hit.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'flesh_hit.ogg'), dst: 'flesh_hit.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'kill.ogg'), dst: 'kill.ogg' },
    { src: path.join(srcTacz, 'tacz_sounds', 'dry_fire.ogg'), dst: 'dry_fire.ogg' }
];

for (const s of soundFiles) {
    if (fs.existsSync(s.src)) {
        fs.copyFileSync(s.src, path.join(dstTacz, 'sounds', s.dst));
    }
}

// 3. Copy Cataclysm Textures
const srcCata = path.join(srcMods, 'cataclysm-3.30', 'assets', 'cataclysm', 'textures');
if (fs.existsSync(srcCata)) {
    const cataArmorDir = path.join(srcCata, 'armor');
    if (fs.existsSync(cataArmorDir)) {
        for (const file of fs.readdirSync(cataArmorDir)) {
            if (file.endsWith('.png')) {
                fs.copyFileSync(path.join(cataArmorDir, file), path.join(dstEquip, 'armor', file));
            }
        }
    }
    const cataItemDir = path.join(srcCata, 'item');
    if (fs.existsSync(cataItemDir)) {
        for (const file of fs.readdirSync(cataItemDir)) {
            if (file.endsWith('.png')) {
                fs.copyFileSync(path.join(cataItemDir, file), path.join(dstEquip, 'items', file));
            }
        }
    }
    console.log('Copied Cataclysm items & armors');
}

// 4. Copy SimplySwords
const srcSwords = path.join(srcMods, 'SimplySwords-Architectury-1.21', 'common', 'src', 'main', 'resources', 'assets', 'simplyswords', 'textures', 'item');
if (fs.existsSync(srcSwords)) {
    for (const file of fs.readdirSync(srcSwords)) {
        if (file.endsWith('.png')) {
            fs.copyFileSync(path.join(srcSwords, file), path.join(dstEquip, 'items', file));
        }
    }
    console.log('Copied Simply Swords');
}

// 5. Copy Create
const srcCreate = path.join(srcMods, 'Create-mc1.21.1-dev', 'src', 'main', 'resources', 'assets', 'create', 'textures', 'item');
if (fs.existsSync(srcCreate)) {
    const createItems = ['goggles.png', 'wrench.png', 'extendo_grip.png', 'potato_cannon.png', 'cardboard_sword.png', 'super_glue.png'];
    for (const item of createItems) {
        const p = path.join(srcCreate, item);
        if (fs.existsSync(p)) {
            fs.copyFileSync(p, path.join(dstEquip, 'items', `create_${item}`));
        }
    }
    console.log('Copied Create items');
}

// 6. Copy Mekanism
const srcMek = path.join(srcMods, 'Mekanism-1.21.x', 'src', 'main', 'resources', 'assets', 'mekanism', 'textures', 'item');
if (fs.existsSync(srcMek)) {
    const mekItems = ['mekasuit_helmet.png', 'mekasuit_bodyarmor.png', 'mekasuit_pants.png', 'mekasuit_boots.png', 'atomic_disassembler.png', 'hazmat_mask.png', 'hazmat_gown.png', 'hazmat_pants.png', 'hazmat_boots.png', 'electric_bow.png', 'dosimeter.png', 'geiger_counter_0.png'];
    for (const item of mekItems) {
        const p = path.join(srcMek, item);
        if (fs.existsSync(p)) {
            fs.copyFileSync(p, path.join(dstEquip, 'items', `mek_${item}`));
        }
    }
    console.log('Copied Mekanism items');
}

// 7. Copy Sophisticated Backpacks
const srcBackpacksEntity = path.join(srcMods, 'SophisticatedBackpacks-1.21.x', 'src', 'main', 'resources', 'assets', 'sophisticatedbackpacks', 'textures', 'entity');
if (fs.existsSync(srcBackpacksEntity)) {
    for (const file of fs.readdirSync(srcBackpacksEntity)) {
        if (file.endsWith('.png')) {
            fs.copyFileSync(path.join(srcBackpacksEntity, file), path.join(dstEquip, 'backpacks', file));
        }
    }
}
const srcBackpacksBlock = path.join(srcMods, 'SophisticatedBackpacks-1.21.x', 'src', 'main', 'resources', 'assets', 'sophisticatedbackpacks', 'textures', 'block');
if (fs.existsSync(srcBackpacksBlock)) {
    for (const file of fs.readdirSync(srcBackpacksBlock)) {
        if (file.endsWith('.png')) {
            fs.copyFileSync(path.join(srcBackpacksBlock, file), path.join(dstEquip, 'backpacks', file));
        }
    }
    console.log('Copied Sophisticated Backpacks block textures');
}

// 8. Copy Artifacts
const srcArtifacts = path.join(srcMods, 'artifacts-1.21.1', 'common', 'src', 'main', 'resources', 'assets', 'artifacts', 'textures', 'item');
if (fs.existsSync(srcArtifacts)) {
    const artItems = ['crystal_heart.png', 'digging_claws.png', 'eternal_steak.png', 'everlasting_beef.png', 'fire_gauntlet.png', 'power_glove.png', 'umbrella_held.png', 'obsidian_skull.png', 'chorus_totem.png', 'anglers_hat.png', 'cowboy_hat.png', 'novelty_drinking_hat.png'];
    for (const item of artItems) {
        const p = path.join(srcArtifacts, item);
        if (fs.existsSync(p)) {
            fs.copyFileSync(p, path.join(dstEquip, 'items', `art_${item}`));
        }
    }
    console.log('Copied Artifacts');
}

// 9. Copy Twilight Forest
const srcTF = path.join(srcMods, 'twilightforest-4.8', 'assets', 'twilightforest', 'textures', 'item');
if (fs.existsSync(srcTF)) {
    const tfItems = ['fiery_sword.png', 'knightmetal_sword.png', 'ice_sword_clear.png', 'glass_sword_clear.png', 'steeleaf_sword.png', 'mazebreaker_pickaxe.png', 'crown_splinter.png', 'twilight_scepter.png', 'lifedrain_scepter.png', 'fortification_scepter.png', 'zombie_scepter.png', 'ore_magnet.png', 'lamp_of_cinders.png'];
    for (const item of tfItems) {
        const p = path.join(srcTF, item);
        if (fs.existsSync(p)) {
            fs.copyFileSync(p, path.join(dstEquip, 'items', `tf_${item}`));
        }
    }
    console.log('Copied Twilight Forest');
}

console.log('🎉 ALL IN-GAME ASSETS COPIED SUCCESSFULLY!');
