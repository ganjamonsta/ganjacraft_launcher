/**
 * Ganj4Craft Launcher - 3D Character Equipment & Wardrobe Engine
 * Полнофункциональный менеджер 3D экипировки персонажа:
 * броня, шлемы, оружие из модов (Cataclysm, Simply Swords, Mekanism, Create),
 * рюкзаки, щиты и арсенал TACZ на базе Three.js в SkinViewer3D.
 */

import * as THREE from 'three';

const STORAGE_KEY_EQUIPMENT = 'ganjacraft_player_equipment_v1';

// ── Каталог экипировки ──
export const EQUIPMENT_CATALOG = {
    // 🪖 ШЛЕМЫ / ГОЛОВА
    head: {
        none: { id: 'none', name: 'Без шлема', icon: '👤', rarity: 'common' },
        netherite_helmet: { id: 'netherite_helmet', name: 'Незеритовый шлем', icon: '🪖', rarity: 'epic', color: '#2b272c', accent: '#70646c' },
        diamond_helmet: { id: 'diamond_helmet', name: 'Алмазный шлем', icon: '💎', rarity: 'rare', color: '#2cd8d5', accent: '#6ffffb' },
        ignitium_helmet: { id: 'ignitium_helmet', name: 'Шлем Игнития', mod: 'Cataclysm', icon: '🌋', rarity: 'mythic', color: '#b91c1c', accent: '#f97316' },
        cursium_helmet: { id: 'cursium_helmet', name: 'Шлем Бездны Cursium', mod: 'Cataclysm', icon: '👁️', rarity: 'mythic', color: '#4c1d95', accent: '#a855f7' },
        create_goggles: { id: 'create_goggles', name: 'Очки инженера', mod: 'Create', icon: '⚙️', rarity: 'uncommon', color: '#d97706', accent: '#38bdf8' },
        mekasuit_helmet: { id: 'mekasuit_helmet', name: 'MekaSuit Helmet', mod: 'Mekanism', icon: '🤖', rarity: 'legendary', color: '#0f172a', accent: '#00f2fe' },
        twilight_crown: { id: 'twilight_crown', name: 'Корона Сумерек', mod: 'Twilight Forest', icon: '👑', rarity: 'legendary', color: '#eab308', accent: '#ef4444' }
    },

    // 🎽 НАГРУДНИК / ТЕЛО
    chest: {
        none: { id: 'none', name: 'Без брони', icon: '👕', rarity: 'common' },
        netherite_chestplate: { id: 'netherite_chestplate', name: 'Незеритовый нагрудник', icon: '🛡️', rarity: 'epic', color: '#2b272c', accent: '#70646c' },
        diamond_chestplate: { id: 'diamond_chestplate', name: 'Алмазный нагрудник', icon: '💎', rarity: 'rare', color: '#2cd8d5', accent: '#6ffffb' },
        ignitium_chestplate: { id: 'ignitium_chestplate', name: 'Нагрудник Игнития', mod: 'Cataclysm', icon: '🌋', rarity: 'mythic', color: '#b91c1c', accent: '#f97316' },
        cursium_chestplate: { id: 'cursium_chestplate', name: 'Нагрудник Cursium', mod: 'Cataclysm', icon: '👁️', rarity: 'mythic', color: '#4c1d95', accent: '#a855f7' },
        mekasuit_body: { id: 'mekasuit_body', name: 'MekaSuit BodyArmor', mod: 'Mekanism', icon: '🤖', rarity: 'legendary', color: '#0f172a', accent: '#00f2fe' },
        elytra: { id: 'elytra', name: 'Элитры', icon: '🪽', rarity: 'legendary', color: '#555a6d', accent: '#8890a6' }
    },

    // 👖 ПОНОЖИ / НОГИ
    legs: {
        none: { id: 'none', name: 'Без поножей', icon: '🩳', rarity: 'common' },
        netherite_leggings: { id: 'netherite_leggings', name: 'Незеритовые поножи', icon: '👖', rarity: 'epic', color: '#2b272c', accent: '#70646c' },
        diamond_leggings: { id: 'diamond_leggings', name: 'Алмазные поножи', icon: '💎', rarity: 'rare', color: '#2cd8d5', accent: '#6ffffb' },
        ignitium_leggings: { id: 'ignitium_leggings', name: 'Поножи Игнития', mod: 'Cataclysm', icon: '🌋', rarity: 'mythic', color: '#b91c1c', accent: '#f97316' },
        mekasuit_pants: { id: 'mekasuit_pants', name: 'MekaSuit Pants', mod: 'Mekanism', icon: '🤖', rarity: 'legendary', color: '#0f172a', accent: '#00f2fe' }
    },

    // 👢 БОТИНКИ / СТУПНИ
    boots: {
        none: { id: 'none', name: 'Без ботинок', icon: '🧦', rarity: 'common' },
        netherite_boots: { id: 'netherite_boots', name: 'Незеритовые ботинки', icon: '👢', rarity: 'epic', color: '#2b272c', accent: '#70646c' },
        diamond_boots: { id: 'diamond_boots', name: 'Алмазные ботинки', icon: '💎', rarity: 'rare', color: '#2cd8d5', accent: '#6ffffb' },
        ignitium_boots: { id: 'ignitium_boots', name: 'Ботинки Игнития', mod: 'Cataclysm', icon: '🌋', rarity: 'mythic', color: '#b91c1c', accent: '#f97316' },
        mekasuit_boots: { id: 'mekasuit_boots', name: 'MekaSuit Boots', mod: 'Mekanism', icon: '🤖', rarity: 'legendary', color: '#0f172a', accent: '#00f2fe' }
    },

    // ⚔️ ОСНОВНАЯ РУКА (Оружие, Инструменты, Огнестрел TACZ)
    mainHand: {
        none: { id: 'none', name: 'Пустая рука', icon: '✊', rarity: 'common' },
        netherite_sword: { id: 'netherite_sword', name: 'Незеритовый меч', icon: '⚔️', rarity: 'epic', type: 'sword' },
        diamond_sword: { id: 'diamond_sword', name: 'Алмазный меч', icon: '🗡️', rarity: 'rare', type: 'sword' },
        netherite_pickaxe: { id: 'netherite_pickaxe', name: 'Незеритовая кирка', icon: '⛏️', rarity: 'epic', type: 'tool' },
        ignitium_crusher: { id: 'ignitium_crusher', name: 'Крушитель Игнития', mod: 'Cataclysm', icon: '🔨', rarity: 'mythic', type: 'heavy' },
        the_incinerator: { id: 'the_incinerator', name: 'Испепелитель', mod: 'Cataclysm', icon: '🔥', rarity: 'mythic', type: 'sword' },
        frostfall: { id: 'frostfall', name: 'Frostfall (Ледяной клинок)', mod: 'Simply Swords', icon: '❄️', rarity: 'legendary', type: 'sword' },
        soulkeeper: { id: 'soulkeeper', name: 'Хранитель Душ', mod: 'Simply Swords', icon: '⚡', rarity: 'legendary', type: 'sword' },
        atomic_disassembler: { id: 'atomic_disassembler', name: 'Атомный разборщик', mod: 'Mekanism', icon: '🔮', rarity: 'legendary', type: 'tool' },
        
        // Огнестрел TACZ
        tacz_ak47: { id: 'tacz_ak47', name: 'TACZ: AK-47', mod: 'TACZ', icon: 'assets/tacz/hud/ak47.png', isImage: true, rarity: 'epic', type: 'gun' },
        tacz_deagle: { id: 'tacz_deagle', name: 'TACZ: Desert Eagle .50', mod: 'TACZ', icon: 'assets/tacz/hud/deagle.png', isImage: true, rarity: 'rare', type: 'gun' },
        tacz_spas12: { id: 'tacz_spas12', name: 'TACZ: SPAS-12', mod: 'TACZ', icon: 'assets/tacz/hud/spas_12.png', isImage: true, rarity: 'epic', type: 'gun' },
        tacz_vector45: { id: 'tacz_vector45', name: 'TACZ: Vector .45', mod: 'TACZ', icon: 'assets/tacz/hud/vector45.png', isImage: true, rarity: 'legendary', type: 'gun' },
        tacz_awp: { id: 'tacz_awp', name: 'TACZ: AWP Sniper', mod: 'TACZ', icon: 'assets/tacz/hud/ai_awp.png', isImage: true, rarity: 'legendary', type: 'gun' },
        tacz_rpg7: { id: 'tacz_rpg7', name: 'TACZ: RPG-7', mod: 'TACZ', icon: 'assets/tacz/hud/rpg7.png', isImage: true, rarity: 'mythic', type: 'gun' },
        tacz_minigun: { id: 'tacz_minigun', name: 'TACZ: Minigun', mod: 'TACZ', icon: 'assets/tacz/hud/minigun.png', isImage: true, rarity: 'mythic', type: 'gun' }
    },

    // 🛡️ ВТОРАЯ РУКА (Off-Hand)
    offHand: {
        none: { id: 'none', name: 'Пусто', icon: '✋', rarity: 'common' },
        shield: { id: 'shield', name: 'Боевой Щит', icon: '🛡️', rarity: 'rare' },
        totem_of_undying: { id: 'totem_of_undying', name: 'Тотем бессмертия', icon: '🌟', rarity: 'legendary' },
        eternal_steak: { id: 'eternal_steak', name: 'Вечный стейк', mod: 'Artifacts', icon: '🥩', rarity: 'epic' },
        soul_torch: { id: 'soul_torch', name: 'Факел душ', icon: '🕯️', rarity: 'uncommon' }
    },

    // 🎒 СПИНА (Рюкзак / Крылья)
    back: {
        none: { id: 'none', name: 'Пусто', icon: '🚫', rarity: 'common' },
        backpack_netherite: { id: 'backpack_netherite', name: 'Рюкзак (Незеритовый)', mod: 'Sophisticated Backpacks', icon: '🎒', rarity: 'epic', color: '#2c282e', accent: '#eab308' },
        backpack_diamond: { id: 'backpack_diamond', name: 'Рюкзак (Алмазный)', mod: 'Sophisticated Backpacks', icon: '🎒', rarity: 'rare', color: '#164e63', accent: '#2cd8d5' },
        elytra_wings: { id: 'elytra_wings', name: 'Крылья Элитры', icon: '🪽', rarity: 'legendary' }
    }
};

