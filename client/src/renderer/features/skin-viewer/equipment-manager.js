/**
 * Ganj4Craft Launcher - 3D Character Equipment & Wardrobe Engine
 * Полнофункциональный менеджер 3D экипировки персонажа:
 * 1. Оригинальные Bedrock .geo.json 3D модели оружия TACZ с точными UV-текстурами
 * 2. 3D воксельные модели мечей, инструментов и артефактов из модов
 * 3. 3D Броня Minecraft с точным наложением оригинальных текстур слоев 1 и 2
 * 4. Полная рандомизация экипировки и боевые позы персонажа!
 */

import * as THREE from 'three';
import { taczGeoLoader } from './tacz-geo-loader.js';
import { voxelItemBuilder } from './voxel-item-builder.js';
import { armorMeshBuilder } from './armor-mesh-builder.js';

const STORAGE_KEY_EQUIPMENT = 'ganjacraft_player_equipment_v1';

// ── Полный каталог экипировки из игры и модов ──
export const EQUIPMENT_CATALOG = {
    // 🪖 ШЛЕМЫ / ГОЛОВА
    head: {
        none: { id: 'none', name: 'Без шлема', icon: '👤', rarity: 'common' },
        ignitium_helmet: { 
            id: 'ignitium_helmet', 
            name: 'Шлем Игнития', 
            mod: 'Cataclysm', 
            icon: 'assets/equipment/items/ignitium_helmet.png', 
            isImage: true, 
            rarity: 'mythic', 
            armorTex: 'assets/equipment/armor/ignitium_armor.png',
            hasHorns: true 
        },
        cursium_helmet: { 
            id: 'cursium_helmet', 
            name: 'Шлем Бездны Cursium', 
            mod: 'Cataclysm', 
            icon: 'assets/equipment/items/cursium_helmet.png', 
            isImage: true, 
            rarity: 'mythic', 
            armorTex: 'assets/equipment/armor/cursium_armor.png' 
        },
        monstrous_helm: { 
            id: 'monstrous_helm', 
            name: 'Шлем Левиафана', 
            mod: 'Cataclysm', 
            icon: 'assets/equipment/items/monstrous_helm.png', 
            isImage: true, 
            rarity: 'mythic', 
            armorTex: 'assets/equipment/armor/monstrous_helm.png',
            hasHorns: true 
        },
        netherite_helmet: { 
            id: 'netherite_helmet', 
            name: 'Незеритовый шлем', 
            icon: '🪖', 
            rarity: 'epic', 
            armorTex: 'assets/equipment/armor/netherite_armor.png' 
        },
        diamond_helmet: { 
            id: 'diamond_helmet', 
            name: 'Алмазный шлем', 
            icon: '💎', 
            rarity: 'rare', 
            armorTex: 'assets/equipment/armor/diamond_armor.png' 
        },
        mekasuit_helmet: { 
            id: 'mekasuit_helmet', 
            name: 'MekaSuit Helmet', 
            mod: 'Mekanism', 
            icon: 'assets/equipment/items/mek_mekasuit_helmet.png', 
            isImage: true, 
            rarity: 'legendary', 
            armorTex: 'assets/equipment/armor/mekasuit_armor.png' 
        },
        create_goggles: { 
            id: 'create_goggles', 
            name: 'Очки инженера', 
            mod: 'Create', 
            icon: 'assets/equipment/items/create_goggles.png', 
            isImage: true, 
            rarity: 'uncommon', 
            isCustomMesh: true 
        },
        twilight_crown: { 
            id: 'twilight_crown', 
            name: 'Корона Сумерек', 
            mod: 'Twilight Forest', 
            icon: 'assets/equipment/items/tf_crown_splinter.png', 
            isImage: true, 
            rarity: 'legendary', 
            isCustomMesh: true 
        }
    },

    // 🎽 НАГРУДНИК / ТЕЛО
    chest: {
        none: { id: 'none', name: 'Без брони', icon: '👕', rarity: 'common' },
        ignitium_chestplate: { 
            id: 'ignitium_chestplate', 
            name: 'Нагрудник Игнития', 
            mod: 'Cataclysm', 
            icon: 'assets/equipment/items/ignitium_chestplate.png', 
            isImage: true, 
            rarity: 'mythic', 
            armorTex: 'assets/equipment/armor/ignitium_armor.png' 
        },
        cursium_chestplate: { 
            id: 'cursium_chestplate', 
            name: 'Нагрудник Cursium', 
            mod: 'Cataclysm', 
            icon: 'assets/equipment/items/cursium_chestplate.png', 
            isImage: true, 
            rarity: 'mythic', 
            armorTex: 'assets/equipment/armor/cursium_armor.png' 
        },
        netherite_chestplate: { 
            id: 'netherite_chestplate', 
            name: 'Незеритовый нагрудник', 
            icon: '🛡️', 
            rarity: 'epic', 
            armorTex: 'assets/equipment/armor/netherite_armor.png' 
        },
        diamond_chestplate: { 
            id: 'diamond_chestplate', 
            name: 'Алмазный нагрудник', 
            icon: '💎', 
            rarity: 'rare', 
            armorTex: 'assets/equipment/armor/diamond_armor.png' 
        },
        mekasuit_body: { 
            id: 'mekasuit_body', 
            name: 'MekaSuit BodyArmor', 
            mod: 'Mekanism', 
            icon: 'assets/equipment/items/mek_mekasuit_bodyarmor.png', 
            isImage: true, 
            rarity: 'legendary', 
            armorTex: 'assets/equipment/armor/mekasuit_armor.png' 
        },
        elytra: { 
            id: 'elytra', 
            name: 'Элитры', 
            icon: '🪽', 
            rarity: 'legendary', 
            isElytra: true 
        }
    },

    // 👖 ПОНОЖИ / НОГИ
    legs: {
        none: { id: 'none', name: 'Без поножей', icon: '🩳', rarity: 'common' },
        ignitium_leggings: { 
            id: 'ignitium_leggings', 
            name: 'Поножи Игнития', 
            mod: 'Cataclysm', 
            icon: 'assets/equipment/items/ignitium_leggings.png', 
            isImage: true, 
            rarity: 'mythic', 
            armorLegsTex: 'assets/equipment/armor/ignitium_armor_legs.png' 
        },
        cursium_leggings: { 
            id: 'cursium_leggings', 
            name: 'Поножи Cursium', 
            mod: 'Cataclysm', 
            icon: 'assets/equipment/items/cursium_leggings.png', 
            isImage: true, 
            rarity: 'mythic', 
            armorLegsTex: 'assets/equipment/armor/cursium_armor_legs.png' 
        },
        netherite_leggings: { 
            id: 'netherite_leggings', 
            name: 'Незеритовые поножи', 
            icon: '👖', 
            rarity: 'epic', 
            armorLegsTex: 'assets/equipment/armor/netherite_armor_legs.png' 
        },
        diamond_leggings: { 
            id: 'diamond_leggings', 
            name: 'Алмазные поножи', 
            icon: '💎', 
            rarity: 'rare', 
            armorLegsTex: 'assets/equipment/armor/diamond_armor_legs.png' 
        },
        mekasuit_pants: { 
            id: 'mekasuit_pants', 
            name: 'MekaSuit Pants', 
            mod: 'Mekanism', 
            icon: 'assets/equipment/items/mek_mekasuit_pants.png', 
            isImage: true, 
            rarity: 'legendary', 
            armorLegsTex: 'assets/equipment/armor/mekasuit_armor_legs.png' 
        }
    },

    // 👢 БОТИНКИ / СТУПНИ
    boots: {
        none: { id: 'none', name: 'Без ботинок', icon: '🧦', rarity: 'common' },
        ignitium_boots: { 
            id: 'ignitium_boots', 
            name: 'Ботинки Игнития', 
            mod: 'Cataclysm', 
            icon: 'assets/equipment/items/ignitium_boots.png', 
            isImage: true, 
            rarity: 'mythic', 
            armorTex: 'assets/equipment/armor/ignitium_armor.png' 
        },
        cursium_boots: { 
            id: 'cursium_boots', 
            name: 'Ботинки Cursium', 
            mod: 'Cataclysm', 
            icon: 'assets/equipment/items/cursium_boots.png', 
            isImage: true, 
            rarity: 'mythic', 
            armorTex: 'assets/equipment/armor/cursium_armor.png' 
        },
        netherite_boots: { 
            id: 'netherite_boots', 
            name: 'Незеритовые ботинки', 
            icon: '👢', 
            rarity: 'epic', 
            armorTex: 'assets/equipment/armor/netherite_armor.png' 
        },
        diamond_boots: { 
            id: 'diamond_boots', 
            name: 'Алмазные ботинки', 
            icon: '💎', 
            rarity: 'rare', 
            armorTex: 'assets/equipment/armor/diamond_armor.png' 
        },
        mekasuit_boots: { 
            id: 'mekasuit_boots', 
            name: 'MekaSuit Boots', 
            mod: 'Mekanism', 
            icon: 'assets/equipment/items/mek_mekasuit_boots.png', 
            isImage: true, 
            rarity: 'legendary', 
            armorTex: 'assets/equipment/armor/mekasuit_armor.png' 
        }
    },

    // ⚔️ ОСНОВНАЯ РУКА (Реальные TACZ 3D пушки и 3D воксельное оружие)
    mainHand: {
        none: { id: 'none', name: 'Пустая рука', icon: '✊', rarity: 'common' },
        
        // TACZ Огнестрел (Реальные Bedrock .geo.json 3D модели)
        tacz_ak47: { id: 'tacz_ak47', name: 'TACZ: AK-47', mod: 'TACZ', icon: 'assets/tacz/hud/ak47.png', isImage: true, rarity: 'epic', type: 'tacz_geo', geoGunId: 'ak47' },
        tacz_deagle: { id: 'tacz_deagle', name: 'TACZ: Desert Eagle .50', mod: 'TACZ', icon: 'assets/tacz/hud/deagle.png', isImage: true, rarity: 'rare', type: 'tacz_geo', geoGunId: 'deagle' },
        tacz_spas_12: { id: 'tacz_spas_12', name: 'TACZ: SPAS-12', mod: 'TACZ', icon: 'assets/tacz/hud/spas_12.png', isImage: true, rarity: 'epic', type: 'tacz_geo', geoGunId: 'spas_12' },
        tacz_vector45: { id: 'tacz_vector45', name: 'TACZ: Vector .45 ACP', mod: 'TACZ', icon: 'assets/tacz/hud/vector45.png', isImage: true, rarity: 'legendary', type: 'tacz_geo', geoGunId: 'vector45' },
        tacz_awp: { id: 'tacz_awp', name: 'TACZ: AWP Sniper', mod: 'TACZ', icon: 'assets/tacz/hud/ai_awp.png', isImage: true, rarity: 'legendary', type: 'tacz_geo', geoGunId: 'ai_awp' },
        tacz_rpg7: { id: 'tacz_rpg7', name: 'TACZ: RPG-7', mod: 'TACZ', icon: 'assets/tacz/hud/rpg7.png', isImage: true, rarity: 'mythic', type: 'tacz_geo', geoGunId: 'rpg7' },
        tacz_minigun: { id: 'tacz_minigun', name: 'TACZ: Minigun 6-Barrel', mod: 'TACZ', icon: 'assets/tacz/hud/minigun.png', isImage: true, rarity: 'mythic', type: 'tacz_geo', geoGunId: 'minigun' },
        tacz_m4a1: { id: 'tacz_m4a1', name: 'TACZ: M4A1 Tactical', mod: 'TACZ', icon: 'assets/tacz/hud/m4a1.png', isImage: true, rarity: 'epic', type: 'tacz_geo', geoGunId: 'm4a1' },
        tacz_p90: { id: 'tacz_p90', name: 'TACZ: FN P90', mod: 'TACZ', icon: 'assets/tacz/hud/p90.png', isImage: true, rarity: 'rare', type: 'tacz_geo', geoGunId: 'p90' },
        tacz_glock17: { id: 'tacz_glock17', name: 'TACZ: Glock 17', mod: 'TACZ', icon: 'assets/tacz/hud/glock_17.png', isImage: true, rarity: 'common', type: 'tacz_geo', geoGunId: 'glock_17' },

        // 3D Voxel Оружие из Cataclysm
        infernal_forge: { id: 'infernal_forge', name: 'Адская Кузня', mod: 'Cataclysm', icon: 'assets/equipment/items/infernal_forge.png', isImage: true, rarity: 'mythic', type: 'voxel_item', imgUrl: 'assets/equipment/items/infernal_forge.png' },
        the_incinerator: { id: 'the_incinerator', name: 'Испепелитель', mod: 'Cataclysm', icon: 'assets/equipment/items/the_incinerator.png', isImage: true, rarity: 'mythic', type: 'voxel_item', imgUrl: 'assets/equipment/items/the_incinerator.png' },
        meat_shredder: { id: 'meat_shredder', name: 'Мясоруб', mod: 'Cataclysm', icon: 'assets/equipment/items/meat_shredder.png', isImage: true, rarity: 'legendary', type: 'voxel_item', imgUrl: 'assets/equipment/items/meat_shredder.png' },
        zweiender: { id: 'zweiender', name: 'Цвайендер', mod: 'Cataclysm', icon: 'assets/equipment/items/zweiender.png', isImage: true, rarity: 'legendary', type: 'voxel_item', imgUrl: 'assets/equipment/items/zweiender.png' },

        // 3D Voxel Оружие из Simply Swords
        frostfall: { id: 'frostfall', name: 'Frostfall (Ледяной Клинок)', mod: 'Simply Swords', icon: 'assets/equipment/items/frostfall.png', isImage: true, rarity: 'legendary', type: 'voxel_item', imgUrl: 'assets/equipment/items/frostfall.png' },
        soulkeeper: { id: 'soulkeeper', name: 'Хранитель Душ', mod: 'Simply Swords', icon: 'assets/equipment/items/soulkeeper.png', isImage: true, rarity: 'legendary', type: 'voxel_item', imgUrl: 'assets/equipment/items/soulkeeper.png' },
        mjolnir: { id: 'mjolnir', name: 'Молот Мьёльнир', mod: 'Simply Swords', icon: 'assets/equipment/items/mjolnir.png', isImage: true, rarity: 'mythic', type: 'voxel_item', imgUrl: 'assets/equipment/items/mjolnir.png' },
        stormbringer: { id: 'stormbringer', name: 'Штормоносец', mod: 'Simply Swords', icon: 'assets/equipment/items/stormbringer.png', isImage: true, rarity: 'legendary', type: 'voxel_item', imgUrl: 'assets/equipment/items/stormbringer.png' },
        netherite_katana: { id: 'netherite_katana', name: 'Незеритовая Катана', mod: 'Simply Swords', icon: 'assets/equipment/items/netherite_katana.png', isImage: true, rarity: 'epic', type: 'voxel_item', imgUrl: 'assets/equipment/items/netherite_katana.png' },

        // 3D Voxel Инструменты из Create & Mekanism & Twilight Forest
        create_wrench: { id: 'create_wrench', name: 'Гаечный ключ Create', mod: 'Create', icon: 'assets/equipment/items/create_wrench.png', isImage: true, rarity: 'uncommon', type: 'voxel_item', imgUrl: 'assets/equipment/items/create_wrench.png' },
        atomic_disassembler: { id: 'atomic_disassembler', name: 'Атомный разборщик', mod: 'Mekanism', icon: 'assets/equipment/items/mek_atomic_disassembler.png', isImage: true, rarity: 'legendary', type: 'voxel_item', imgUrl: 'assets/equipment/items/mek_atomic_disassembler.png' },
        tf_fiery_sword: { id: 'tf_fiery_sword', name: 'Огненный Меч', mod: 'Twilight Forest', icon: 'assets/equipment/items/tf_fiery_sword.png', isImage: true, rarity: 'legendary', type: 'voxel_item', imgUrl: 'assets/equipment/items/tf_fiery_sword.png' },
        tf_twilight_scepter: { id: 'tf_twilight_scepter', name: 'Сумеречный Скипетр', mod: 'Twilight Forest', icon: 'assets/equipment/items/tf_twilight_scepter.png', isImage: true, rarity: 'mythic', type: 'voxel_item', imgUrl: 'assets/equipment/items/tf_twilight_scepter.png' }
    },

    // 🛡️ ВТОРАЯ РУКА (Off-Hand)
    offHand: {
        none: { id: 'none', name: 'Пусто', icon: '✋', rarity: 'common' },
        gauntlet_of_guard: { id: 'gauntlet_of_guard', name: 'Перчатка Стража', mod: 'Cataclysm', icon: 'assets/equipment/items/gauntlet_of_guard.png', isImage: true, rarity: 'mythic', type: 'voxel_item', imgUrl: 'assets/equipment/items/gauntlet_of_guard.png' },
        eternal_steak: { id: 'eternal_steak', name: 'Вечный стейк', mod: 'Artifacts', icon: 'assets/equipment/items/art_eternal_steak.png', isImage: true, rarity: 'epic', type: 'voxel_item', imgUrl: 'assets/equipment/items/art_eternal_steak.png' },
        fire_gauntlet: { id: 'fire_gauntlet', name: 'Огненная рукавица', mod: 'Artifacts', icon: 'assets/equipment/items/art_fire_gauntlet.png', isImage: true, rarity: 'legendary', type: 'voxel_item', imgUrl: 'assets/equipment/items/art_fire_gauntlet.png' },
        crystal_heart: { id: 'crystal_heart', name: 'Кристальное Сердце', mod: 'Artifacts', icon: 'assets/equipment/items/art_crystal_heart.png', isImage: true, rarity: 'mythic', type: 'voxel_item', imgUrl: 'assets/equipment/items/art_crystal_heart.png' },
        shield: { id: 'shield', name: 'Рыцарский Щит', icon: '🛡️', rarity: 'rare' },
        totem_of_undying: { id: 'totem_of_undying', name: 'Тотем бессмертия', icon: '🌟', rarity: 'legendary' }
    },

    // 🎒 СПИНА (Рюкзаки Sophisticated Backpacks / Крылья)
    back: {
        none: { id: 'none', name: 'Пусто', icon: '🚫', rarity: 'common' },
        backpack_netherite: { id: 'backpack_netherite', name: 'Рюкзак (Незерит)', mod: 'Sophisticated Backpacks', icon: '🎒', rarity: 'epic', color: '#2c282e', accent: '#eab308' },
        backpack_diamond: { id: 'backpack_diamond', name: 'Рюкзак (Алмаз)', mod: 'Sophisticated Backpacks', icon: '🎒', rarity: 'rare', color: '#164e63', accent: '#2cd8d5' },
        backpack_gold: { id: 'backpack_gold', name: 'Рюкзак (Золото)', mod: 'Sophisticated Backpacks', icon: '🎒', rarity: 'uncommon', color: '#ca8a04', accent: '#fef08a' },
        elytra_wings: { id: 'elytra_wings', name: 'Крылья Элитры', icon: '🪽', rarity: 'legendary' }
    }
};

