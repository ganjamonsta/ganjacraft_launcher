const fs = require('fs');
const path = require('path');

const srcTacz = 's:\\Games\\LegacyLauncher_portable\\game\\home\\neoforge-21.1.247\\tacz\\tacz_default_gun\\assets\\tacz';
const dstTacz = path.join(__dirname, '..', 'src', 'assets', 'tacz');
const dstEquip = path.join(__dirname, '..', 'src', 'assets', 'equipment');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

ensureDir(path.join(dstTacz, 'hud'));
ensureDir(path.join(dstTacz, 'sounds'));
ensureDir(path.join(dstEquip, 'items'));
ensureDir(path.join(dstEquip, 'armor'));

// Copy HUD Icons
const hudIcons = ['ak47.png', 'deagle.png', 'spas_12.png', 'vector45.png', 'p90.png', 'ai_awp.png', 'rpg7.png', 'minigun.png', 'm4a1.png', 'glock_17.png', 'm107.png', 'scar_h.png'];
for (const icon of hudIcons) {
    const src = path.join(srcTacz, 'textures', 'gun', 'hud', icon);
    const dst = path.join(dstTacz, 'hud', icon);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        console.log('Copied HUD:', icon);
    }
}

// Copy TACZ Sounds
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
        console.log('Copied Sound:', s.dst);
    }
}

// Copy Cataclysm
const srcCata = 's:\\Games\\LegacyLauncher_portable\\game\\home\\neoforge-21.1.247\\.mods_sources\\cataclysm-3.30\\assets\\cataclysm\\textures';
if (fs.existsSync(srcCata)) {
    const cataArmorDir = path.join(srcCata, 'armor');
    if (fs.existsSync(cataArmorDir)) {
        for (const file of fs.readdirSync(cataArmorDir)) {
            fs.copyFileSync(path.join(cataArmorDir, file), path.join(dstEquip, 'armor', file));
        }
    }
    const cataItems = ['ignitium_helmet.png', 'ignitium_chestplate.png', 'ignitium_leggings.png', 'ignitium_boots.png', 'the_incinerator.png', 'infernal_forge.png', 'cursium_helmet.png', 'cursium_chestplate.png', 'cursium_leggings.png', 'cursium_boots.png', 'monstrous_helm.png', 'gauntlet_of_guard.png', 'meat_shredder.png', 'tidal_claws.png', 'zweiender.png'];
    for (const item of cataItems) {
        const p = path.join(srcCata, 'item', item);
        if (fs.existsSync(p)) {
            fs.copyFileSync(p, path.join(dstEquip, 'items', item));
            console.log('Copied Cata Item:', item);
        }
    }
}

// Copy SimplySwords
const srcSwords = 's:\\Games\\LegacyLauncher_portable\\game\\home\\neoforge-21.1.247\\.mods_sources\\SimplySwords-Architectury-1.21\\common\\src\\main\\resources\\assets\\simplyswords\\textures\\item';
if (fs.existsSync(srcSwords)) {
    const swordItems = ['frostfall.png', 'stormbringer.png', 'soulkeeper.png', 'arcanethyst.png', 'bramblethorn.png', 'mjolnir.png', 'brimstone_claymore.png', 'diamond_claymore.png', 'netherite_katana.png', 'netherite_claymore.png', 'thunderbrand.png', 'lichblade.png'];
    for (const item of swordItems) {
        const p = path.join(srcSwords, item);
        if (fs.existsSync(p)) {
            fs.copyFileSync(p, path.join(dstEquip, 'items', item));
            console.log('Copied Sword Item:', item);
        }
    }
}

console.log('✅ Asset copying completed successfully!');