// ── Быстрые пресеты ──
export const EQUIPMENT_PRESETS = {
    netherite_warrior: {
        id: 'netherite_warrior',
        name: 'Воин Незерита',
        icon: '🖤',
        desc: 'Тяжелый комплект из чистого незерита с мечом и щитом',
        slots: {
            head: 'netherite_helmet',
            chest: 'netherite_chestplate',
            legs: 'netherite_leggings',
            boots: 'netherite_boots',
            mainHand: 'netherite_sword',
            offHand: 'shield',
            back: 'backpack_netherite'
        }
    },
    diamond_champion: {
        id: 'diamond_champion',
        name: 'Алмазный Чемпион',
        icon: '💎',
        desc: 'Сверкающий алмазный сет с мечом и тотемом',
        slots: {
            head: 'diamond_helmet',
            chest: 'diamond_chestplate',
            legs: 'diamond_leggings',
            boots: 'diamond_boots',
            mainHand: 'diamond_sword',
            offHand: 'totem_of_undying',
            back: 'backpack_diamond'
        }
    },
    ignitium_berserk: {
        id: 'ignitium_berserk',
        name: 'Берсерк Игнития',
        icon: '🌋',
        desc: 'Инфернальный сет из Cataclysm с Крушителем Игнития',
        slots: {
            head: 'ignitium_helmet',
            chest: 'ignitium_chestplate',
            legs: 'ignitium_leggings',
            boots: 'ignitium_boots',
            mainHand: 'ignitium_crusher',
            offHand: 'none',
            back: 'none'
        }
    },
    mekanoid_cyber: {
        id: 'mekanoid_cyber',
        name: 'Кибер-Меканоид',
        icon: '🤖',
        desc: 'Высокотехнологичный экзоскелет MekaSuit с дезинтегратором',
        slots: {
            head: 'mekasuit_helmet',
            chest: 'mekasuit_body',
            legs: 'mekasuit_pants',
            boots: 'mekasuit_boots',
            mainHand: 'atomic_disassembler',
            offHand: 'none',
            back: 'none'
        }
    },
    tacz_specops: {
        id: 'tacz_specops',
        name: 'Спецназ TACZ',
        icon: '🔫',
        desc: 'Тактический штурмовик с автоматом Калашникова и рюкзаком',
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
    create_engineer: {
        id: 'create_engineer',
        name: 'Инженер Create',
        icon: '⚙️',
        desc: 'Очки инженера, кирка и походный рюкзак исследователя',
        slots: {
            head: 'create_goggles',
            chest: 'none',
            legs: 'netherite_leggings',
            boots: 'netherite_boots',
            mainHand: 'netherite_pickaxe',
            offHand: 'soul_torch',
            back: 'backpack_diamond'
        }
    },
    clean_skin: {
        id: 'clean_skin',
        name: 'Чистый скин',
        icon: '✨',
        desc: 'Снять всю экипировку и оставить базовый скин',
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

class CharacterEquipmentManager {
    constructor() {
        this.currentEquipment = {
            head: 'none',
            chest: 'none',
            legs: 'none',
            boots: 'none',
            mainHand: 'tacz_ak47',
            offHand: 'shield',
            back: 'backpack_netherite'
        };

        this.activeMeshes = {
            head: null,
            chest: [],
            legs: [],
            boots: [],
            mainHand: null,
            offHand: null,
            back: null
        };

        this.materialsCache = new Map();
        this.loadEquipment();
    }

    loadEquipment() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_EQUIPMENT);
            if (raw) {
                const saved = JSON.parse(raw);
                this.currentEquipment = { ...this.currentEquipment, ...saved };
            }
        } catch (e) {
            console.debug('[EquipmentManager] Load error:', e);
        }
    }

    saveEquipment() {
        try {
            localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(this.currentEquipment));
        } catch (e) {
            console.debug('[EquipmentManager] Save error:', e);
        }
    }

    getEquipment() {
        return { ...this.currentEquipment };
    }

    setSlot(slot, itemId) {
        if (!EQUIPMENT_CATALOG[slot] || !EQUIPMENT_CATALOG[slot][itemId]) return;
        this.currentEquipment[slot] = itemId;
        this.saveEquipment();
    }

    applyPreset(presetId) {
        const preset = EQUIPMENT_PRESETS[presetId];
        if (!preset) return;
        this.currentEquipment = { ...preset.slots };
        this.saveEquipment();
    }

    /**
     * Создание Three.js материала с кэшированием
     */
    getMaterial(colorHex, emissiveHex = '#000000', roughness = 0.45, metalness = 0.35) {
        const key = `${colorHex}_${emissiveHex}_${roughness}_${metalness}`;
        if (this.materialsCache.has(key)) {
            return this.materialsCache.get(key);
        }

        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorHex),
            emissive: new THREE.Color(emissiveHex),
            roughness,
            metalness,
            side: THREE.DoubleSide
        });

        this.materialsCache.set(key, mat);
        return mat;
    }

    /**
     * Применение текущей экипировки к 3D модели SkinViewer3D
     * @param {import('skinview3d').SkinViewer} viewer 
     */
    applyToViewer(viewer) {
        if (!viewer || !viewer.playerObject || !viewer.playerObject.skin) return;

        const skin = viewer.playerObject.skin;
        this.cleanupMeshes();

        // 1. ШЛЕМ
        this.buildHelmet(skin, this.currentEquipment.head);

        // 2. НАГРУДНИК / НАПЛЕЧНИКИ
        this.buildChestplate(skin, this.currentEquipment.chest);

        // 3. ПОНОЖИ
        this.buildLeggings(skin, this.currentEquipment.legs);

        // 4. БОТИНКИ
        this.buildBoots(skin, this.currentEquipment.boots);

        // 5. ОСНОВНАЯ РУКА (Оружие / Инструмент)
        this.buildMainHand(skin, this.currentEquipment.mainHand);

        // 6. ВТОРАЯ РУКА (Щит / Тотем)
        this.buildOffHand(skin, this.currentEquipment.offHand);

        // 7. СПИНА (Рюкзак / Элитры)
        this.buildBack(skin, viewer.playerObject, this.currentEquipment.back);
    }

    cleanupMeshes() {
        // Удаляем старые прикрепленные объекты
        if (this.activeMeshes.head && this.activeMeshes.head.parent) {
            this.activeMeshes.head.parent.remove(this.activeMeshes.head);
        }
        this.activeMeshes.head = null;

        this.activeMeshes.chest.forEach(m => m.parent && m.parent.remove(m));
        this.activeMeshes.chest = [];

        this.activeMeshes.legs.forEach(m => m.parent && m.parent.remove(m));
        this.activeMeshes.legs = [];

        this.activeMeshes.boots.forEach(m => m.parent && m.parent.remove(m));
        this.activeMeshes.boots = [];

        if (this.activeMeshes.mainHand && this.activeMeshes.mainHand.parent) {
            this.activeMeshes.mainHand.parent.remove(this.activeMeshes.mainHand);
        }
        this.activeMeshes.mainHand = null;

        if (this.activeMeshes.offHand && this.activeMeshes.offHand.parent) {
            this.activeMeshes.offHand.parent.remove(this.activeMeshes.offHand);
        }
        this.activeMeshes.offHand = null;

        if (this.activeMeshes.back && this.activeMeshes.back.parent) {
            this.activeMeshes.back.parent.remove(this.activeMeshes.back);
        }
        this.activeMeshes.back = null;
    }

    // ── Построение 3D элементов экипировки ──

    buildHelmet(skin, id) {
        if (id === 'none') return;
        const group = new THREE.Group();
        group.name = 'equip_helmet';

        const item = EQUIPMENT_CATALOG.head[id];
        const mainColor = item?.color || '#2b272c';
        const accentColor = item?.accent || '#70646c';

        if (id === 'create_goggles') {
            // Очки инженера Create (кожаный ремешок + латунные окуляры + линзы)
            const strapMat = this.getMaterial('#78350f', '#000000', 0.8, 0.1);
            const brassMat = this.getMaterial('#d97706', '#000000', 0.3, 0.8);
            const lensMat = this.getMaterial('#38bdf8', '#0284c7', 0.1, 0.9);

            // Ремешок вокруг головы
            const strapGeo = new THREE.BoxGeometry(9.2, 1.8, 9.2);
            const strapMesh = new THREE.Mesh(strapGeo, strapMat);
            strapMesh.position.set(0, 4.2, 0);
            group.add(strapMesh);

            // Левый и правый окуляр
            const eyepieceGeo = new THREE.CylinderGeometry(1.6, 1.6, 1.2, 16);
            eyepieceGeo.rotateX(Math.PI / 2);

            const leftEye = new THREE.Mesh(eyepieceGeo, brassMat);
            leftEye.position.set(-2.0, 4.2, 4.8);
            group.add(leftEye);

            const rightEye = new THREE.Mesh(eyepieceGeo, brassMat);
            rightEye.position.set(2.0, 4.2, 4.8);
            group.add(rightEye);

            // Линзы
            const lensGeo = new THREE.CircleGeometry(1.3, 16);
            const leftLens = new THREE.Mesh(lensGeo, lensMat);
            leftLens.position.set(-2.0, 4.2, 5.45);
            group.add(leftLens);

            const rightLens = new THREE.Mesh(lensGeo, lensMat);
            rightLens.position.set(2.0, 4.2, 5.45);
            group.add(rightLens);
        } else if (id === 'twilight_crown') {
            // Корона Сумерек
            const goldMat = this.getMaterial('#eab308', '#ca8a04', 0.2, 0.9);
            const rubyMat = this.getMaterial('#ef4444', '#dc2626', 0.1, 0.5);

            const baseGeo = new THREE.BoxGeometry(9.2, 2.0, 9.2);
            const baseMesh = new THREE.Mesh(baseGeo, goldMat);
            baseMesh.position.set(0, 8.2, 0);
            group.add(baseMesh);

            // Зубцы короны
            [-3.5, 0, 3.5].forEach(x => {
                const spikeGeo = new THREE.ConeGeometry(1.0, 2.2, 4);
                const spike = new THREE.Mesh(spikeGeo, goldMat);
                spike.position.set(x, 10.2, 4.4);
                group.add(spike);

                const rubyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                const ruby = new THREE.Mesh(rubyGeo, rubyMat);
                ruby.position.set(x, 8.2, 4.8);
                group.add(ruby);
            });
        } else {
            // Стандартный / Незеритовый / Игнитий / MekaSuit шлем
            const baseMat = this.getMaterial(mainColor, id.includes('ignitium') ? '#7f1d1d' : '#000000', 0.4, 0.5);
            const trimMat = this.getMaterial(accentColor, id.includes('ignitium') ? '#ea580c' : (id.includes('mekasuit') ? '#00f2fe' : '#000000'), 0.2, 0.8);

            // Верх и бока шлема
            const helmGeo = new THREE.BoxGeometry(9.3, 9.3, 9.3);
            const helmMesh = new THREE.Mesh(helmGeo, baseMat);
            helmMesh.position.set(0, 4.2, 0);
            group.add(helmMesh);

            // Лицевой козырек / рога / гребень
            if (id.includes('ignitium')) {
                // Огненные рога
                [-4.2, 4.2].forEach(x => {
                    const hornGeo = new THREE.ConeGeometry(1.2, 4.5, 6);
                    hornGeo.rotateZ(x < 0 ? 0.4 : -0.4);
                    const horn = new THREE.Mesh(hornGeo, trimMat);
                    horn.position.set(x, 9.0, 0);
                    group.add(horn);
                });
            } else if (id.includes('mekasuit')) {
                // Кибер-визор
                const visorGeo = new THREE.BoxGeometry(8.4, 2.4, 1.2);
                const visor = new THREE.Mesh(visorGeo, trimMat);
                visor.position.set(0, 4.2, 4.8);
                group.add(visor);
            } else {
                // Гребень шлема
                const crestGeo = new THREE.BoxGeometry(2.0, 2.0, 9.6);
                const crest = new THREE.Mesh(crestGeo, trimMat);
                crest.position.set(0, 8.8, 0);
                group.add(crest);
            }
        }

        skin.head.add(group);
        this.activeMeshes.head = group;
    }

    buildChestplate(skin, id) {
        if (id === 'none') return;
        const item = EQUIPMENT_CATALOG.chest[id];
        const mainColor = item?.color || '#2b272c';
        const accentColor = item?.accent || '#70646c';

        const armorMat = this.getMaterial(mainColor, id.includes('ignitium') ? '#7f1d1d' : '#000000', 0.4, 0.4);
        const trimMat = this.getMaterial(accentColor, id.includes('mekasuit') ? '#00f2fe' : (id.includes('ignitium') ? '#f97316' : '#000000'), 0.3, 0.7);

        // 1. Тело
        const bodyArmorGeo = new THREE.BoxGeometry(8.9, 12.4, 4.9);
        const bodyArmor = new THREE.Mesh(bodyArmorGeo, armorMat);
        bodyArmor.position.set(0, 0, 0);
        skin.body.add(bodyArmor);
        this.activeMeshes.chest.push(bodyArmor);

        // Нагрудный знак / реактор
        const emblemGeo = new THREE.BoxGeometry(3.5, 3.5, 5.2);
        const emblem = new THREE.Mesh(emblemGeo, trimMat);
        emblem.position.set(0, 2.5, 0);
        skin.body.add(emblem);
        this.activeMeshes.chest.push(emblem);

        // 2. Наплечники (Правый и Левый)
        const pauldronGeo = new THREE.BoxGeometry(5.0, 4.5, 5.0);

        const rightPauldron = new THREE.Mesh(pauldronGeo, armorMat);
        rightPauldron.position.set(0, -1.0, 0);
        skin.rightArm.add(rightPauldron);
        this.activeMeshes.chest.push(rightPauldron);

        const leftPauldron = new THREE.Mesh(pauldronGeo, armorMat);
        leftPauldron.position.set(0, -1.0, 0);
        skin.leftArm.add(leftPauldron);
        this.activeMeshes.chest.push(leftPauldron);
    }

    buildLeggings(skin, id) {
        if (id === 'none') return;
        const item = EQUIPMENT_CATALOG.legs[id];
        const mainColor = item?.color || '#2b272c';
        const legMat = this.getMaterial(mainColor, '#000000', 0.45, 0.35);

        // Пояс на теле
        const beltGeo = new THREE.BoxGeometry(8.7, 3.2, 4.7);
        const belt = new THREE.Mesh(beltGeo, legMat);
        belt.position.set(0, -4.5, 0);
        skin.body.add(belt);
        this.activeMeshes.legs.push(belt);

        // Поножи на правой и левой ногах
        const legArmorGeo = new THREE.BoxGeometry(4.7, 8.5, 4.7);

        const rightLegArmor = new THREE.Mesh(legArmorGeo, legMat);
        rightLegArmor.position.set(0, -4.2, 0);
        skin.rightLeg.add(rightLegArmor);
        this.activeMeshes.legs.push(rightLegArmor);

        const leftLegArmor = new THREE.Mesh(legArmorGeo, legMat);
        leftLegArmor.position.set(0, -4.2, 0);
        skin.leftLeg.add(leftLegArmor);
        this.activeMeshes.legs.push(leftLegArmor);
    }

    buildBoots(skin, id) {
        if (id === 'none') return;
        const item = EQUIPMENT_CATALOG.boots[id];
        const mainColor = item?.color || '#2b272c';
        const bootMat = this.getMaterial(mainColor, id.includes('mekasuit') ? '#00f2fe' : '#000000', 0.35, 0.5);

        const bootGeo = new THREE.BoxGeometry(4.8, 4.2, 5.2);

        const rightBoot = new THREE.Mesh(bootGeo, bootMat);
        rightBoot.position.set(0, -10.0, 0.2);
        skin.rightLeg.add(rightBoot);
        this.activeMeshes.boots.push(rightBoot);

        const leftBoot = new THREE.Mesh(bootGeo, bootMat);
        leftBoot.position.set(0, -10.0, 0.2);
        skin.leftLeg.add(leftBoot);
        this.activeMeshes.boots.push(leftBoot);
    }

    buildMainHand(skin, id) {
        if (id === 'none') return;
        const group = new THREE.Group();
        group.name = 'equip_mainhand';

        if (id.startsWith('tacz_')) {
            // TACZ Огнестрел (AK-47, Deagle, SPAS-12, AWP, Vector, RPG-7, Minigun)
            this.buildTACZGunModel(group, id);
        } else if (id.includes('crusher')) {
            // Крушитель Игнития (Тяжелый молот)
            const handleMat = this.getMaterial('#451a03', '#000000', 0.8, 0.1);
            const headMat = this.getMaterial('#b91c1c', '#7f1d1d', 0.3, 0.7);
            const magmaMat = this.getMaterial('#f97316', '#ea580c', 0.1, 0.9);

            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 26, 8), handleMat);
            handle.position.set(0, 2, 0);
            group.add(handle);

            const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 7), headMat);
            hammerHead.position.set(0, 13, 0);
            group.add(hammerHead);

            const magmaCore = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3, 7.4), magmaMat);
            magmaCore.position.set(0, 13, 0);
            group.add(magmaCore);
        } else if (id.includes('pickaxe')) {
            // Кирка
            const handleMat = this.getMaterial('#78350f', '#000000', 0.7, 0.1);
            const pickMat = this.getMaterial('#2b272c', '#000000', 0.3, 0.8);

            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 18, 8), handleMat);
            handle.position.set(0, 1, 0);
            group.add(handle);

            const head = new THREE.Mesh(new THREE.BoxGeometry(11, 1.8, 2.2), pickMat);
            head.position.set(0, 9, 0);
            head.rotation.z = -0.15;
            group.add(head);
        } else if (id.includes('disassembler')) {
            // Атомный разборщик Mekanism
            const bodyMat = this.getMaterial('#0f172a', '#000000', 0.2, 0.8);
            const laserMat = this.getMaterial('#00f2fe', '#00e5ff', 0.1, 0.9);

            const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 14, 3.5), bodyMat);
            body.position.set(0, 3, 0);
            group.add(body);

            const blade = new THREE.Mesh(new THREE.ConeGeometry(2.2, 10, 4), laserMat);
            blade.position.set(0, 13, 0);
            group.add(blade);
        } else {
            // Меч (Незеритовый / Алмазный / Frostfall / Soulkeeper / Incinerator)
            const isDiamond = id.includes('diamond');
            const isFrost = id.includes('frostfall');
            const isSoul = id.includes('soulkeeper');
            const isFire = id.includes('incinerator');

            let bladeColor = '#2b272c';
            let bladeEmissive = '#000000';
            if (isDiamond) { bladeColor = '#2cd8d5'; bladeEmissive = '#06b6d4'; }
            else if (isFrost) { bladeColor = '#7dd3fc'; bladeEmissive = '#0284c7'; }
            else if (isSoul) { bladeColor = '#a855f7'; bladeEmissive = '#7c3aed'; }
            else if (isFire) { bladeColor = '#f97316'; bladeEmissive = '#dc2626'; }

            const hiltMat = this.getMaterial('#78350f', '#000000', 0.7, 0.2);
            const guardMat = this.getMaterial('#eab308', '#000000', 0.2, 0.8);
            const bladeMat = this.getMaterial(bladeColor, bladeEmissive, 0.25, 0.7);

            // Рукоять
            const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 6, 8), hiltMat);
            hilt.position.set(0, -1, 0);
            group.add(hilt);

            // Гарда
            const guard = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.2, 2.2), guardMat);
            guard.position.set(0, 2, 0);
            group.add(guard);

            // Лезвие
            const blade = new THREE.Mesh(new THREE.BoxGeometry(2.2, 18, 0.8), bladeMat);
            blade.position.set(0, 11, 0);
            group.add(blade);

            const tip = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.5, 4), bladeMat);
            tip.position.set(0, 21.5, 0);
            tip.rotation.y = Math.PI / 4;
            group.add(tip);
        }

        // Позиция в руке (низ руки, разворот вперед)
        group.position.set(0, -10, 1.5);
        group.rotation.x = Math.PI / 2.8;
        group.rotation.z = -0.15;

        skin.rightArm.add(group);
        this.activeMeshes.mainHand = group;
    }

    /**
     * Построение 3D моделей пушек TACZ
     */
    buildTACZGunModel(group, id) {
        const gunMetalMat = this.getMaterial('#1e232a', '#000000', 0.35, 0.75);
        const darkMetalMat = this.getMaterial('#0f1216', '#000000', 0.45, 0.85);
        const woodMat = this.getMaterial('#78350f', '#000000', 0.7, 0.1);
        const laserMat = this.getMaterial('#ef4444', '#dc2626', 0.1, 0.9);

        if (id === 'tacz_ak47') {
            // AK-47: Ствольная коробка + Деревянное цевье и приклад + Рожок
            const receiver = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 12), gunMetalMat);
            receiver.position.set(0, 2, 0);
            group.add(receiver);

            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 8), gunMetalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 3, 10);
            group.add(barrel);

            const woodGrip = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 7), woodMat);
            woodGrip.position.set(0, 2.2, 7);
            group.add(woodGrip);

            const woodStock = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.0, 9), woodMat);
            woodStock.position.set(0, 0.8, -8);
            group.add(woodStock);

            // Изогнутый магазин
            const mag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 3), darkMetalMat);
            mag.position.set(0, -2.5, 3);
            mag.rotation.x = -0.3;
            group.add(mag);
        } else if (id === 'tacz_deagle') {
            // Desert Eagle .50 AE
            const slide = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, 9), gunMetalMat);
            slide.position.set(0, 2.5, 2);
            group.add(slide);

            const grip = new THREE.Mesh(new THREE.BoxGeometry(1.8, 5.2, 2.8), darkMetalMat);
            grip.position.set(0, -1.2, -1);
            grip.rotation.x = -0.25;
            group.add(grip);
        } else if (id === 'tacz_spas12') {
            // SPAS-12 Дробовик
            const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.5, 14), darkMetalMat);
            body.position.set(0, 2, 0);
            group.add(body);

            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 16, 8), gunMetalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 3.2, 10);
            group.add(barrel);

            const pump = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 5), darkMetalMat);
            pump.position.set(0, 1.8, 6);
            group.add(pump);
        } else if (id === 'tacz_awp') {
            // AWP Sniper Rifle
            const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.6, 16), this.getMaterial('#334155', '#000000', 0.5, 0.4));
            body.position.set(0, 2, 0);
            group.add(body);

            const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 22, 8), gunMetalMat);
            longBarrel.rotation.x = Math.PI / 2;
            longBarrel.position.set(0, 3.2, 16);
            group.add(longBarrel);

            // Оптический прицел
            const scope = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 9, 12), darkMetalMat);
            scope.rotation.x = Math.PI / 2;
            scope.position.set(0, 5.5, 2);
            group.add(scope);
        } else if (id === 'tacz_rpg7') {
            // RPG-7 Гранатомет
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 26, 12), this.getMaterial('#475569', '#000000', 0.5, 0.5));
            tube.rotation.x = Math.PI / 2;
            tube.position.set(0, 3, 2);
            group.add(tube);

            // Ракета на конце
            const rocketMat = this.getMaterial('#15803d', '#14532d', 0.4, 0.3);
            const warhead = new THREE.Mesh(new THREE.ConeGeometry(2.8, 7, 10), rocketMat);
            warhead.rotation.x = Math.PI / 2;
            warhead.position.set(0, 3, 17);
            group.add(warhead);
        } else if (id === 'tacz_minigun') {
            // Minigun (6 стволов)
            const mainBody = new THREE.Mesh(new THREE.BoxGeometry(4.5, 5, 12), darkMetalMat);
            mainBody.position.set(0, 1, 0);
            group.add(mainBody);

            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 18, 8), gunMetalMat);
                b.rotation.x = Math.PI / 2;
                b.position.set(Math.cos(angle) * 1.8, 1 + Math.sin(angle) * 1.8, 12);
                group.add(b);
            }
        } else {
            // Vector .45 SMG
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 4.5, 10), darkMetalMat);
            body.position.set(0, 2, 2);
            group.add(body);

            const mag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8, 2.2), gunMetalMat);
            mag.position.set(0, -2, 5);
            group.add(mag);
        }
    }

    buildOffHand(skin, id) {
        if (id === 'none') return;
        const group = new THREE.Group();
        group.name = 'equip_offhand';

        if (id === 'shield') {
            // Рыцарский щит Ganj4Craft
            const woodMat = this.getMaterial('#78350f', '#000000', 0.7, 0.1);
            const ironRimMat = this.getMaterial('#94a3b8', '#000000', 0.25, 0.85);
            const emblemMat = this.getMaterial('#39ff14', '#15803d', 0.2, 0.8);

            const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(11, 16, 1.2), woodMat);
            group.add(shieldPlate);

            const shieldRim = new THREE.Mesh(new THREE.BoxGeometry(11.8, 16.8, 0.8), ironRimMat);
            shieldRim.position.set(0, 0, -0.4);
            group.add(shieldRim);

            // Неоновый знак
            const emblem = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.8), emblemMat);
            emblem.position.set(0, 1, 0.8);
            group.add(emblem);

            group.position.set(3.5, -6, 1.5);
            group.rotation.y = Math.PI / 2;
        } else if (id === 'totem_of_undying') {
            // Тотем бессмертия
            const goldMat = this.getMaterial('#eab308', '#ca8a04', 0.15, 0.9);
            const emeraldMat = this.getMaterial('#10b981', '#059669', 0.1, 0.7);

            const totemBody = new THREE.Mesh(new THREE.BoxGeometry(3.5, 6.5, 2.0), goldMat);
            group.add(totemBody);

            const wings = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.2, 1.4), goldMat);
            wings.position.set(0, 1.5, 0);
            group.add(wings);

            const eyes = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 2.2), emeraldMat);
            eyes.position.set(0, 2.2, 0.2);
            group.add(eyes);

            group.position.set(0, -9, 1.2);
            group.rotation.x = Math.PI / 4;
        } else if (id === 'soul_torch') {
            // Факел душ
            const woodMat = this.getMaterial('#78350f', '#000000', 0.8, 0.1);
            const flameMat = this.getMaterial('#00e5ff', '#0284c7', 0.05, 0.95);

            const wood = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9, 1.4), woodMat);
            group.add(wood);

            const flame = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4, 6), flameMat);
            flame.position.set(0, 6, 0);
            group.add(flame);

            group.position.set(0, -8, 1.5);
            group.rotation.x = Math.PI / 3;
        }

        skin.leftArm.add(group);
        this.activeMeshes.offHand = group;
    }

    buildBack(skin, playerObject, id) {
        if (id === 'none') return;
        const group = new THREE.Group();
        group.name = 'equip_back';

        if (id.startsWith('backpack_')) {
            // Sophisticated Backpack
            const isDiamond = id.includes('diamond');
            const mainColor = isDiamond ? '#164e63' : '#2b272c';
            const buckleColor = isDiamond ? '#2cd8d5' : '#eab308';

            const packMat = this.getMaterial(mainColor, '#000000', 0.7, 0.2);
            const pocketMat = this.getMaterial(isDiamond ? '#083344' : '#1e1b20', '#000000', 0.75, 0.15);
            const buckleMat = this.getMaterial(buckleColor, isDiamond ? '#06b6d4' : '#ca8a04', 0.2, 0.9);

            // Основной корпус рюкзака
            const mainPack = new THREE.Mesh(new THREE.BoxGeometry(7.6, 9.5, 4.2), packMat);
            group.add(mainPack);

            // Верхний клапан
            const flap = new THREE.Mesh(new THREE.BoxGeometry(7.8, 3.2, 4.4), pocketMat);
            flap.position.set(0, 3.8, 0.2);
            group.add(flap);

            // Застежка / пряжка
            const buckle = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 4.8), buckleMat);
            buckle.position.set(0, 1.5, 0.2);
            group.add(buckle);

            // Боковые карманы
            const leftPocket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.5, 3.2), pocketMat);
            leftPocket.position.set(-4.2, -0.5, 0);
            group.add(leftPocket);

            const rightPocket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.5, 3.2), pocketMat);
            rightPocket.position.set(4.2, -0.5, 0);
            group.add(rightPocket);

            group.position.set(0, 0, -3.8);
            skin.body.add(group);
            this.activeMeshes.back = group;
        }
    }
}

export const equipmentManager = new CharacterEquipmentManager();