// ── Быстрые наборы (Пресеты) ──
export const EQUIPMENT_PRESETS = {
    random: {
        id: 'random',
        name: '🎲 Случайный Лут',
        icon: '🎲',
        desc: 'Случайная комбинация реального оружия TACZ, брони и предметов из модов',
        slots: {}
    },
    tacz_specops: {
        id: 'tacz_specops',
        name: 'Спецназ TACZ',
        icon: '🔫',
        desc: 'Штурмовик с реальным 3D автоматом AK-47, незеритовой броней и рюкзаком',
        slots: {
            head: 'create_goggles',
            chest: 'netherite_chestplate',
            legs: 'netherite_leggings',
            boots: 'netherite_boots',
            mainHand: 'tacz_ak47',
            offHand: 'none',
            back: 'backpack_netherite'
        }
    },
    tacz_sniper: {
        id: 'tacz_sniper',
        name: 'Снайпер AWP',
        icon: '🎯',
        desc: 'Крупнокалиберная 3D снайперка AWP в сете Игнития',
        slots: {
            head: 'monstrous_helm',
            chest: 'ignitium_chestplate',
            legs: 'ignitium_leggings',
            boots: 'ignitium_boots',
            mainHand: 'tacz_awp',
            offHand: 'none',
            back: 'backpack_diamond'
        }
    },
    ignitium_berserk: {
        id: 'ignitium_berserk',
        name: 'Берсерк Игнития',
        icon: '🌋',
        desc: 'Полный текстурированный сет Игнития с Адской Кузней и Перчаткой',
        slots: {
            head: 'ignitium_helmet',
            chest: 'ignitium_chestplate',
            legs: 'ignitium_leggings',
            boots: 'ignitium_boots',
            mainHand: 'infernal_forge',
            offHand: 'gauntlet_of_guard',
            back: 'none'
        }
    },
    frostfall_warrior: {
        id: 'frostfall_warrior',
        name: 'Воин Simply Swords',
        icon: '❄️',
        desc: 'Алмазная броня с Ледяным Клинком Frostfall и Кристальным Сердцем',
        slots: {
            head: 'diamond_helmet',
            chest: 'diamond_chestplate',
            legs: 'diamond_leggings',
            boots: 'diamond_boots',
            mainHand: 'frostfall',
            offHand: 'crystal_heart',
            back: 'backpack_diamond'
        }
    },
    mekanoid_cyber: {
        id: 'mekanoid_cyber',
        name: 'Кибер-Меканоид',
        icon: '🤖',
        desc: 'Высокотехнологичный экзоскелет MekaSuit с Атомным разборщиком',
        slots: {
            head: 'mekasuit_helmet',
            chest: 'mekasuit_body',
            legs: 'mekasuit_pants',
            boots: 'mekasuit_boots',
            mainHand: 'atomic_disassembler',
            offHand: 'fire_gauntlet',
            back: 'elytra_wings'
        }
    },
    clean_skin: {
        id: 'clean_skin',
        name: 'Чистый скин',
        icon: '✨',
        desc: 'Оригинальный вид игрока без дополнительного снаряжения',
        slots: {
            head: 'none',
            chest: 'none',
            legs: 'none',
            boots: 'none',
            mainHand: 'none',
            offHand: 'none',
            back: 'none'
        }
    }
};

