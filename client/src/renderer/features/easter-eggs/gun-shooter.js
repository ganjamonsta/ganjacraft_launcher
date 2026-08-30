/**
 * Ganj4Craft Launcher - Gun Shooter Mini-Game Engine v2.1
 * 3D Персонаж по центру экрана, здоровье и броня игрока,
 * мобы нападают со всех сторон с детальным Pixel-Art дизайном,
 * 5 видов оружия, автострельба, боссы и глубокая прокачка.
 */

import * as THREE from 'three';
import { getSkinViewer3d, getSkinViewerMode } from '../skin-viewer/skin-viewer.js';
import { equipmentManager } from '../skin-viewer/equipment-manager.js';
import { audioSynth } from './audio-synth.js';
import { taczAudio } from './tacz-audio.js';
import { particlePopper } from './particle-pop.js';
import { dom } from '../../utils/dom.js';

// Аутентичный арсенал оружия TACZ
export const WEAPONS = {
    deagle: {
        id: 'deagle',
        name: 'Desert Eagle .50',
        key: '1',
        icon: 'assets/tacz/hud/deagle.png',
        isImg: true,
        damage: 26,
        cooldown: 260,
        speed: 32,
        color: '#ffdd00',
        unlockCost: 0,
        unlocked: true,
        desc: 'Тяжелый тактический пистолет .50 AE'
    },
    spas_12: {
        id: 'spas_12',
        name: 'SPAS-12',
        key: '2',
        icon: 'assets/tacz/hud/spas_12.png',
        isImg: true,
        damage: 10,
        pellets: 6,
        spread: 0.26,
        cooldown: 520,
        speed: 26,
        color: '#ff8800',
        unlockCost: 120,
        desc: 'Боевой помповый дробовик (залп 6 дробин)'
    },
    ak47: {
        id: 'ak47',
        name: 'AK-47',
        key: '3',
        icon: 'assets/tacz/hud/ak47.png',
        isImg: true,
        damage: 18,
        cooldown: 110,
        speed: 35,
        color: '#39ff14',
        unlockCost: 260,
        desc: 'Штурмовой автомат Калашникова (зажми ЛКМ)'
    },
    vector45: {
        id: 'vector45',
        name: 'Vector .45 ACP',
        key: '4',
        icon: 'assets/tacz/hud/vector45.png',
        isImg: true,
        damage: 10,
        cooldown: 65,
        speed: 38,
        color: '#00f2fe',
        unlockCost: 480,
        desc: 'Ультра-скорострельный пистолет-пулемет'
    },
    awp: {
        id: 'awp',
        name: 'AWP Sniper',
        key: '5',
        icon: 'assets/tacz/hud/ai_awp.png',
        isImg: true,
        damage: 140,
        cooldown: 880,
        speed: 55,
        color: '#a855f7',
        unlockCost: 750,
        isPiercing: true,
        desc: 'Крупнокалиберная снайперка (пробивает насквозь)'
    },
    rpg7: {
        id: 'rpg7',
        name: 'RPG-7',
        key: '6',
        icon: 'assets/tacz/hud/rpg7.png',
        isImg: true,
        damage: 160,
        aoeRadius: 110,
        cooldown: 960,
        speed: 18,
        color: '#ff0055',
        unlockCost: 1200,
        isHoming: true,
        desc: 'Реактивный гранатомет с колоссальным взрывом'
    },
    minigun: {
        id: 'minigun',
        name: 'Minigun 6-Barrel',
        key: '7',
        icon: 'assets/tacz/hud/minigun.png',
        isImg: true,
        damage: 15,
        cooldown: 45,
        speed: 40,
        color: '#ffd700',
        unlockCost: 1900,
        desc: 'Шестиствольный пулемет ураганного огня'
    }
};

class GunShooterEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
        this.animId = null;

        // Игровые объекты
        this.bullets = [];
        this.targets = [];
        this.explosions = [];
        this.muzzleFlashes = [];
        this.damageNumbers = [];
        this.coinsEntities = [];

        // Здоровье и защита игрока
        this.playerMaxHp = 100;
        this.playerHp = 100;
        this.isPlayerInvincible = false;
        this.lastRegenTime = performance.now();

        // 3D скин
        this.gunMesh = null;
        this.isGunAttached = false;
        this.defaultRightArmPos = null;

        // Ввод и автострельба
        this.mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.isFiring = false;
        this.lastFireTime = 0;
        this.targetSpawnTimer = null;

        // Состояние игры и прокачки
        this.score = 0;
        this.kills = 0;
        this.bossKills = 0;
        this.lastBossKills = 0;
        this.coins = 0;
        this.currentWeaponId = 'deagle';
        this.unlockedWeapons = ['deagle'];
        this.upgrades = {
            damage: 0,
            fireRate: 0,
            critChance: 0,
            multiShot: 0,
            maxHp: 0,
            armor: 0,
            regen: 0
        };

        // Босс
        this.currentBoss = null;

        // Флаги экранов
        this.isGameLaunching = false;
        this.isActive = false;
        this.isLogModalOpen = false;
        this.isShopOpen = false;

        // UI элементы
        this.crosshairElem = null;
        this.playerDefenseElem = null;
        this.bossHudElem = null;
        this.hotbarElem = null;
        this.topControlsElem = null;
        this.shopModalElem = null;

        // Привязка методов
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.render = this.render.bind(this);

        this.loadProgression();
    }

    /**
     * Загрузка прогресса из LocalStorage
     */
    loadProgression() {
        try {
            const raw = localStorage.getItem('ganjacraft_shooter_v2');
            if (raw) {
                const data = JSON.parse(raw);
                if (typeof data.coins === 'number') this.coins = data.coins;
                if (typeof data.kills === 'number') this.kills = data.kills;
                if (typeof data.bossKills === 'number') this.bossKills = data.bossKills;
                if (Array.isArray(data.unlockedWeapons)) {
                    // Фильтруем и мигрируем оружие на TACZ
                    const validWeapons = data.unlockedWeapons.filter(id => WEAPONS[id]);
                    if (validWeapons.length > 0) {
                        this.unlockedWeapons = validWeapons;
                    }
                }
                if (data.upgrades) this.upgrades = { ...this.upgrades, ...data.upgrades };
                if (data.currentWeaponId && this.unlockedWeapons.includes(data.currentWeaponId)) {
                    this.currentWeaponId = data.currentWeaponId;
                }
            }
        } catch (e) {
            console.debug('[ShooterEngine] Load save error', e);
        }

        if (!this.unlockedWeapons.includes('deagle')) {
            this.unlockedWeapons.unshift('deagle');
        }
        if (!WEAPONS[this.currentWeaponId]) {
            this.currentWeaponId = 'deagle';
        }

        this.updatePlayerStatsFromUpgrades();
    }

    updatePlayerStatsFromUpgrades() {
        this.playerMaxHp = 100 + (this.upgrades.maxHp || 0) * 25;
        this.playerHp = this.playerMaxHp;
        this.updatePlayerDefenseHUD();
    }

    saveProgression() {
        try {
            const data = {
                coins: this.coins,
                kills: this.kills,
                bossKills: this.bossKills,
                unlockedWeapons: this.unlockedWeapons,
                upgrades: this.upgrades,
                currentWeaponId: this.currentWeaponId
            };
            localStorage.setItem('ganjacraft_shooter_v2', JSON.stringify(data));
        } catch (e) {
            console.debug('[ShooterEngine] Save error', e);
        }
    }

    init() {
        this.ensureCanvas();
        this.ensureCrosshair();
        this.ensurePlayerDefenseHUD();
        this.ensureBossHUD();
        this.ensureHotbarHUD();
        this.ensureTopControlsHUD();
        this.ensureShopModal();

        window.addEventListener('resize', this.handleResize, { passive: true });
        window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
        document.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
        document.addEventListener('pointerup', this.handlePointerUp, { passive: true });
        document.addEventListener('pointercancel', this.handlePointerUp, { passive: true });
        window.addEventListener('keydown', this.handleKeyDown, { passive: false });
        window.addEventListener('wheel', this.handleWheel, { passive: true });

        this.startLoop();
    }

    ensureCanvas() {
        if (this.canvas) return;

        const canvas = document.createElement('canvas');
        canvas.id = 'gun-shooter-canvas';
        canvas.className = 'gun-shooter-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:90;';

        document.body.appendChild(canvas);
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.handleResize();
    }

    handleResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        if (this.canvas) {
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
    }

    ensureCrosshair() {
        if (this.crosshairElem) return;

        const crosshair = document.createElement('div');
        crosshair.id = 'gun-crosshair';
        crosshair.className = 'gun-crosshair hidden';
        crosshair.innerHTML = `
            <div class="crosshair-ring"></div>
            <div class="crosshair-dot"></div>
            <div class="crosshair-bracket top"></div>
            <div class="crosshair-bracket bottom"></div>
            <div class="crosshair-bracket left"></div>
            <div class="crosshair-bracket right"></div>
        `;

        document.body.appendChild(crosshair);
        this.crosshairElem = crosshair;
    }

    /**
     * Полоса здоровья главного героя (по центру над персонажем)
     */
    ensurePlayerDefenseHUD() {
        if (this.playerDefenseElem) return;

        const container = document.createElement('div');
        container.id = 'player-defense-hud';
        container.className = 'player-defense-hud hidden';
        container.innerHTML = `
            <div class="player-defense-nametag" id="player-defense-nametag">OPERATOR</div>
            <div class="player-defense-hp-track">
                <div class="player-defense-hp-fill" id="player-defense-hp-fill" style="width: 100%;"></div>
            </div>
            <div class="player-defense-hp-text" id="player-defense-hp-text">100 / 100 HP</div>
        `;

        document.body.appendChild(container);
        this.playerDefenseElem = container;
    }

    updatePlayerDefenseHUD() {
        if (!this.playerDefenseElem) return;
        const hpText = dom.get('player-defense-hp-text');
        const hpFill = dom.get('player-defense-hp-fill');
        const nametag = dom.get('player-defense-nametag');

        const pct = Math.max(0, Math.min(100, (this.playerHp / this.playerMaxHp) * 100));
        if (hpFill) hpFill.style.width = `${pct}%`;
        if (hpText) hpText.innerText = `${Math.round(this.playerHp)} / ${this.playerMaxHp} HP`;
    }

    damagePlayer(rawAmount) {
        if (this.isPlayerInvincible) return;

        // Расчет урона с учетом брони
        const armorReduction = Math.min(0.55, (this.upgrades.armor || 0) * 0.08);
        const damageTaken = Math.max(2, Math.round(rawAmount * (1 - armorReduction)));

        this.playerHp = Math.max(0, this.playerHp - damageTaken);
        this.updatePlayerDefenseHUD();

        // Всплывающий урон над героем
        this.spawnDamageNumber(this.width / 2, this.height / 2 - 40, damageTaken, true, 'player_hit');

        // Звук получения урона
        audioSynth.playError();
        this.triggerScreenShake(6);

        // Вспышка экрана
        document.body.classList.remove('player-damaged');
        void document.body.offsetWidth;
        document.body.classList.add('player-damaged');
        setTimeout(() => document.body.classList.remove('player-damaged'), 300);

        if (this.playerHp <= 0) {
            this.onPlayerDeath();
        }
    }

    onPlayerDeath() {
        // Защитная EMP-волна, уничтожающая всех мобов вокруг
        audioSynth.playBassDrop();
        this.triggerScreenShake(14);
        this.createExplosion(this.width / 2, this.height / 2, 'lucky_block');
        this.createExplosion(this.width / 2 - 40, this.height / 2, 'tnt');
        this.createExplosion(this.width / 2 + 40, this.height / 2, 'creeper');

        this.targets.forEach(t => {
            t.alive = false;
            this.createExplosion(t.x, t.y, t.type);
        });
        this.targets = [];

        // Восстановление здоровья и временная неуязвимость
        this.isPlayerInvincible = true;
        this.playerHp = this.playerMaxHp;
        this.updatePlayerDefenseHUD();

        particlePopper.spawnFloatingScore(this.width / 2, this.height / 2 - 60, '⚡ АВАРИЙНЫЙ ЩИТ! ПЕРЕЗАГРУЗКА');

        setTimeout(() => {
            this.isPlayerInvincible = false;
        }, 3200);
    }

    ensureBossHUD() {
        if (this.bossHudElem) return;

        const container = document.createElement('div');
        container.id = 'boss-health-container';
        container.className = 'boss-health-container';
        container.innerHTML = `
            <div class="boss-header-row">
                <div class="boss-title-wrapper">
                    <span class="boss-skull-icon">💀</span>
                    <span class="boss-name-text" id="boss-name-text">КИБЕР-ВИЗЕР 3000</span>
                    <span class="boss-phase-tag" id="boss-phase-tag">ФАЗА 1</span>
                </div>
                <div class="boss-hp-numbers" id="boss-hp-numbers">200 / 200 HP</div>
            </div>
            <div class="boss-hp-track">
                <div class="boss-hp-fill" id="boss-hp-fill" style="width: 100%;"></div>
            </div>
        `;

        document.body.appendChild(container);
        this.bossHudElem = container;
    }

    ensureHotbarHUD() {
        if (this.hotbarElem) return;

        const container = document.createElement('div');
        container.id = 'shooter-hotbar-container';
        container.className = 'shooter-hotbar-container hidden';
        
        document.body.appendChild(container);
        this.hotbarElem = container;
        this.updateHotbarView();
    }

    updateHotbarView() {
        if (!this.hotbarElem) return;

        const weaponKeys = Object.keys(WEAPONS);
        let html = '';

        weaponKeys.forEach((key, index) => {
            const w = WEAPONS[key];
            const isUnlocked = this.unlockedWeapons.includes(w.id);
            const isActive = this.currentWeaponId === w.id;

            const iconMarkup = w.isImg
                ? `<img class="weapon-slot-img" src="${w.icon}" alt="${w.name}" />`
                : `<span class="weapon-slot-icon">${w.icon}</span>`;

            html += `
                <div class="weapon-slot ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}" data-weapon-id="${w.id}">
                    <span class="weapon-slot-key">${index + 1}</span>
                    <div class="weapon-slot-icon-box">${iconMarkup}</div>
                    <span class="weapon-slot-name">${w.name.split(' ')[0]}</span>
                    ${!isUnlocked ? '<span class="weapon-lock-badge">🔒</span>' : ''}
                </div>
            `;
        });

        this.hotbarElem.innerHTML = html;

        this.hotbarElem.querySelectorAll('.weapon-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                const wid = slot.getAttribute('data-weapon-id');
                if (this.unlockedWeapons.includes(wid)) {
                    this.switchWeapon(wid);
                } else {
                    this.openShop();
                }
            });
        });
    }

    ensureTopControlsHUD() {
        if (this.topControlsElem) return;

        const container = document.createElement('div');
        container.id = 'shooter-top-controls';
        container.className = 'shooter-top-controls hidden';
        container.innerHTML = `
            <div class="shooter-coins-badge">
                <span class="coins-icon">🪙</span>
                <span class="coins-amount" id="shooter-coins-display">${this.coins}</span>
            </div>
            <button class="shooter-shop-btn" id="shooter-shop-btn">
                <span>🛒</span>
                <span>АРСЕНАЛ TACZ</span>
            </button>
        `;

        document.body.appendChild(container);
        this.topControlsElem = container;

        const shopBtn = dom.get('shooter-shop-btn');
        if (shopBtn) {
            shopBtn.addEventListener('click', () => this.toggleShop());
        }
    }

    ensureShopModal() {
        if (this.shopModalElem) return;

        const overlay = document.createElement('div');
        overlay.id = 'shooter-shop-overlay';
        overlay.className = 'shooter-shop-overlay';
        overlay.innerHTML = `
            <div class="shooter-shop-window">
                <div class="shooter-shop-header">
                    <div class="shooter-shop-title">
                        <span>⚡</span>
                        <span>КИБЕР-АРСЕНАЛ TACZ & ПРОКАЧКА</span>
                    </div>
                    <button class="shooter-shop-close" id="shooter-shop-close">✕</button>
                </div>
                <div class="shooter-shop-body" id="shooter-shop-body"></div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.shopModalElem = overlay;

        const closeBtn = dom.get('shooter-shop-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeShop());
        }
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeShop();
        });
    }

    toggleShop() {
        if (this.isShopOpen) this.closeShop();
        else this.openShop();
    }

    openShop() {
        this.isShopOpen = true;
        this.isFiring = false;
        if (this.shopModalElem) {
            this.shopModalElem.classList.add('visible');
            this.renderShopContent();
        }
    }

    closeShop() {
        this.isShopOpen = false;
        if (this.shopModalElem) {
            this.shopModalElem.classList.remove('visible');
        }
        this.updateHotbarView();
        this.updateCoinsDisplay();
    }

    renderShopContent() {
        const body = dom.get('shooter-shop-body');
        if (!body) return;

        let html = '';

        // 1. Оружие TACZ
        html += `<div class="shop-section-title"><span>🔫</span> <span>РАЗБЛОКИРОВКА ОРУЖИЯ TACZ</span></div>`;
        html += `<div class="shop-grid">`;
        Object.keys(WEAPONS).forEach(key => {
            const w = WEAPONS[key];
            const isUnlocked = this.unlockedWeapons.includes(w.id);
            const canAfford = this.coins >= w.unlockCost;

            const iconMarkup = w.isImg 
                ? `<img class="upgrade-gun-img" src="${w.icon}" alt="${w.name}" />`
                : `<span class="upgrade-icon">${w.icon}</span>`;

            html += `
                <div class="upgrade-card">
                    <div class="upgrade-info">
                        <div class="upgrade-name">
                            ${iconMarkup}
                            <span>${w.name}</span>
                        </div>
                        <div class="upgrade-desc">${w.desc}</div>
                    </div>
                    <div>
                        ${isUnlocked 
                            ? `<span style="color:#39ff14;font-size:11px;font-weight:800;">✓ КУПЛЕНО</span>`
                            : `<button class="upgrade-buy-btn" data-buy-weapon="${w.id}" ${!canAfford ? 'disabled' : ''}>
                                 <span>🪙</span> <span>${w.unlockCost}</span>
                               </button>`
                        }
                    </div>
                </div>
            `;
        });
        html += `</div>`;

        // 2. Улучшения характеристик и здоровья
        const upgradeItems = [
            { key: 'damage', name: '💥 Урон пушек', desc: '+15% к урону всех орудий TACZ', baseCost: 50 },
            { key: 'fireRate', name: '⚡ Скорострельность', desc: '+12% к скорости стрельбы', baseCost: 50 },
            { key: 'critChance', name: '🎯 Шанс крита', desc: '+5% к шансу нанести 2.5x урон', baseCost: 60 },
            { key: 'multiShot', name: '🔱 Мульти-выстрел', desc: '+1 параллельный снаряд', baseCost: 250, max: 3 },
            { key: 'maxHp', name: '💖 Макс. Здоровье', desc: '+25 HP к шкале защиты', baseCost: 60 },
            { key: 'armor', name: '🛡️ Кибер-Броня', desc: '-8% входящего урона', baseCost: 80, max: 6 },
            { key: 'regen', name: '🧬 Био-Регенерация', desc: '+2 HP каждые 2 секунды', baseCost: 100, max: 5 }
        ];

        html += `<div class="shop-section-title" style="margin-top:15px;"><span>⚙️</span> <span>МОДИФИКАЦИИ БОЙЦА</span></div>`;
        html += `<div class="shop-grid">`;

        upgradeItems.forEach(item => {
            const currentLvl = this.upgrades[item.key] || 0;
            const maxLvl = item.max || 10;
            const isMax = currentLvl >= maxLvl;
            const cost = Math.round(item.baseCost * Math.pow(1.45, currentLvl));
            const canAfford = this.coins >= cost;

            html += `
                <div class="upgrade-card">
                    <div class="upgrade-info">
                        <div class="upgrade-name">
                            <span>${item.name}</span>
                            <span class="upgrade-level-badge">LVL ${currentLvl}${isMax ? ' (MAX)' : ''}</span>
                        </div>
                        <div class="upgrade-desc">${item.desc}</div>
                    </div>
                    <div>
                        ${isMax 
                            ? `<span style="color:#39ff14;font-size:11px;font-weight:800;">МАКСИМУМ</span>`
                            : `<button class="upgrade-buy-btn" data-buy-upgrade="${item.key}" data-cost="${cost}" ${!canAfford ? 'disabled' : ''}>
                                 <span>🪙</span> <span>${cost}</span>
                               </button>`
                        }
                    </div>
                </div>
            `;
        });
        html += `</div>`;

        body.innerHTML = html;

        body.querySelectorAll('[data-buy-weapon]').forEach(btn => {
            btn.addEventListener('click', () => {
                const wid = btn.getAttribute('data-buy-weapon');
                const w = WEAPONS[wid];
                if (w && this.coins >= w.unlockCost && !this.unlockedWeapons.includes(wid)) {
                    this.coins -= w.unlockCost;
                    this.unlockedWeapons.push(wid);
                    this.currentWeaponId = wid;
                    audioSynth.playUpgradePurchased();
                    this.saveProgression();
                    this.renderShopContent();
                    this.updateHotbarView();
                    this.attach3DGun();
                    this.updateCoinsDisplay();
                }
            });
        });

        body.querySelectorAll('[data-buy-upgrade]').forEach(btn => {
            btn.addEventListener('click', () => {
                const upKey = btn.getAttribute('data-buy-upgrade');
                const cost = parseInt(btn.getAttribute('data-cost'), 10);
                if (upKey && this.coins >= cost) {
                    this.coins -= cost;
                    this.upgrades[upKey] = (this.upgrades[upKey] || 0) + 1;
                    audioSynth.playUpgradePurchased();
                    this.updatePlayerStatsFromUpgrades();
                    this.saveProgression();
                    this.renderShopContent();
                    this.updateCoinsDisplay();
                }
            });
        });
    }

    updateCoinsDisplay() {
        const coinsEl = dom.get('shooter-coins-display');
        if (coinsEl) {
            coinsEl.innerText = this.coins;
        }
    }

    switchWeapon(weaponId) {
        if (WEAPONS[weaponId] && this.unlockedWeapons.includes(weaponId)) {
            this.currentWeaponId = weaponId;
            taczAudio.playDryFire();
            this.updateHotbarView();
            this.attach3DGun();
            this.saveProgression();

            const w = WEAPONS[weaponId];
            particlePopper.spawnFloatingScore(
                window.innerWidth / 2,
                window.innerHeight - 140,
                `🔫 ${w.name.toUpperCase()}`
            );
        }
    }

    handleKeyDown(e) {
        if (!this.isGameLaunching || this.isLogModalOpen) return;

        if (['1', '2', '3', '4', '5', '6', '7'].includes(e.key)) {
            const keys = Object.keys(WEAPONS);
            const index = parseInt(e.key, 10) - 1;
            if (keys[index]) {
                const targetW = keys[index];
                if (this.unlockedWeapons.includes(targetW)) {
                    this.switchWeapon(targetW);
                } else {
                    this.openShop();
                }
            }
        } else if (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'u') {
            this.toggleShop();
        }
    }

    handleWheel(e) {
        if (!this.isGameLaunching || this.isLogModalOpen || this.isShopOpen) return;

        const unlocked = Object.keys(WEAPONS).filter(k => this.unlockedWeapons.includes(k));
        if (unlocked.length <= 1) return;

        const curIdx = unlocked.indexOf(this.currentWeaponId);
        if (curIdx === -1) return;

        let nextIdx = e.deltaY > 0 ? curIdx + 1 : curIdx - 1;
        if (nextIdx >= unlocked.length) nextIdx = 0;
        if (nextIdx < 0) nextIdx = unlocked.length - 1;

        this.switchWeapon(unlocked[nextIdx]);
    }

    attach3DGun() {
        this.isGunAttached = true;
        const viewer = getSkinViewer3d();
        if (!viewer || !viewer.playerObject || !viewer.playerObject.skin) {
            setTimeout(() => this.attach3DGun(), 300);
            return;
        }

        const taczGunId = 'tacz_' + this.currentWeaponId;
        equipmentManager.setSlot('mainHand', taczGunId);
        equipmentManager.applyToViewer(viewer);

        const rightArm = viewer.playerObject.skin.rightArm;
        if (rightArm) {
            rightArm.rotation.x = -Math.PI / 2;
        }
    }

    detach3DGun() {
        this.isGunAttached = false;
        const viewer = getSkinViewer3d();
        if (viewer && viewer.playerObject && viewer.playerObject.skin) {
            equipmentManager.loadEquipment();
            equipmentManager.applyToViewer(viewer);

            const rightArm = viewer.playerObject.skin.rightArm;
            const head = viewer.playerObject.skin.head;
            if (rightArm) {
                rightArm.rotation.set(0, 0, 0);
            }
            if (head) head.rotation.set(0, 0, 0);
            viewer.playerObject.rotation.y = -0.45;
        }
    }

    handleMouseMove(e) {
        if (!this.isGameLaunching || this.isLogModalOpen) {
            if (this.crosshairElem && !this.crosshairElem.classList.contains('hidden')) {
                this.crosshairElem.classList.add('hidden');
            }
            return;
        }

        this.mousePos.x = e.clientX;
        this.mousePos.y = e.clientY;

        if (this.crosshairElem) {
            this.crosshairElem.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
            this.crosshairElem.classList.remove('hidden');
        }

        const viewer = getSkinViewer3d();
        const mode = getSkinViewerMode();
        if (mode !== '3d' || !viewer || !viewer.playerObject) return;

        // Центр экрана
        const originX = this.width / 2;
        const originY = this.height / 2 - 10;

        const deltaX = (e.clientX - originX) / (this.width / 2);
        const deltaY = (e.clientY - originY) / (this.height / 2);

        // Поворот тела
        const targetBodyRotY = Math.max(-1.0, Math.min(1.0, deltaX * 1.1));
        viewer.playerObject.rotation.y += (targetBodyRotY - viewer.playerObject.rotation.y) * 0.2;

        const rightArm = viewer.playerObject.skin.rightArm;
        const head = viewer.playerObject.skin.head;

        if (rightArm) {
            const targetRotX = -Math.PI / 2 + Math.max(-0.6, Math.min(0.6, deltaY * 0.75));
            const targetRotY = Math.max(-0.5, Math.min(0.5, deltaX * 0.5));
            const targetRotZ = Math.max(-0.3, Math.min(0.3, deltaY * 0.3));

            rightArm.rotation.x += (targetRotX - rightArm.rotation.x) * 0.25;
            rightArm.rotation.y += (targetRotY - rightArm.rotation.y) * 0.25;
            rightArm.rotation.z += (targetRotZ - rightArm.rotation.z) * 0.25;
        }

        if (head) {
            const headRotY = Math.max(-0.7, Math.min(0.7, deltaX * 0.7));
            const headRotX = Math.max(-0.4, Math.min(0.4, deltaY * 0.5));
            head.rotation.y += (headRotY - head.rotation.y) * 0.2;
            head.rotation.x += (headRotX - head.rotation.x) * 0.2;
        }
    }

    handlePointerDown(e) {
        if (!this.isGameLaunching || this.isLogModalOpen || this.isShopOpen) return;

        const tag = e.target.tagName;
        if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(tag)) return;
        if (e.target.closest('button, input, select, textarea, a, .launch-log-modal, .shooter-shop-window, .shooter-hotbar-container, .shooter-top-controls, .custom-modal, #title-bar, #step-progress')) return;

        this.isFiring = true;
        this.fireCurrentWeapon(e.clientX, e.clientY);
        this.lastFireTime = performance.now();
    }

    handlePointerUp() {
        this.isFiring = false;
    }

    getCurrentWeapon() {
        return WEAPONS[this.currentWeaponId] || WEAPONS.deagle;
    }

    fireCurrentWeapon(targetX, targetY) {
        const weapon = this.getCurrentWeapon();
        // Стрельба прямо из центра экрана (где стоит игрок)
        const startX = this.width / 2 + 10;
        const startY = this.height / 2 - 15;

        const dx = targetX - startX;
        const dy = targetY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const dmgMult = 1 + (this.upgrades.damage * 0.15);
        const isCrit = Math.random() < (0.08 + this.upgrades.critChance * 0.05);
        const finalDamage = Math.round(weapon.damage * dmgMult * (isCrit ? 2.5 : 1));
        const extraPellets = this.upgrades.multiShot || 0;

        if (weapon.id === 'spas_12') {
            const totalPellets = (weapon.pellets || 6) + extraPellets * 2;
            for (let p = 0; p < totalPellets; p++) {
                const spreadAngle = (Math.random() - 0.5) * (weapon.spread || 0.26);
                const angle = Math.atan2(dy, dx) + spreadAngle;
                const spd = weapon.speed * (0.85 + Math.random() * 0.3);

                this.bullets.push({
                    x: startX,
                    y: startY,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd,
                    damage: Math.round(finalDamage / (totalPellets * 0.5)),
                    isCrit,
                    weaponId: weapon.id,
                    distTravelled: 0,
                    maxDist: dist + 120,
                    length: 16,
                    width: 3.5,
                    color: weapon.color
                });
            }
            taczAudio.playShoot('spas_12');
            this.triggerScreenShake(4);
        } else if (weapon.id === 'awp') {
            const vx = (dx / dist) * weapon.speed;
            const vy = (dy / dist) * weapon.speed;

            this.bullets.push({
                x: startX,
                y: startY,
                vx,
                vy,
                damage: finalDamage,
                isCrit,
                isPiercing: true,
                weaponId: weapon.id,
                distTravelled: 0,
                maxDist: window.innerWidth * 1.5,
                length: 70,
                width: 6,
                color: weapon.color
            });
            taczAudio.playShoot('awp');
            this.triggerScreenShake(7);
        } else if (weapon.id === 'rpg7') {
            const vx = (dx / dist) * weapon.speed;
            const vy = (dy / dist) * weapon.speed;

            this.bullets.push({
                x: startX,
                y: startY,
                vx,
                vy,
                damage: finalDamage,
                isCrit,
                isHoming: true,
                aoeRadius: weapon.aoeRadius,
                weaponId: weapon.id,
                distTravelled: 0,
                maxDist: window.innerWidth * 1.5,
                length: 32,
                width: 7,
                color: weapon.color
            });
            taczAudio.playShoot('rpg7');
            this.triggerScreenShake(8);
        } else {
            // deagle, ak47, vector45, minigun
            const shots = 1 + extraPellets;
            for (let s = 0; s < shots; s++) {
                const spreadAngle = shots > 1 ? (s - (shots - 1) / 2) * 0.08 : 0;
                const angle = Math.atan2(dy, dx) + spreadAngle;

                this.bullets.push({
                    x: startX,
                    y: startY,
                    vx: Math.cos(angle) * weapon.speed,
                    vy: Math.sin(angle) * weapon.speed,
                    damage: finalDamage,
                    isCrit,
                    weaponId: weapon.id,
                    distTravelled: 0,
                    maxDist: dist + 150,
                    length: weapon.id === 'minigun' ? 26 : (weapon.id === 'ak47' ? 28 : 20),
                    width: weapon.id === 'deagle' ? 4 : 3,
                    color: weapon.color
                });
            }
            taczAudio.playShoot(weapon.id);
            if (weapon.id === 'deagle') this.triggerScreenShake(3);
            else if (weapon.id === 'minigun') this.triggerScreenShake(1.5);
        }

        this.muzzleFlashes.push({
            x: startX,
            y: startY,
            radius: weapon.id === 'rpg7' || weapon.id === 'awp' ? 34 : 22,
            life: 1,
            decay: 0.25,
            color: weapon.color
        });

        this.triggerGunRecoil(weapon.id === 'awp' || weapon.id === 'rpg7' ? 2.0 : 1.0);
    }

    triggerScreenShake(intensity = 4) {
        document.body.classList.remove('screen-shaking');
        void document.body.offsetWidth;
        document.body.classList.add('screen-shaking');
        setTimeout(() => document.body.classList.remove('screen-shaking'), 220);
    }

    triggerGunRecoil(mult = 1) {
        const viewer = getSkinViewer3d();
        if (!viewer || !viewer.playerObject) return;

        const rightArm = viewer.playerObject.skin.rightArm;
        if (rightArm) {
            const baseZ = this.defaultRightArmPos ? this.defaultRightArmPos.z : 0;
            rightArm.rotation.x += 0.3 * mult;
            rightArm.position.z = baseZ - (3.5 * mult);

            setTimeout(() => {
                if (rightArm) {
                    rightArm.position.z = baseZ;
                }
            }, 100);
        }
    }

    /**
     * Спавн мобов по периметру экрана, летящих к игроку в центр
     */
    startTargetSpawner(intervalMs = 1300) {
        if (this.targetSpawnTimer) clearInterval(this.targetSpawnTimer);

        this.targetSpawnTimer = setInterval(() => {
            if (this.isGameLaunching && !this.isLogModalOpen && !this.isShopOpen) {
                if (!this.currentBoss && (this.kills - this.lastBossKills >= 12)) {
                    this.spawnBoss();
                } else if (this.targets.length < 8) {
                    this.spawnTarget();
                }
            }
        }, intervalMs);
    }

    spawnTarget() {
        if (!this.isGameLaunching) return;

        const mobPool = ['zombie', 'creeper', 'spider', 'skeleton', 'tnt', 'lucky_block'];
        const type = mobPool[Math.floor(Math.random() * mobPool.length)];

        // Спавн с одной из 4 сторон периметра экрана
        const side = Math.floor(Math.random() * 4);
        let startX = 0;
        let startY = 0;

        if (side === 0) { // Сверху
            startX = Math.random() * this.width;
            startY = -50;
        } else if (side === 1) { // Справа
            startX = this.width + 50;
            startY = 70 + Math.random() * (this.height - 180);
        } else if (side === 2) { // Снизу
            startX = Math.random() * this.width;
            startY = this.height + 50;
        } else { // Слева
            startX = -50;
            startY = 70 + Math.random() * (this.height - 180);
        }

        let baseHp = 18;
        let speed = 1.35;
        let damage = 12;
        let width = 46;
        let height = 46;

        if (type === 'zombie') {
            baseHp = 22;
            speed = 1.3;
            damage = 14;
        } else if (type === 'creeper') {
            baseHp = 16;
            speed = 1.6;
            damage = 30; // Высокий урон при детонации
        } else if (type === 'spider') {
            baseHp = 12;
            speed = 2.4; // Очень быстрый
            damage = 8;
            width = 44;
            height = 36;
        } else if (type === 'skeleton') {
            baseHp = 18;
            speed = 1.1;
            damage = 15;
        } else if (type === 'tnt') {
            baseHp = 10;
            speed = 2.0;
            damage = 25;
        } else if (type === 'lucky_block') {
            baseHp = 28;
            speed = 0.85;
            damage = 0; // Мирный бонусный блок
        }

        this.targets.push({
            type,
            x: startX,
            y: startY,
            speed,
            damage,
            width,
            height,
            alive: true,
            hp: baseHp,
            maxHp: baseHp,
            wobble: Math.random() * Math.PI * 2,
            createdAt: performance.now()
        });
    }

    spawnBoss() {
        this.lastBossKills = this.kills;
        const bossTypes = ['cyber_wither', 'giga_creeper', 'ender_drone'];
        const type = bossTypes[this.bossKills % bossTypes.length];

        let name = 'КИБЕР-ВИЗЕР 3000';
        let maxHp = 220;
        let width = 76;
        let height = 76;

        if (type === 'giga_creeper') {
            name = 'ГИГА-КРИПЕР «ЧЕРНОБЫЛЬ»';
            maxHp = 180;
            width = 72;
            height = 72;
        } else if (type === 'ender_drone') {
            name = 'ЭНДЕР-ДРОН «ОМЕГА»';
            maxHp = 260;
            width = 82;
            height = 54;
        }

        this.currentBoss = {
            type,
            name,
            hp: maxHp,
            maxHp,
            x: this.width / 2,
            y: -100,
            targetY: 130 + Math.random() * 50,
            vx: 2.2,
            width,
            height,
            isEnraged: false,
            wobble: 0,
            fuseTimer: type === 'giga_creeper' ? 14 : null,
            lastTeleport: performance.now(),
            createdAt: performance.now()
        };

        audioSynth.playBossWarning();
        this.triggerScreenShake(8);

        if (this.bossHudElem) {
            this.bossHudElem.classList.add('visible');
            this.bossHudElem.classList.remove('enraged');
            const nameEl = dom.get('boss-name-text');
            const phaseEl = dom.get('boss-phase-tag');
            const hpTextEl = dom.get('boss-hp-numbers');
            const hpFillEl = dom.get('boss-hp-fill');

            if (nameEl) nameEl.innerText = name;
            if (phaseEl) phaseEl.innerText = 'ФАЗА 1';
            if (hpTextEl) hpTextEl.innerText = `${maxHp} / ${maxHp} HP`;
            if (hpFillEl) hpFillEl.style.width = '100%';
        }

        particlePopper.spawnFloatingScore(
            this.width / 2,
            180,
            `🚨 ВНИМАНИЕ: БОСС! 🚨`
        );
    }

    setGameLaunchingMode(isLaunching) {
        this.isGameLaunching = isLaunching;
        this.isActive = isLaunching;
        this.isFiring = false;

        if (isLaunching) {
            this.updatePlayerStatsFromUpgrades();
            this.attach3DGun();
            this.startTargetSpawner(1300);

            if (this.crosshairElem) this.crosshairElem.classList.remove('hidden');
            if (this.playerDefenseElem) this.playerDefenseElem.classList.remove('hidden');
            if (this.hotbarElem) this.hotbarElem.classList.remove('hidden');
            if (this.topControlsElem) this.topControlsElem.classList.remove('hidden');

            this.updateHotbarView();
            this.updateCoinsDisplay();

            this.spawnTarget();
            this.spawnTarget();
            this.spawnTarget();
        } else {
            this.detach3DGun();
            if (this.targetSpawnTimer) {
                clearInterval(this.targetSpawnTimer);
                this.targetSpawnTimer = null;
            }
            this.targets = [];
            this.bullets = [];
            this.explosions = [];
            this.muzzleFlashes = [];
            this.damageNumbers = [];
            this.coinsEntities = [];
            this.currentBoss = null;

            if (this.crosshairElem) this.crosshairElem.classList.add('hidden');
            if (this.playerDefenseElem) this.playerDefenseElem.classList.add('hidden');
            if (this.hotbarElem) this.hotbarElem.classList.add('hidden');
            if (this.topControlsElem) this.topControlsElem.classList.add('hidden');
            if (this.bossHudElem) this.bossHudElem.classList.remove('visible');
            if (this.shopModalElem) this.shopModalElem.classList.remove('visible');

            if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
        }
    }

    setLogModalOpen(isOpen) {
        this.isLogModalOpen = isOpen;
        if (isOpen) {
            this.isFiring = false;
            if (this.canvas) this.canvas.style.display = 'none';
            if (this.crosshairElem) this.crosshairElem.classList.add('hidden');
            if (this.playerDefenseElem) this.playerDefenseElem.classList.add('hidden');
        } else {
            if (this.canvas) this.canvas.style.display = 'block';
            if (this.isGameLaunching) {
                if (this.crosshairElem) this.crosshairElem.classList.remove('hidden');
                if (this.playerDefenseElem) this.playerDefenseElem.classList.remove('hidden');
            }
        }
    }

    startLoop() {
        if (this.animId) return;
        this.render();
    }

    render() {
        if (this.ctx && this.isGameLaunching && !this.isLogModalOpen) {
            this.ctx.clearRect(0, 0, this.width, this.height);

            // Регенерация здоровья игрока
            this.processPlayerRegen();

            // 1. Автострельба
            this.processAutoFire();

            // 2. Обновление босса
            this.updateAndDrawBoss();

            // 3. Мобы, летящие к центру
            this.updateAndDrawTargets();

            // 4. Снаряды
            this.updateAndDrawBullets();

            // 5. Монеты
            this.updateAndDrawCoins();

            // 6. Вспышки и взрывы
            this.updateAndDrawMuzzleFlashes();
            this.updateAndDrawExplosions();

            // 7. Всплывающий урон
            this.updateAndDrawDamageNumbers();
        }

        this.animId = requestAnimationFrame(this.render);
    }

    processPlayerRegen() {
        const regenAmount = (this.upgrades.regen || 0) * 2;
        if (regenAmount > 0 && this.playerHp < this.playerMaxHp) {
            const now = performance.now();
            if (now - this.lastRegenTime >= 1500) {
                this.lastRegenTime = now;
                this.playerHp = Math.min(this.playerMaxHp, this.playerHp + regenAmount);
                this.updatePlayerDefenseHUD();
            }
        }
    }

    processAutoFire() {
        if (this.isFiring && !this.isShopOpen) {
            const now = performance.now();
            const weapon = this.getCurrentWeapon();
            const fireRateMult = 1 + (this.upgrades.fireRate * 0.12);
            const effCooldown = (weapon.cooldown || 250) / fireRateMult;

            if (now - this.lastFireTime >= effCooldown) {
                this.fireCurrentWeapon(this.mousePos.x, this.mousePos.y);
                this.lastFireTime = now;
            }
        }
    }

    updateAndDrawBoss() {
        if (!this.currentBoss) return;
        const b = this.currentBoss;

        if (b.y < b.targetY) {
            b.y += (b.targetY - b.y) * 0.08;
        } else {
            b.wobble += 0.04;
            b.x += b.vx;

            if (b.x < b.width) {
                b.x = b.width;
                b.vx = Math.abs(b.vx);
            } else if (b.x > this.width - b.width) {
                b.x = this.width - b.width;
                b.vx = -Math.abs(b.vx);
            }

            b.y = b.targetY + Math.sin(b.wobble) * 25;

            if (b.type === 'ender_drone' && performance.now() - b.lastTeleport > 3500) {
                b.lastTeleport = performance.now();
                b.x = 100 + Math.random() * (this.width - 200);
                this.createExplosion(b.x, b.y, 'lucky_block');
                audioSynth.playJump();
            }
        }

        if (!b.isEnraged && b.hp <= b.maxHp * 0.5) {
            b.isEnraged = true;
            b.vx *= 1.5;
            audioSynth.playBossWarning();
            if (this.bossHudElem) {
                this.bossHudElem.classList.add('enraged');
                const phaseEl = dom.get('boss-phase-tag');
                if (phaseEl) phaseEl.innerText = '⚡ ЯРОСТЬ!';
            }
            particlePopper.spawnFloatingScore(b.x, b.y - 40, '🔥 БОСС В ЯРОСТИ!');
        }

        this.drawBossShape(b);
    }

    drawBossShape(b) {
        this.ctx.save();
        this.ctx.translate(b.x, b.y);

        const half = b.width / 2;

        if (b.type === 'cyber_wither') {
            this.ctx.fillStyle = b.isEnraged ? '#ff0055' : '#1e1b4b';
            this.ctx.shadowColor = b.isEnraged ? '#ff0055' : '#a855f7';
            this.ctx.shadowBlur = 25;

            this.ctx.fillRect(-half * 0.6, -half * 0.4, b.width * 0.6, b.height * 0.8);

            this.ctx.fillStyle = '#0f172a';
            this.ctx.fillRect(-18, -half - 10, 36, 32);
            this.ctx.fillStyle = b.isEnraged ? '#ff0055' : '#38bdf8';
            this.ctx.fillRect(-12, -half + 2, 8, 8);
            this.ctx.fillRect(4, -half + 2, 8, 8);

            this.ctx.fillStyle = '#0f172a';
            this.ctx.fillRect(-half - 12, -half + 5, 24, 24);
            this.ctx.fillStyle = '#a855f7';
            this.ctx.fillRect(-half - 8, -half + 12, 6, 6);

            this.ctx.fillStyle = '#0f172a';
            this.ctx.fillRect(half - 12, -half + 5, 24, 24);
            this.ctx.fillStyle = '#a855f7';
            this.ctx.fillRect(half - 8, -half + 12, 6, 6);
        } else if (b.type === 'giga_creeper') {
            this.ctx.fillStyle = b.isEnraged ? '#ef4444' : '#22c55e';
            this.ctx.shadowColor = b.isEnraged ? '#ef4444' : '#39ff14';
            this.ctx.shadowBlur = 30;

            this.ctx.fillRect(-half, -half, b.width, b.height);

            this.ctx.fillStyle = '#052e16';
            const s = b.width / 8;
            this.ctx.fillRect(-half + s, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(half - s * 3, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(-half + s * 3, -half + s * 3, s * 2, s * 3);
            this.ctx.fillRect(-half + s * 2, -half + s * 4, s * 4, s * 3);

            const elapsed = (performance.now() - b.createdAt) / 1000;
            const remaining = Math.max(0, Math.ceil(b.fuseTimer - elapsed));
            this.ctx.fillStyle = '#facc15';
            this.ctx.font = 'bold 16px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`💣 ДЕТОНАЦИЯ: ${remaining}s`, 0, -half - 15);
        } else {
            this.ctx.fillStyle = '#581c87';
            this.ctx.shadowColor = '#d946ef';
            this.ctx.shadowBlur = 25;

            this.ctx.beginPath();
            this.ctx.moveTo(-half - 20, -10);
            this.ctx.lineTo(half + 20, -10);
            this.ctx.lineTo(0, half + 10);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.fillStyle = '#f0abfc';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    /**
     * Отрисовка и движение мобов прямо на игрока в центр экрана
     */
    updateAndDrawTargets() {
        const playerX = this.width / 2;
        const playerY = this.height / 2;

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];

            // Вектор к игроку в центре
            const dx = playerX - t.x;
            const dy = playerY - t.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
                t.vx = (dx / dist) * t.speed;
                t.vy = (dy / dist) * t.speed;
                t.x += t.vx;
                t.y += t.vy;
            }

            // Проверка достижения игрока (удар по главному герою!)
            if (dist < 52) {
                this.damagePlayer(t.damage || 12);
                this.createExplosion(t.x, t.y, t.type);
                this.targets.splice(i, 1);
                continue;
            }

            this.drawMobPixelArt(t, dist);
        }
    }

    /**
     * Детализированный Pixel Art спрайтов мобов
     */
    drawMobPixelArt(t, distToPlayer) {
        this.ctx.save();
        this.ctx.translate(t.x, t.y);

        const half = t.width / 2;

        // Полоса здоровья над мобом при получении урона
        if (t.hp < t.maxHp) {
            const hpWidth = t.width;
            const hpPct = Math.max(0, t.hp / t.maxHp);
            this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
            this.ctx.fillRect(-half, -half - 10, hpWidth, 4);
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(-half, -half - 10, hpWidth * hpPct, 4);
        }

        if (t.type === 'zombie') {
            // Кибер-Зомби с металлическими наплечниками
            this.ctx.fillStyle = '#065f46';
            this.ctx.shadowColor = '#10b981';
            this.ctx.shadowBlur = 10;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            // Броня/наплечники
            this.ctx.fillStyle = '#334155';
            this.ctx.fillRect(-half - 3, -half, 6, 12);
            this.ctx.fillRect(half - 3, -half, 6, 12);

            // Лицо зомби
            this.ctx.fillStyle = '#064e3b';
            this.ctx.fillRect(-half + 6, -half + 8, 8, 8);
            this.ctx.fillRect(half - 14, -half + 8, 8, 8);
            // Красный кибер-глаз
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(-half + 8, -half + 10, 4, 4);
            this.ctx.fillStyle = '#34d399';
            this.ctx.fillRect(half - 12, -half + 10, 4, 4);
        } else if (t.type === 'creeper') {
            // Кибер-крипер (мигает белым вблизи игрока!)
            const isFlashing = distToPlayer < 180 && Math.floor(performance.now() / 120) % 2 === 0;

            this.ctx.fillStyle = isFlashing ? '#ffffff' : '#22c55e';
            this.ctx.shadowColor = isFlashing ? '#ffffff' : '#22c55e';
            this.ctx.shadowBlur = isFlashing ? 22 : 10;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            this.ctx.fillStyle = isFlashing ? '#ef4444' : '#052e16';
            const s = t.width / 8;
            this.ctx.fillRect(-half + s, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(half - s * 3, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(-half + s * 3, -half + s * 3, s * 2, s * 3);
            this.ctx.fillRect(-half + s * 2, -half + s * 4, s * 4, s * 3);
        } else if (t.type === 'spider') {
            // Кибер-Паук с 4 механическими ногами
            this.ctx.fillStyle = '#1e1b4b';
            this.ctx.shadowColor = '#ef4444';
            this.ctx.shadowBlur = 12;
            this.ctx.fillRect(-half + 4, -half + 4, t.width - 8, t.height - 8);

            // 4 анимированные ноги
            const legTime = Math.sin(performance.now() * 0.02) * 6;
            this.ctx.strokeStyle = '#475569';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            // Левые ноги
            this.ctx.moveTo(-half + 4, -half + 8); this.ctx.lineTo(-half - 10, -half + legTime);
            this.ctx.moveTo(-half + 4, half - 8); this.ctx.lineTo(-half - 10, half - legTime);
            // Правые ноги
            this.ctx.moveTo(half - 4, -half + 8); this.ctx.lineTo(half + 10, -half - legTime);
            this.ctx.moveTo(half - 4, half - 8); this.ctx.lineTo(half + 10, half + legTime);
            this.ctx.stroke();

            // Красные светящиеся глаза
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(-half + 10, -half + 10, 4, 4);
            this.ctx.fillRect(-half + 18, -half + 10, 4, 4);
            this.ctx.fillRect(half - 14, -half + 10, 4, 4);
            this.ctx.fillRect(half - 22, -half + 10, 4, 4);
        } else if (t.type === 'skeleton') {
            // Кибер-Скелет
            this.ctx.fillStyle = '#e2e8f0';
            this.ctx.shadowColor = '#00f2fe';
            this.ctx.shadowBlur = 8;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            // Глазницы
            this.ctx.fillStyle = '#0f172a';
            this.ctx.fillRect(-half + 6, -half + 8, 8, 8);
            this.ctx.fillRect(half - 14, -half + 8, 8, 8);

            // Бионический синий глаз
            this.ctx.fillStyle = '#00f2fe';
            this.ctx.fillRect(-half + 8, -half + 10, 4, 4);
        } else if (t.type === 'tnt') {
            // TNT блок
            this.ctx.fillStyle = '#ef4444';
            this.ctx.shadowColor = '#ef4444';
            this.ctx.shadowBlur = 14;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            this.ctx.fillStyle = '#f8fafc';
            this.ctx.fillRect(-half, -6, t.width, 12);

            this.ctx.fillStyle = '#0f172a';
            this.ctx.font = 'bold 10px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('TNT', 0, 3);
        } else {
            // Лаки-блок
            this.ctx.fillStyle = '#eab308';
            this.ctx.shadowColor = '#eab308';
            this.ctx.shadowBlur = 16;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 18px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('?', 0, 6);
        }

        this.ctx.restore();
    }

    updateAndDrawBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            if (b.isHoming) {
                let target = this.currentBoss;
                if (!target && this.targets.length > 0) {
                    target = this.targets[0];
                }
                if (target) {
                    const tdx = target.x - b.x;
                    const tdy = target.y - b.y;
                    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
                    if (tdist > 0) {
                        b.vx += (tdx / tdist) * 1.5;
                        b.vy += (tdy / tdist) * 1.5;
                        const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                        b.vx = (b.vx / spd) * 22;
                        b.vy = (b.vy / spd) * 22;
                    }
                }
            }

            b.x += b.vx;
            b.y += b.vy;
            b.distTravelled += Math.sqrt(b.vx * b.vx + b.vy * b.vy);

            const tailX = b.x - (b.vx / 26) * b.length;
            const tailY = b.y - (b.vy / 26) * b.length;

            this.ctx.save();
            this.ctx.shadowColor = b.color;
            this.ctx.shadowBlur = b.isPiercing ? 25 : 14;

            this.ctx.strokeStyle = b.color;
            this.ctx.lineWidth = b.width;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(b.x, b.y);
            this.ctx.stroke();

            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = b.width * 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(b.x, b.y);
            this.ctx.stroke();
            this.ctx.restore();

            this.checkBulletCollisions(b, i);

            if (b.distTravelled >= b.maxDist || b.x < -100 || b.x > this.width + 100 || b.y < -100 || b.y > this.height + 100) {
                this.bullets.splice(i, 1);
            }
        }
    }

    checkBulletCollisions(bullet, bulletIndex) {
        if (this.currentBoss) {
            const b = this.currentBoss;
            const dx = bullet.x - b.x;
            const dy = bullet.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < b.width * 0.75) {
                b.hp -= bullet.damage;
                this.spawnDamageNumber(bullet.x, bullet.y, bullet.damage, bullet.isCrit, bullet.weaponId);

                if (!bullet.isPiercing) {
                    this.bullets.splice(bulletIndex, 1);
                }

                if (bullet.weaponId === 'rpg7') {
                    taczAudio.playShoot('rpg7');
                    this.createExplosion(b.x, b.y, 'tnt');
                } else {
                    taczAudio.playFleshHit();
                }

                this.updateBossHealthHUD();

                if (b.hp <= 0) {
                    this.onBossDefeated();
                }
                return;
            }
        }

        for (let j = this.targets.length - 1; j >= 0; j--) {
            const t = this.targets[j];
            if (!t.alive) continue;

            const dx = bullet.x - t.x;
            const dy = bullet.y - t.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < t.width * 0.75) {
                t.hp -= bullet.damage;
                this.spawnDamageNumber(t.x, t.y, bullet.damage, bullet.isCrit, bullet.weaponId);

                if (!bullet.isPiercing) {
                    this.bullets.splice(bulletIndex, 1);
                }

                if (bullet.weaponId === 'rpg7') {
                    this.createExplosion(t.x, t.y, 'tnt');
                } else {
                    taczAudio.playFleshHit();
                }

                if (t.hp <= 0) {
                    t.alive = false;
                    this.onTargetDestroyed(t);
                    this.targets.splice(j, 1);
                }
                break;
            }
        }
    }

    updateBossHealthHUD() {
        if (!this.currentBoss || !this.bossHudElem) return;
        const b = this.currentBoss;
        const hpTextEl = dom.get('boss-hp-numbers');
        const hpFillEl = dom.get('boss-hp-fill');

        const pct = Math.max(0, Math.min(100, (b.hp / b.maxHp) * 100));
        if (hpTextEl) hpTextEl.innerText = `${Math.max(0, b.hp)} / ${b.maxHp} HP (${Math.round(pct)}%)`;
        if (hpFillEl) hpFillEl.style.width = `${pct}%`;
    }

    onBossDefeated() {
        if (!this.currentBoss) return;
        const b = this.currentBoss;

        this.bossKills++;
        this.kills += 5;
        this.score += 1500;
        const dropCoins = 80 + Math.floor(Math.random() * 60);
        this.coins += dropCoins;

        taczAudio.playKill();
        audioSynth.playBossDefeated();
        this.triggerScreenShake(12);

        this.spawnCoinsFountain(b.x, b.y, 25);
        this.createExplosion(b.x, b.y, 'lucky_block');
        this.createExplosion(b.x - 30, b.y - 20, 'tnt');
        this.createExplosion(b.x + 30, b.y + 20, 'creeper');

        particlePopper.spawnFloatingScore(b.x, b.y, `🏆 БОСС УНИЧТОЖЕН! +${dropCoins} 🪙`);

        if (this.bossHudElem) {
            this.bossHudElem.classList.remove('visible');
        }

        this.currentBoss = null;
        this.saveProgression();
        this.updateCoinsDisplay();
    }

    onTargetDestroyed(target) {
        this.kills++;
        this.score += 100;
        const dropCoins = target.type === 'lucky_block' ? 14 : (target.type === 'tnt' ? 6 : 3);
        this.coins += dropCoins;

        taczAudio.playKill();
        if (Math.random() > 0.4) taczAudio.playHeadHit();

        this.createExplosion(target.x, target.y, target.type);
        this.spawnCoinsFountain(target.x, target.y, dropCoins > 5 ? 8 : 4);

        particlePopper.registerHit(target.x, target.y);
        this.saveProgression();
        this.updateCoinsDisplay();

        const killsCountElem = dom.get('gun-kills-count');
        if (killsCountElem) {
            killsCountElem.innerText = this.kills;
        }
    }

    spawnDamageNumber(x, y, dmg, isCrit, weaponId) {
        this.damageNumbers.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 15,
            vy: -2.2,
            damage: dmg,
            isCrit,
            weaponId,
            life: 1,
            decay: 0.025
        });
    }

    updateAndDrawDamageNumbers() {
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const d = this.damageNumbers[i];
            d.y += d.vy;
            d.life -= d.decay;

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, d.life);

            let color = '#39ff14';
            let font = 'bold 14px monospace';

            if (d.weaponId === 'player_hit') {
                color = '#ff4d4d';
                font = 'bold 17px monospace';
            } else if (d.isCrit) {
                color = '#fbbf24';
                font = 'bold 18px monospace';
            } else if (d.weaponId === 'railgun') {
                color = '#c084fc';
                font = 'bold 17px monospace';
            } else if (d.weaponId === 'rocket') {
                color = '#f43f5e';
                font = 'bold 16px monospace';
            }

            this.ctx.fillStyle = color;
            this.ctx.font = font;
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 8;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`-${d.damage}${d.isCrit ? ' ⚡' : ''}`, d.x, d.y);

            this.ctx.restore();

            if (d.life <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }
    }

    spawnCoinsFountain(x, y, count = 5) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4.5;
            this.coinsEntities.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2.5,
                life: 1,
                decay: 0.02
            });
        }
    }

    updateAndDrawCoins() {
        for (let i = this.coinsEntities.length - 1; i >= 0; i--) {
            const c = this.coinsEntities[i];
            c.x += c.vx;
            c.y += c.vy;
            c.vy += 0.18;
            c.life -= c.decay;

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, c.life);
            this.ctx.fillStyle = '#fbbf24';
            this.ctx.shadowColor = '#eab308';
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.arc(c.x, c.y, 4.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            if (c.life <= 0) {
                this.coinsEntities.splice(i, 1);
            }
        }
    }

    createExplosion(x, y, type) {
        const count = 18;
        const color = type === 'creeper' ? '#22c55e' : (type === 'tnt' ? '#ef4444' : '#eab308');

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5.5;

            this.explosions.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                size: 3 + Math.random() * 4,
                color,
                life: 1,
                decay: 0.03 + Math.random() * 0.02
            });
        }
    }

    updateAndDrawExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const p = this.explosions[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.life -= p.decay;

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, p.life);
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = 8;
            this.ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            this.ctx.restore();

            if (p.life <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }

    updateAndDrawMuzzleFlashes() {
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const m = this.muzzleFlashes[i];
            m.life -= m.decay;

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, m.life);
            this.ctx.fillStyle = m.color || '#39ff14';
            this.ctx.shadowColor = m.color || '#39ff14';
            this.ctx.shadowBlur = 20;

            this.ctx.beginPath();
            this.ctx.arc(m.x, m.y, m.radius * (1 - m.life * 0.3), 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            if (m.life <= 0) {
                this.muzzleFlashes.splice(i, 1);
            }
        }
    }
}

export const gunShooter = new GunShooterEngine();