/**
 * Класс управления 3D экипировкой
 */
class EquipmentManager {
    constructor() {
        this.currentEquipment = {
            head: 'none',
            chest: 'none',
            legs: 'none',
            boots: 'none',
            mainHand: 'none',
            offHand: 'none',
            back: 'none'
        };

        this.listeners = new Set();
        this.activeAttachedObjects = new Map();
        this.loadEquipment();
    }

    loadEquipment() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_EQUIPMENT);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.currentEquipment = { ...this.currentEquipment, ...parsed };
            }
        } catch (e) {
            console.debug('[EquipmentManager] Load error', e);
        }
    }

    saveEquipment() {
        try {
            localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(this.currentEquipment));
        } catch (e) {
            console.debug('[EquipmentManager] Save error', e);
        }
    }

    getSlot(slotName) {
        return this.currentEquipment[slotName] || 'none';
    }

    getEquipment() {
        return { ...this.currentEquipment };
    }

    setSlot(slotName, itemId) {
        if (EQUIPMENT_CATALOG[slotName] && EQUIPMENT_CATALOG[slotName][itemId]) {
            this.currentEquipment[slotName] = itemId;
            this.saveEquipment();
            this.notifyListeners();
        }
    }

    applyPreset(presetId) {
        if (presetId === 'random') {
            this.randomizeEquipment();
            return;
        }
        const preset = EQUIPMENT_PRESETS[presetId];
        if (preset && preset.slots) {
            this.currentEquipment = { ...preset.slots };
            this.saveEquipment();
            this.notifyListeners();
        }
    }

    /**
     * Рандомизация экипировки персонажа из полного пула предметов
     */
    randomizeEquipment() {
        const pickRandom = (slotName, allowNoneChance = 0.25) => {
            const keys = Object.keys(EQUIPMENT_CATALOG[slotName]);
            if (Math.random() < allowNoneChance && keys.includes('none')) {
                return 'none';
            }
            const nonNone = keys.filter(k => k !== 'none');
            return nonNone[Math.floor(Math.random() * nonNone.length)] || 'none';
        };

        this.currentEquipment.head = pickRandom('head', 0.25);
        this.currentEquipment.chest = pickRandom('chest', 0.15);
        this.currentEquipment.legs = pickRandom('legs', 0.15);
        this.currentEquipment.boots = pickRandom('boots', 0.15);
        this.currentEquipment.mainHand = pickRandom('mainHand', 0.05);
        this.currentEquipment.offHand = pickRandom('offHand', 0.35);
        this.currentEquipment.back = pickRandom('back', 0.45);

        this.saveEquipment();
        this.notifyListeners();
    }

    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    notifyListeners() {
        this.listeners.forEach(fn => {
            try { fn(this.currentEquipment); } catch (e) { console.error(e); }
        });
    }

    /**
     * Применение 3D экипировки к модели Three.js SkinViewer
     */
    async applyToViewer(viewer) {
        if (!viewer || !viewer.playerObject || !viewer.playerObject.skin) return;

        const skin = viewer.playerObject.skin;
        this.clearAllEquipment(skin);

        // 1. Голова / Шлем
        if (this.currentEquipment.head !== 'none') {
            const item = EQUIPMENT_CATALOG.head[this.currentEquipment.head];
            if (item && skin.head) {
                let mesh = null;
                if (item.armorTex) {
                    mesh = armorMeshBuilder.buildHelmet(item.armorTex, item);
                } else if (item.id === 'create_goggles') {
                    mesh = this.buildCreateGoggles();
                } else if (item.id === 'twilight_crown') {
                    mesh = this.buildTwilightCrown();
                }
                if (mesh) {
                    skin.head.add(mesh);
                    this.activeAttachedObjects.set('head', mesh);
                }
            }
        }

        // 2. Нагрудник / Броня
        if (this.currentEquipment.chest !== 'none') {
            const item = EQUIPMENT_CATALOG.chest[this.currentEquipment.chest];
            if (item && skin.body) {
                let mesh = null;
                if (item.armorTex) {
                    mesh = armorMeshBuilder.buildChestplate(item.armorTex, skin, item);
                }
                if (mesh) {
                    skin.body.add(mesh);
                    this.activeAttachedObjects.set('chest', mesh);
                }
            }
        }

        // 3. Поножи
        if (this.currentEquipment.legs !== 'none') {
            const item = EQUIPMENT_CATALOG.legs[this.currentEquipment.legs];
            if (item && item.armorLegsTex) {
                armorMeshBuilder.buildLeggings(item.armorLegsTex, skin, item);
            }
        }

        // 4. Ботинки
        if (this.currentEquipment.boots !== 'none') {
            const item = EQUIPMENT_CATALOG.boots[this.currentEquipment.boots];
            if (item && item.armorTex) {
                armorMeshBuilder.buildBoots(item.armorTex, skin, item);
            }
        }

        // 5. Основная рука (Реальные TACZ 3D пушки или 3D воксельное оружие)
        if (this.currentEquipment.mainHand !== 'none') {
            const item = EQUIPMENT_CATALOG.mainHand[this.currentEquipment.mainHand];
            if (item && skin.rightArm) {
                const weaponMesh = await this.buildWeaponMesh(item);
                if (weaponMesh && skin.rightArm) {
                    skin.rightArm.add(weaponMesh);
                    this.activeAttachedObjects.set('mainHand', weaponMesh);
                }
            }
        }

        // 6. Вторая рука
        if (this.currentEquipment.offHand !== 'none') {
            const item = EQUIPMENT_CATALOG.offHand[this.currentEquipment.offHand];
            if (item && skin.leftArm) {
                const offMesh = await this.buildOffHandMesh(item);
                if (offMesh && skin.leftArm) {
                    skin.leftArm.add(offMesh);
                    this.activeAttachedObjects.set('offHand', offMesh);
                }
            }
        }

        // 7. Спина (Рюкзак / Крылья)
        if (this.currentEquipment.back !== 'none') {
            const item = EQUIPMENT_CATALOG.back[this.currentEquipment.back];
            if (item && skin.body) {
                const backMesh = this.buildBackMesh(item);
                if (backMesh) {
                    skin.body.add(backMesh);
                    this.activeAttachedObjects.set('back', backMesh);
                }
            }
        }
    }

    clearAllEquipment(skin) {
        if (!skin) return;
        const parts = [skin.head, skin.body, skin.rightArm, skin.leftArm, skin.rightLeg, skin.leftLeg];

        parts.forEach(part => {
            if (!part) return;
            for (let i = part.children.length - 1; i >= 0; i--) {
                const child = part.children[i];
                if (child.name && (
                    child.name.startsWith('EQ_') || 
                    child.name.startsWith('ARMOR_') || 
                    child.name.startsWith('TACZ_') || 
                    child.name.startsWith('VOXEL_')
                )) {
                    part.remove(child);
                }
            }
        });
        this.activeAttachedObjects.clear();
    }

    // ── Построение Очков Create ──
    buildCreateGoggles() {
        const group = new THREE.Group();
        group.name = 'ARMOR_HELMET_create_goggles';

        const frameGeo = new THREE.BoxGeometry(8.6, 2.8, 1.2);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.5 });
        const frameMesh = new THREE.Mesh(frameGeo, frameMat);
        frameMesh.position.set(0, 4, 4.4);
        group.add(frameMesh);

        const lensGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.6, 12);
        const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.85 });
        
        const lensL = new THREE.Mesh(lensGeo, lensMat);
        lensL.rotation.x = Math.PI / 2;
        lensL.position.set(-2.2, 4, 4.8);
        group.add(lensL);

        const lensR = new THREE.Mesh(lensGeo, lensMat);
        lensR.rotation.x = Math.PI / 2;
        lensR.position.set(2.2, 4, 4.8);
        group.add(lensR);
        return group;
    }

    // ── Построение Короны Сумерек ──
    buildTwilightCrown() {
        const group = new THREE.Group();
        group.name = 'ARMOR_HELMET_twilight_crown';

        const crownGeo = new THREE.BoxGeometry(8.8, 2.2, 8.8);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.9 });
        const crownMesh = new THREE.Mesh(crownGeo, crownMat);
        crownMesh.position.set(0, 7.5, 0);
        group.add(crownMesh);

        const rubyGeo = new THREE.BoxGeometry(1.2, 1.2, 0.4);
        const rubyMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const ruby = new THREE.Mesh(rubyGeo, rubyMat);
        ruby.position.set(0, 7.5, 4.5);
        group.add(ruby);
        return group;
    }

    // ── Построение 3D Оружия (TACZ Geo & Voxel Items) ──
    async buildWeaponMesh(item) {
        // 1. Реальное 3D Оружие TACZ из .geo.json
        if (item.type === 'tacz_geo' && item.geoGunId) {
            const gunMesh = await taczGeoLoader.loadGunModel(item.geoGunId);
            if (gunMesh) return gunMesh;
        }

        // 2. 3D Воксельное Оружие из 2D PNG модов
        if (item.type === 'voxel_item' && item.imgUrl) {
            const voxelMesh = await voxelItemBuilder.createItemMesh(item.imgUrl);
            if (voxelMesh) return voxelMesh;
        }

        return null;
    }

    // ── Построение 3D предметов Второй руки ──
    async buildOffHandMesh(item) {
        if (item.type === 'voxel_item' && item.imgUrl) {
            const voxelMesh = await voxelItemBuilder.createItemMesh(item.imgUrl, { isShield: true });
            if (voxelMesh) return voxelMesh;
        }

        const group = new THREE.Group();
        group.name = `EQ_OFFHAND_${item.id}`;

        if (item.id === 'shield') {
            const shieldGeo = new THREE.BoxGeometry(1.2, 16, 10);
            const shieldMat = new THREE.MeshStandardMaterial({ color: 0x164e63, roughness: 0.3, metalness: 0.6 });
            const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
            group.add(shieldMesh);
            group.position.set(2.5, -6, 0);
        } else if (item.id === 'totem_of_undying') {
            const totemGeo = new THREE.BoxGeometry(2.4, 4.8, 1.2);
            const totemMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });
            const totemMesh = new THREE.Mesh(totemGeo, totemMat);
            group.add(totemMesh);
            group.position.set(0, -8, 1.2);
        }

        return group;
    }

    // ── Построение 3D Рюкзаков / Спины ──
    buildBackMesh(item) {
        const group = new THREE.Group();
        group.name = `EQ_BACK_${item.id}`;

        if (item.id.includes('backpack')) {
            const baseColor = new THREE.Color(item.color || '#2c282e');
            const accentColor = new THREE.Color(item.accent || '#eab308');

            const bodyMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.7 });
            const buckleMat = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.9, roughness: 0.2 });

            // Корпус рюкзака
            const bodyGeo = new THREE.BoxGeometry(7.2, 9.6, 4.4);
            const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
            bodyMesh.position.set(0, 0, -4.0);
            group.add(bodyMesh);

            // Верхний клапан
            const flapGeo = new THREE.BoxGeometry(7.4, 3.2, 4.6);
            const flapMesh = new THREE.Mesh(flapGeo, bodyMat);
            flapMesh.position.set(0, 3.6, -4.0);
            group.add(flapMesh);

            // Пряжка
            const buckleGeo = new THREE.BoxGeometry(1.6, 1.2, 0.4);
            const buckleMesh = new THREE.Mesh(buckleGeo, buckleMat);
            buckleMesh.position.set(0, 2.0, -6.3);
            group.add(buckleMesh);
        } else if (item.id.includes('elytra')) {
            const elytraMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, side: THREE.DoubleSide });
            const wingGeo = new THREE.PlaneGeometry(6, 16);
            
            const wingL = new THREE.Mesh(wingGeo, elytraMat);
            wingL.rotation.set(0.3, 0.4, -0.4);
            wingL.position.set(-3, 0, -2.5);
            group.add(wingL);

            const wingR = new THREE.Mesh(wingGeo, elytraMat);
            wingR.rotation.set(0.3, -0.4, 0.4);
            wingR.position.set(3, 0, -2.5);
            group.add(wingR);
        }

        return group;
    }
}

export const equipmentManager = new EquipmentManager();
