/**
 * Ganj4Craft Launcher - Gun Shooter Mini-Game Engine v2.3
 * Волны мобов, выпадение оружия, аптечек (хилок) и временных боевых баффов,
 * бесконечный боезапас с перезарядкой обоймы, компактный 3D персонаж по центру.
 */

import * as THREE from 'three';
import { getSkinViewer3d, getSkinViewerMode, setTopDownShooterCamera } from '../skin-viewer/skin-viewer.js';
import { equipmentManager } from '../skin-viewer/equipment-manager.js';
import { audioSynth } from './audio-synth.js';
import { taczAudio } from './tacz-audio.js';
import { dom } from '../../utils/dom.js';

// Аутентичный арсенал оружия TACZ с размером обоймы и временем перезарядки
export const WEAPONS = {
    deagle: {
        id: 'deagle',
        name: 'Desert Eagle .50',
        key: '1',
        icon: 'assets/tacz/hud/deagle.png',
        isImg: true,
        damage: 32,
        cooldown: 250,
        magSize: 7,
        reloadTime: 1300,
        speed: 34,
        color: '#ffdd00',
        desc: 'Пистолет .50 AE (7 патронов)'
    },
    spas_12: {
        id: 'spas_12',
        name: 'SPAS-12',
        key: '2',
        icon: 'assets/tacz/hud/spas_12.png',
        isImg: true,
        damage: 12,
        pellets: 6,
        spread: 0.25,
        cooldown: 520,
        magSize: 8,
        reloadTime: 1800,
        speed: 28,
        color: '#ff8800',
        desc: 'Дробовик (8 патронов, 6 дробин)'
    },
    ak47: {
        id: 'ak47',
        name: 'AK-47',
        key: '3',
        icon: 'assets/tacz/hud/ak47.png',
        isImg: true,
        damage: 20,
        cooldown: 110,
        magSize: 30,
        reloadTime: 1600,
        speed: 36,
        color: '#39ff14',
        desc: 'Автомат Калашникова (30 патронов)'
    },
    vector45: {
        id: 'vector45',
        name: 'Vector .45 ACP',
        key: '4',
        icon: 'assets/tacz/hud/vector45.png',
        isImg: true,
        damage: 12,
        cooldown: 65,
        magSize: 35,
        reloadTime: 1400,
        speed: 40,
        color: '#00f2fe',
        desc: 'Пистолет-пулемет (35 патронов)'
    },
    awp: {
        id: 'awp',
        name: 'AWP Sniper',
        key: '5',
        icon: 'assets/tacz/hud/ai_awp.png',
        isImg: true,
        damage: 160,
        cooldown: 850,
        magSize: 5,
        reloadTime: 2200,
        speed: 55,
        color: '#a855f7',
        isPiercing: true,
        desc: 'Снайперка AWP (5 патронов, пробивает насквозь)'
    },
    rpg7: {
        id: 'rpg7',
        name: 'RPG-7',
        key: '6',
        icon: 'assets/tacz/hud/rpg7.png',
        isImg: true,
        damage: 200,
        aoeRadius: 120,
        cooldown: 950,
        magSize: 1,
        reloadTime: 2000,
        speed: 20,
        color: '#ff0055',
        isHoming: true,
        desc: 'РПГ-7 (1 ракета, мощный взрыв)'
    },
    minigun: {
        id: 'minigun',
        name: 'Minigun 6-Barrel',
        key: '7',
        icon: 'assets/tacz/hud/minigun.png',
        isImg: true,
        damage: 16,
        cooldown: 45,
        magSize: 100,
        reloadTime: 2800,
        speed: 42,
        color: '#ffd700',
        desc: 'Шестиствольный пулемет (100 патронов)'
    }
};

class GunShooterEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
        this.animId = null;

        // Игровые сущности
        this.bullets = [];
        this.targets = [];
        this.explosions = [];
        this.muzzleFlashes = [];
        this.damageNumbers = [];
        this.lootDrops = []; // Выпадающие предметы (хилки, баффы, оружие)

        // Здоровье и защита
        this.playerMaxHp = 100;
        this.playerHp = 100;
        this.isPlayerInvincible = false;
        this.lastRegenTime = performance.now();

        // Временные баффы (таймстампы окончания)
        this.buffs = {
            rapidFire: 0,   // Скорострельность 2x
            doubleDamage: 0,// Квад-урон 2.2x
            shield: 0       // Энерго-щит
        };

        // Обойма и перезарядка (бесконечный запас)
        this.clips = {};
        this.isReloading = false;
        this.reloadStartTime = 0;
        this.reloadDuration = 0;

        // Система волн
        this.wave = 1;
        this.mobsRemainingInWave = 8;
        this.waveKills = 0;
        this.isWaveIntermission = false;

        // Ввод и автострельба
        this.mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.isFiring = false;
        this.lastFireTime = 0;
        this.targetSpawnTimer = null;

        // Прогресс
        this.score = 0;
        this.kills = 0;
        this.bossKills = 0;
        this.currentWeaponId = 'deagle';
        this.unlockedWeapons = ['deagle'];

        // Босс
        this.currentBoss = null;

        // Флаги
        this.isEnabled = localStorage.getItem('ganjacraft_shooter_enabled') !== 'false';
        this.isGameLaunching = false;
        this.isActive = false;
        this.isLogModalOpen = false;

        this.damageFlashTimeout = null;
        this.shakeIntensity = 0;
        this._saveTimer = null;

        // UI элементы
        this.crosshairElem = null;
        this.playerDefenseElem = null;
        this.bossHudElem = null;
        this.hotbarElem = null;
        this.topControlsElem = null;
        this.buffsBarElem = null;

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

    getIsEnabled() {
        return this.isEnabled;
    }

    setIsEnabled(val) {
        this.isEnabled = !!val;
        try {
            localStorage.setItem('ganjacraft_shooter_enabled', this.isEnabled ? 'true' : 'false');
        } catch (_) {}
        this.updateTopControlsView();
        if (this.isGameLaunching) {
            this.setGameLaunchingMode(true);
        }
    }

    toggleEnabled() {
        this.setIsEnabled(!this.isEnabled);
    }

    loadProgression() {
        try {
            const raw = localStorage.getItem('ganjacraft_shooter_v3');
            if (raw) {
                const data = JSON.parse(raw);
                if (typeof data.kills === 'number') this.kills = data.kills;
                if (typeof data.wave === 'number' && data.wave >= 1) this.wave = data.wave;
                if (typeof data.bossKills === 'number') this.bossKills = data.bossKills;
                if (Array.isArray(data.unlockedWeapons)) {
                    const valid = data.unlockedWeapons.filter(id => WEAPONS[id]);
                    if (valid.length > 0) this.unlockedWeapons = valid;
                }
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

        this.initClips();
        this.playerHp = this.playerMaxHp;
    }

    initClips() {
        Object.keys(WEAPONS).forEach(k => {
            if (this.clips[k] === undefined) {
                this.clips[k] = WEAPONS[k].magSize;
            }
        });
    }

    saveProgression(immediate = false) {
        if (immediate) {
            if (this._saveTimer) {
                clearTimeout(this._saveTimer);
                this._saveTimer = null;
            }
            this._doSave();
            return;
        }
        if (this._saveTimer) return;
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this._doSave();
        }, 1500);
    }

    _doSave() {
        try {
            const data = {
                kills: this.kills,
                wave: this.wave,
                bossKills: this.bossKills,
                unlockedWeapons: this.unlockedWeapons,
                currentWeaponId: this.currentWeaponId
            };
            localStorage.setItem('ganjacraft_shooter_v3', JSON.stringify(data));
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
        this.ensureBuffsHUD();

        window.addEventListener('resize', this.handleResize, { passive: true });
        window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
        document.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
        document.addEventListener('pointerup', this.handlePointerUp, { passive: true });
        document.addEventListener('pointercancel', this.handlePointerUp, { passive: true });
        window.addEventListener('keydown', this.handleKeyDown, { passive: false });
        window.addEventListener('wheel', this.handleWheel, { passive: true });
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
        crosshair.id = 'gun-shooter-crosshair';
        crosshair.className = 'gun-shooter-crosshair hidden';
        crosshair.innerHTML = `
            <div class="crosshair-ring"></div>
            <div class="crosshair-dot"></div>
            <div class="crosshair-lines"></div>
            <div class="crosshair-ammo-indicator" id="crosshair-ammo-indicator">7/∞</div>
        `;
        document.body.appendChild(crosshair);
        this.crosshairElem = crosshair;
    }

    ensurePlayerDefenseHUD() {
        if (this.playerDefenseElem) return;

        const container = document.createElement('div');
        container.id = 'player-defense-container';
        container.className = 'player-defense-container hidden';
        container.innerHTML = `
            <div class="player-defense-nametag" id="player-defense-nametag">БОЕЦ</div>
            <div class="player-defense-hp-track">
                <div class="player-defense-hp-fill" id="player-defense-hp-fill" style="width: 100%;"></div>
            </div>
            <div class="player-defense-hp-text" id="player-defense-hp-text">100 / 100 HP</div>
        `;
        document.body.appendChild(container);
        this.playerDefenseElem = container;
        this.updatePlayerDefenseHUD();
    }

    ensureBuffsHUD() {
        if (this.buffsBarElem) return;

        const bar = document.createElement('div');
        bar.id = 'active-buffs-bar';
        bar.className = 'active-buffs-bar hidden';
        document.body.appendChild(bar);
        this.buffsBarElem = bar;
    }

    updateBuffsHUD() {
        if (!this.buffsBarElem) return;
        const now = performance.now();
        let html = '';

        if (this.buffs.rapidFire > now) {
            const rem = Math.ceil((this.buffs.rapidFire - now) / 1000);
            html += `<span class="buff-pill buff-rapid">⚡ СКОРОСТЬ ${rem}с</span>`;
        }
        if (this.buffs.doubleDamage > now) {
            const rem = Math.ceil((this.buffs.doubleDamage - now) / 1000);
            html += `<span class="buff-pill buff-damage">💥 КВАД-УРОН ${rem}с</span>`;
        }
        if (this.buffs.shield > now) {
            const rem = Math.ceil((this.buffs.shield - now) / 1000);
            html += `<span class="buff-pill buff-shield">🛡️ ЩИТ ${rem}с</span>`;
        }

        this.buffsBarElem.innerHTML = html;
        if (html) {
            this.buffsBarElem.classList.remove('hidden');
        } else {
            this.buffsBarElem.classList.add('hidden');
        }
    }

    updatePlayerDefenseHUD() {
        const hpText = dom.get('player-defense-hp-text');
        const hpFill = dom.get('player-defense-hp-fill');

        const pct = Math.max(0, Math.min(100, (this.playerHp / this.playerMaxHp) * 100));
        if (hpFill) hpFill.style.width = `${pct}%`;
        if (hpText) hpText.innerText = `${Math.round(this.playerHp)} / ${this.playerMaxHp} HP`;
    }

    damagePlayer(rawAmount) {
        // Защита щитом
        if (this.buffs.shield > performance.now() || this.isPlayerInvincible) {
            audioSynth.playEquip();
            this.spawnDamageNumber(this.width / 2, this.height / 2 - 35, 0, false, 'shield_blocked');
            return;
        }

        const damageTaken = Math.max(2, Math.round(rawAmount));
        this.playerHp = Math.max(0, this.playerHp - damageTaken);
        this.updatePlayerDefenseHUD();

        this.spawnDamageNumber(this.width / 2, this.height / 2 - 35, damageTaken, true, 'player_hit');

        audioSynth.playError();
        this.triggerScreenShake(5);

        if (this.damageFlashTimeout) clearTimeout(this.damageFlashTimeout);
        document.body.classList.add('player-damaged');
        this.damageFlashTimeout = setTimeout(() => {
            document.body.classList.remove('player-damaged');
            this.damageFlashTimeout = null;
        }, 220);

        if (this.playerHp <= 0) {
            this.onPlayerDeath();
        }
    }

    onPlayerDeath() {
        audioSynth.playBassDrop();
        this.triggerScreenShake(12);
        this.createExplosion(this.width / 2, this.height / 2, 'lucky_block');

        this.targets.forEach(t => {
            t.alive = false;
            this.createExplosion(t.x, t.y, t.type);
        });
        this.targets = [];

        this.isPlayerInvincible = true;
        this.playerHp = this.playerMaxHp;
        this.updatePlayerDefenseHUD();

        this.spawnFloatingBanner(this.width / 2, this.height / 2 - 50, '⚡ АВАРИЙНЫЙ ЩИТ! ПЕРЕЗАГРУЗКА', '#38bdf8');

        setTimeout(() => {
            this.isPlayerInvincible = false;
        }, 2800);
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

        let html = '';
        const curWeapon = this.getCurrentWeapon();

        Object.keys(WEAPONS).forEach(key => {
            const w = WEAPONS[key];
            const isUnlocked = this.unlockedWeapons.includes(w.id);
            const isActive = w.id === this.currentWeaponId;
            const clip = this.clips[w.id] !== undefined ? this.clips[w.id] : w.magSize;

            const iconMarkup = w.isImg 
                ? `<img class="weapon-slot-img" src="${w.icon}" alt="${w.name}" />`
                : `<span class="weapon-slot-icon">${w.icon}</span>`;

            let ammoMarkup = '';
            if (isUnlocked) {
                if (isActive && this.isReloading) {
                    ammoMarkup = `<span class="weapon-slot-ammo reloading">🔄</span>`;
                } else {
                    ammoMarkup = `<span class="weapon-slot-ammo">${clip}/∞</span>`;
                }
            } else {
                ammoMarkup = `<span class="weapon-lock-badge">🔒</span>`;
            }

            html += `
                <div class="weapon-slot ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}" 
                     data-weapon-id="${w.id}" 
                     title="${w.name} - ${w.desc}">
                    <span class="weapon-slot-key">${w.key}</span>
                    <div class="weapon-slot-icon-box">
                        ${iconMarkup}
                    </div>
                    <span class="weapon-slot-name">${w.name.split(' ')[0]}</span>
                    ${ammoMarkup}
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
                    this.spawnFloatingBanner(this.width / 2, this.height - 130, '🔒 Оружие выпадет на волнах!', '#ef4444');
                }
            });
        });

        this.updateTopControlsView();
    }

    ensureTopControlsHUD() {
        if (this.topControlsElem) return;

        const container = document.createElement('div');
        container.id = 'shooter-top-controls';
        container.className = 'shooter-top-controls hidden';
        container.innerHTML = `
            <div class="shooter-wave-badge">
                <span class="wave-icon">🌊</span>
                <span id="shooter-wave-display">ВОЛНА ${this.wave}</span>
            </div>
            <div class="shooter-ammo-badge" id="shooter-ammo-badge">
                <span class="ammo-icon">⚡</span>
                <span id="shooter-ammo-display">7 / ∞</span>
            </div>
            <button class="shooter-toggle-btn ${!this.isEnabled ? 'is-disabled' : ''}" id="shooter-toggle-btn" title="Включить / Выключить мини-игру">
                <span id="shooter-toggle-text">${this.isEnabled ? '🎯 ИГРА: ВКЛ' : '🎯 ИГРА: ВЫКЛ'}</span>
            </button>
        `;

        document.body.appendChild(container);
        this.topControlsElem = container;

        const toggleBtn = dom.get('shooter-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleEnabled());
        }
    }

    updateTopControlsView() {
        const toggleText = dom.get('shooter-toggle-text');
        if (toggleText) {
            toggleText.innerText = this.isEnabled ? '🎯 ИГРА: ВКЛ' : '🎯 ИГРА: ВЫКЛ';
        }
        const toggleBtn = dom.get('shooter-toggle-btn');
        if (toggleBtn) {
            if (this.isEnabled) {
                toggleBtn.classList.remove('is-disabled');
            } else {
                toggleBtn.classList.add('is-disabled');
            }
        }

        const waveDisplay = dom.get('shooter-wave-display');
        if (waveDisplay) {
            waveDisplay.innerText = `ВОЛНА ${this.wave}`;
        }

        const ammoDisplay = dom.get('shooter-ammo-display');
        const ammoBadge = dom.get('shooter-ammo-badge');
        const crosshairAmmo = dom.get('crosshair-ammo-indicator');
        const weapon = this.getCurrentWeapon();
        const clip = this.clips[weapon.id] !== undefined ? this.clips[weapon.id] : weapon.magSize;

        let ammoText = `${clip} / ∞`;
        if (this.isReloading) {
            ammoText = '🔄 ПЕРЕЗАРЯДКА...';
            if (ammoBadge) {
                ammoBadge.classList.add('is-reloading');
                ammoBadge.classList.remove('is-empty');
            }
        } else if (clip === 0) {
            ammoText = '⚠ НЕТ ПАТРОНОВ (R)';
            if (ammoBadge) {
                ammoBadge.classList.add('is-empty');
                ammoBadge.classList.remove('is-reloading');
            }
        } else {
            if (ammoBadge) {
                ammoBadge.classList.remove('is-reloading', 'is-empty');
            }
        }

        if (ammoDisplay) ammoDisplay.innerText = ammoText;
        if (crosshairAmmo) crosshairAmmo.innerText = this.isReloading ? '🔄 ПЕРЕЗАРЯДКА' : `${clip}/∞`;
    }

    switchWeapon(weaponId) {
        if (WEAPONS[weaponId] && this.unlockedWeapons.includes(weaponId)) {
            this.currentWeaponId = weaponId;
            this.isReloading = false;
            taczAudio.playDryFire();
            this.updateHotbarView();
            this.attach3DGun();
            this.saveProgression();

            const w = WEAPONS[weaponId];
            this.spawnFloatingBanner(
                this.width / 2,
                this.height - 140,
                `🔫 ${w.name.toUpperCase()}`,
                '#38bdf8'
            );
        }
    }

    startReload() {
        const weapon = this.getCurrentWeapon();
        if (this.isReloading) return;
        if (this.clips[weapon.id] === weapon.magSize) return;

        this.isReloading = true;
        this.reloadStartTime = performance.now();
        this.reloadDuration = weapon.reloadTime || 1500;

        taczAudio.playDryFire();
        this.updateTopControlsView();
        this.updateHotbarView();

        this.spawnFloatingBanner(this.width / 2, this.height / 2 + 50, '🔄 ПЕРЕЗАРЯДКА (R)...', '#fbbf24');
    }

    handleKeyDown(e) {
        if (!this.isGameLaunching || this.isLogModalOpen) return;

        // Перезарядка по кнопке R
        if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
            this.startReload();
            return;
        }

        // Выбор оружия цифровыми клавишами 1-7
        if (['1', '2', '3', '4', '5', '6', '7'].includes(e.key)) {
            const keys = Object.keys(WEAPONS);
            const index = parseInt(e.key, 10) - 1;
            if (keys[index]) {
                const targetW = keys[index];
                if (this.unlockedWeapons.includes(targetW)) {
                    this.switchWeapon(targetW);
                } else {
                    this.spawnFloatingBanner(this.width / 2, this.height - 130, '🔒 Оружие выпадет на волнах!', '#ef4444');
                }
            }
        }
    }

    handleWheel(e) {
        if (!this.isGameLaunching || this.isLogModalOpen) return;

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
        if (getSkinViewerMode() !== '3d') return;
        this.isGunAttached = true;
        const viewer = getSkinViewer3d();
        if (!viewer || !viewer.playerObject || !viewer.playerObject.skin) {
            setTimeout(() => this.attach3DGun(), 300);
            return;
        }

        const weaponMap = {
            'deagle': 'tacz_deagle',
            'spas_12': 'tacz_spas_12',
            'ak47': 'tacz_ak47',
            'vector45': 'tacz_vector45',
            'awp': 'tacz_awp',
            'rpg7': 'tacz_rpg7',
            'minigun': 'tacz_minigun'
        };

        const taczGunId = weaponMap[this.currentWeaponId] || ('tacz_' + this.currentWeaponId);
        equipmentManager.setSlot('mainHand', taczGunId);
        equipmentManager.applyToViewer(viewer);

        const rightArm = viewer.playerObject.skin.rightArm;
        const leftArm = viewer.playerObject.skin.leftArm;
        if (rightArm) {
            if (this.currentWeaponId === 'minigun') {
                rightArm.rotation.set(-0.95, -0.15, 0.08);
            } else if (this.currentWeaponId === 'rpg7') {
                rightArm.rotation.set(-Math.PI / 2.05, -0.20, 0.08);
            } else {
                rightArm.rotation.set(-Math.PI / 2, -0.22, 0.08);
            }
        }
        if (leftArm) {
            if (this.currentWeaponId === 'minigun') {
                leftArm.rotation.set(-1.25, 0.65, -0.30);
            } else if (this.currentWeaponId === 'rpg7') {
                leftArm.rotation.set(-Math.PI / 2.05, 0.70, -0.30);
            } else {
                leftArm.rotation.set(-Math.PI / 2.08, 0.75, -0.32);
            }
        }
    }

    detach3DGun() {
        if (getSkinViewerMode() !== '3d') {
            this.isGunAttached = false;
            return;
        }
        this.isGunAttached = false;
        const viewer = getSkinViewer3d();
        if (viewer && viewer.playerObject && viewer.playerObject.skin) {
            equipmentManager.loadEquipment();
            equipmentManager.applyToViewer(viewer);

            const rightArm = viewer.playerObject.skin.rightArm;
            const leftArm = viewer.playerObject.skin.leftArm;
            const head = viewer.playerObject.skin.head;
            if (rightArm) rightArm.rotation.set(0, 0, 0);
            if (leftArm) leftArm.rotation.set(0, 0, 0);
            if (head) head.rotation.set(0, 0, 0);
            viewer.playerObject.rotation.set(0, -0.32, 0);
        }
    }

    handleMouseMove(e) {
        if (!this.isGameLaunching || this.isLogModalOpen || !this.isEnabled) {
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

        const originX = this.width / 2;
        const originY = this.height / 2;

        const dx = e.clientX - originX;
        const dy = e.clientY - originY;

        const targetAngle = -Math.atan2(dy, dx) + Math.PI / 2;

        let currentAngle = viewer.playerObject.rotation.y;
        let diff = targetAngle - currentAngle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));

        viewer.playerObject.rotation.y += diff * 0.45;
    }

    handlePointerDown(e) {
        if (!this.isGameLaunching || this.isLogModalOpen || !this.isEnabled) return;

        const tag = e.target.tagName;
        if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(tag)) return;
        if (e.target.closest('button, input, select, textarea, a, .launch-log-modal, .shooter-hotbar-container, .shooter-top-controls, .custom-modal, #title-bar, #step-progress')) return;

        this.mousePos.x = e.clientX;
        this.mousePos.y = e.clientY;
        this.isFiring = true;

        const now = performance.now();
        const weapon = this.getCurrentWeapon();
        let effCooldown = weapon.cooldown || 250;
        if (this.buffs.rapidFire > now) effCooldown *= 0.5;

        if (now - this.lastFireTime >= effCooldown) {
            this.fireCurrentWeapon(e.clientX, e.clientY);
            this.lastFireTime = now;
        }
    }

    handlePointerUp() {
        this.isFiring = false;
    }

    getCurrentWeapon() {
        return WEAPONS[this.currentWeaponId] || WEAPONS.deagle;
    }

    fireCurrentWeapon(targetX, targetY) {
        const weapon = this.getCurrentWeapon();

        // Проверка перезарядки
        if (this.isReloading) {
            taczAudio.playDryFire();
            return;
        }

        const currentClip = this.clips[weapon.id] !== undefined ? this.clips[weapon.id] : weapon.magSize;

        // Если кончились патроны — запускаем перезарядку
        if (currentClip <= 0) {
            this.startReload();
            return;
        }

        // Тратим 1 патрон из обоймы
        this.clips[weapon.id] = Math.max(0, currentClip - 1);
        this.updateTopControlsView();
        this.updateHotbarView();

        const centerX = this.width / 2;
        const centerY = this.height / 2;

        const dx = targetX - centerX;
        const dy = targetY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const aimAngle = Math.atan2(dy, dx);
        const barrelOffset = 26;
        const startX = centerX + Math.cos(aimAngle) * barrelOffset;
        const startY = centerY + Math.sin(aimAngle) * barrelOffset;

        if (this.bullets.length >= 60) {
            this.bullets.splice(0, this.bullets.length - 50);
        }

        const isCrit = Math.random() < 0.12;
        let baseDmg = weapon.damage * (isCrit ? 2.5 : 1);
        if (this.buffs.doubleDamage > performance.now()) {
            baseDmg *= 2.2;
        }
        const finalDamage = Math.round(baseDmg);

        if (weapon.id === 'spas_12') {
            const totalPellets = weapon.pellets || 6;
            for (let p = 0; p < totalPellets; p++) {
                const spreadAngle = (Math.random() - 0.5) * (weapon.spread || 0.25);
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
                    color: this.buffs.doubleDamage > performance.now() ? '#ff0055' : weapon.color
                });
            }
            taczAudio.playShoot('spas_12');
            this.triggerScreenShake(3.5);
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
                color: this.buffs.doubleDamage > performance.now() ? '#ff0055' : weapon.color
            });
            taczAudio.playShoot('awp');
            this.triggerScreenShake(5);
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
            this.triggerScreenShake(6);
        } else {
            // deagle, ak47, vector45, minigun
            this.bullets.push({
                x: startX,
                y: startY,
                vx: Math.cos(aimAngle) * weapon.speed,
                vy: Math.sin(aimAngle) * weapon.speed,
                damage: finalDamage,
                isCrit,
                weaponId: weapon.id,
                distTravelled: 0,
                maxDist: dist + 150,
                length: weapon.id === 'minigun' ? 26 : (weapon.id === 'ak47' ? 28 : 20),
                width: weapon.id === 'deagle' ? 4 : 3,
                color: this.buffs.doubleDamage > performance.now() ? '#ff0055' : weapon.color
            });
            taczAudio.playShoot(weapon.id);
            if (weapon.id === 'deagle') this.triggerScreenShake(2.5);
            else if (weapon.id === 'minigun') this.triggerScreenShake(1.2);
        }

        if (this.muzzleFlashes.length < 8) {
            this.muzzleFlashes.push({
                x: startX,
                y: startY,
                radius: weapon.id === 'rpg7' || weapon.id === 'awp' ? 34 : 22,
                life: 1,
                decay: 0.25,
                color: this.buffs.rapidFire > performance.now() ? '#ffd700' : weapon.color
            });
        }

        this.triggerGunRecoil(weapon.id === 'awp' || weapon.id === 'rpg7' ? 1.5 : 0.8);

        // Авто-перезарядка при опустошении
        if (this.clips[weapon.id] === 0) {
            this.startReload();
        }
    }

    triggerScreenShake(intensity = 4) {
        this.shakeIntensity = Math.min(10, (this.shakeIntensity || 0) + intensity);
    }

    triggerGunRecoil(mult = 1) {
        if (getSkinViewerMode() !== '3d') return;
        try {
            const viewer = getSkinViewer3d();
            if (!viewer || !viewer.playerObject || !viewer.playerObject.skin) return;

            const rightArm = viewer.playerObject.skin.rightArm;
            if (rightArm) {
                rightArm.rotation.x = Math.max(-2.5, Math.min(-0.8, rightArm.rotation.x + 0.15 * mult));
            }
        } catch (_) {}
    }

    startTargetSpawner(intervalMs = 1200) {
        if (this.targetSpawnTimer) clearInterval(this.targetSpawnTimer);

        this.targetSpawnTimer = setInterval(() => {
            if (this.isGameLaunching && !this.isLogModalOpen && !this.isWaveIntermission) {
                if (this.mobsRemainingInWave > 0 && this.targets.length < 9) {
                    this.spawnTarget();
                    this.mobsRemainingInWave--;
                }
            }
        }, intervalMs);
    }

    spawnTarget() {
        if (!this.isGameLaunching) return;

        const mobPool = ['zombie', 'creeper', 'spider', 'skeleton', 'tnt', 'lucky_block'];
        const type = mobPool[Math.floor(Math.random() * mobPool.length)];

        const side = Math.floor(Math.random() * 4);
        let startX = 0;
        let startY = 0;

        if (side === 0) {
            startX = Math.random() * this.width;
            startY = -50;
        } else if (side === 1) {
            startX = this.width + 50;
            startY = 70 + Math.random() * (this.height - 180);
        } else if (side === 2) {
            startX = Math.random() * this.width;
            startY = this.height + 50;
        } else {
            startX = -50;
            startY = 70 + Math.random() * (this.height - 180);
        }

        let baseHp = 18 + this.wave * 2;
        let speed = 1.35 + Math.min(1.2, this.wave * 0.08);
        let damage = 12;
        let width = 46;
        let height = 46;

        if (type === 'zombie') {
            baseHp = 22 + this.wave * 2.5;
            speed = 1.3;
            damage = 14;
        } else if (type === 'creeper') {
            baseHp = 16 + this.wave * 2;
            speed = 1.6;
            damage = 28;
        } else if (type === 'spider') {
            baseHp = 12 + this.wave * 1.5;
            speed = 2.4;
            damage = 8;
            width = 44;
            height = 36;
        } else if (type === 'skeleton') {
            baseHp = 18 + this.wave * 2;
            speed = 1.1;
            damage = 15;
        } else if (type === 'tnt') {
            baseHp = 10 + this.wave * 1.5;
            speed = 2.0;
            damage = 25;
        } else if (type === 'lucky_block') {
            baseHp = 28;
            speed = 0.85;
            damage = 0;
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
        const bossTypes = ['cyber_wither', 'giga_creeper', 'ender_drone'];
        const type = bossTypes[this.bossKills % bossTypes.length];

        let name = 'КИБЕР-ВИЗЕР 3000';
        let maxHp = 220 + this.wave * 40;
        let width = 76;
        let height = 76;

        if (type === 'giga_creeper') {
            name = 'ГИГА-КРИПЕР «ЧЕРНОБЫЛЬ»';
            maxHp = 180 + this.wave * 35;
            width = 72;
            height = 72;
        } else if (type === 'ender_drone') {
            name = 'ЭНДЕР-ДРОН «ОМЕГА»';
            maxHp = 260 + this.wave * 45;
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

        this.spawnFloatingBanner(
            this.width / 2,
            180,
            `🚨 БОСС ВОЛНЫ: ${name}! 🚨`,
            '#ef4444'
        );
    }

    setGameLaunchingMode(isLaunching) {
        this.isGameLaunching = isLaunching;
        this.isActive = isLaunching && this.isEnabled;
        this.isFiring = false;

        const is3d = getSkinViewerMode() === '3d';

        if (isLaunching && this.isEnabled) {
            document.body.classList.add('is-shooter-active');
            if (is3d) {
                setTopDownShooterCamera(true);
                this.attach3DGun();
            }
            this.initClips();

            this.mobsRemainingInWave = 8 + this.wave * 3;
            this.startTargetSpawner(1200);

            if (this.crosshairElem) this.crosshairElem.classList.remove('hidden');
            if (this.playerDefenseElem) this.playerDefenseElem.classList.remove('hidden');
            if (this.hotbarElem) this.hotbarElem.classList.remove('hidden');
            if (this.topControlsElem) this.topControlsElem.classList.remove('hidden');

            this.updateHotbarView();
            this.updateTopControlsView();

            this.spawnTarget();
            this.spawnTarget();

            // Если стартовая волна кратна 5 — спавним босса
            if (this.wave % 5 === 0 && !this.currentBoss) {
                this.spawnBoss();
            }

            this.startLoop();
        } else {
            document.body.classList.remove('is-shooter-active');
            if (is3d) {
                setTopDownShooterCamera(false);
                this.detach3DGun();
            }
            this.stopLoop();
            this.saveProgression(true);
            if (this.targetSpawnTimer) {
                clearInterval(this.targetSpawnTimer);
                this.targetSpawnTimer = null;
            }
            this.targets = [];
            this.bullets = [];
            this.explosions = [];
            this.muzzleFlashes = [];
            this.damageNumbers = [];
            this.lootDrops = [];
            this.currentBoss = null;
            this.buffs = { rapidFire: 0, doubleDamage: 0, shield: 0 };

            if (this.crosshairElem) this.crosshairElem.classList.add('hidden');
            if (this.playerDefenseElem) this.playerDefenseElem.classList.add('hidden');
            if (this.hotbarElem) this.hotbarElem.classList.add('hidden');
            if (this.topControlsElem) this.topControlsElem.classList.add('hidden');
            if (this.bossHudElem) this.bossHudElem.classList.remove('visible');
            if (this.buffsBarElem) this.buffsBarElem.classList.add('hidden');

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
            if (this.hotbarElem) this.hotbarElem.classList.add('hidden');
            if (this.topControlsElem) this.topControlsElem.classList.add('hidden');
            if (this.bossHudElem) this.bossHudElem.classList.remove('visible');
            if (this.buffsBarElem) this.buffsBarElem.classList.add('hidden');
        } else {
            if (this.canvas) this.canvas.style.display = 'block';
            if (this.isGameLaunching && this.isEnabled) {
                if (this.crosshairElem) this.crosshairElem.classList.remove('hidden');
                if (this.playerDefenseElem) this.playerDefenseElem.classList.remove('hidden');
                if (this.hotbarElem) this.hotbarElem.classList.remove('hidden');
                if (this.topControlsElem) this.topControlsElem.classList.remove('hidden');
                if (this.bossTarget) this.bossHudElem?.classList.add('visible');
                this.updateBuffsHUD();
            }
        }
    }

    startLoop() {
        if (this.animId) return;
        this.render();
    }

    stopLoop() {
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
    }

    render() {
        if (this.ctx && this.isGameLaunching && this.isEnabled && !this.isLogModalOpen) {
            try {
                this.ctx.clearRect(0, 0, this.width, this.height);

                let hasShake = false;
                if (this.shakeIntensity > 0.1) {
                    hasShake = true;
                    const sx = (Math.random() - 0.5) * this.shakeIntensity;
                    const sy = (Math.random() - 0.5) * this.shakeIntensity;
                    this.ctx.save();
                    this.ctx.translate(sx, sy);
                    this.shakeIntensity *= 0.82;
                } else {
                    this.shakeIntensity = 0;
                }

                // 1. Проверка завершения перезарядки
                this.processReloadState();

                // 2. Регенерация
                this.processPlayerRegen();

                // 3. Автострельба
                this.processAutoFire();

                // 4. Отрисовка щита вокруг игрока (если активен бафф)
                this.drawPlayerShieldEffect();

                // 5. Обновление босса
                this.updateAndDrawBoss();

                // 6. Мобы
                this.updateAndDrawTargets();

                // 7. Выпавший лут (хилки, баффы, оружие)
                this.updateAndDrawLootDrops();

                // 8. Снаряды
                this.updateAndDrawBullets();

                // 9. Вспышки и взрывы
                this.updateAndDrawMuzzleFlashes();
                this.updateAndDrawExplosions();

                // 10. Всплывающий урон и баннеры
                this.updateAndDrawDamageNumbers();

                if (hasShake) {
                    this.ctx.restore();
                }

                // 11. Обновление плашек баффов
                this.updateBuffsHUD();

                // 12. Проверка завершения волны
                this.checkWaveCompletion();

            } catch (err) {
                console.error('[ShooterEngine Render Error]', err);
            }
        }

        if (this.isGameLaunching && this.isEnabled) {
            this.animId = requestAnimationFrame(this.render);
        } else {
            this.animId = null;
        }
    }

    drawPlayerShieldEffect() {
        if (this.buffs.shield <= performance.now()) return;

        const cx = this.width / 2;
        const cy = this.height / 2;
        const t = performance.now() * 0.003;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Вращающийся щитовой барьер
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 2.5;
        this.ctx.shadowColor = '#38bdf8';
        this.ctx.shadowBlur = 15;
        this.ctx.globalAlpha = 0.75 + Math.sin(t * 4) * 0.2;

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 42, 0, Math.PI * 2);
        this.ctx.stroke();

        // Узлы щита
        for (let i = 0; i < 4; i++) {
            const angle = t + (i * Math.PI) / 2;
            const nodeX = Math.cos(angle) * 42;
            const nodeY = Math.sin(angle) * 42;
            this.ctx.fillStyle = '#00f2fe';
            this.ctx.beginPath();
            this.ctx.arc(nodeX, nodeY, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    processReloadState() {
        if (this.isReloading) {
            const elapsed = performance.now() - this.reloadStartTime;
            if (elapsed >= this.reloadDuration) {
                const weapon = this.getCurrentWeapon();
                this.clips[weapon.id] = weapon.magSize;
                this.isReloading = false;
                audioSynth.playEquip();
                this.updateTopControlsView();
                this.updateHotbarView();
                this.spawnFloatingBanner(this.width / 2, this.height / 2 + 50, '⚡ ОБОЙМА ЗАРЯЖЕНА!', '#39ff14');
            }
        }
    }

    processPlayerRegen() {
        if (this.playerHp < this.playerMaxHp) {
            const now = performance.now();
            if (now - this.lastRegenTime >= 2500) {
                this.lastRegenTime = now;
                this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 2);
                this.updatePlayerDefenseHUD();
            }
        }
    }

    processAutoFire() {
        if (this.isFiring && !this.isReloading) {
            const now = performance.now();
            const weapon = this.getCurrentWeapon();
            let effCooldown = weapon.cooldown || 250;
            if (this.buffs.rapidFire > now) effCooldown *= 0.5;

            if (now - this.lastFireTime >= effCooldown) {
                this.fireCurrentWeapon(this.mousePos.x, this.mousePos.y);
                this.lastFireTime = now;
            }
        }
    }

    checkWaveCompletion() {
        if (this.isWaveIntermission) return;

        if (this.mobsRemainingInWave <= 0 && this.targets.length === 0 && !this.currentBoss) {
            this.isWaveIntermission = true;
            this.wave++;

            // Лечение игрока за волну
            this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 30);
            this.updatePlayerDefenseHUD();

            audioSynth.playFanfare();
            this.spawnFloatingBanner(
                this.width / 2,
                this.height / 2 - 80,
                `🎉 ВОЛНА ЗАЧИЩЕНА! +30 HP`,
                '#39ff14'
            );

            this.updateTopControlsView();
            this.saveProgression();

            setTimeout(() => {
                this.isWaveIntermission = false;
                this.mobsRemainingInWave = 8 + this.wave * 3;
                this.spawnFloatingBanner(
                    this.width / 2,
                    this.height / 2 - 80,
                    `🌊 ВОЛНА ${this.wave} НАЧАЛАСЬ!`,
                    '#38bdf8'
                );

                if (this.wave % 5 === 0) {
                    this.spawnBoss();
                }
            }, 2500);
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
            this.spawnFloatingBanner(b.x, b.y - 40, '🔥 БОСС В ЯРОСТИ!', '#ff0055');
        }

        this.drawBossShape(b);
    }

    drawBossShape(b) {
        this.ctx.save();
        this.ctx.translate(b.x, b.y);

        const half = b.width / 2;

        if (b.type === 'cyber_wither') {
            this.ctx.fillStyle = b.isEnraged ? '#ff0055' : '#1e1b4b';
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
            this.ctx.fillRect(-half, -half, b.width, b.height);

            this.ctx.fillStyle = '#052e16';
            const s = b.width / 8;
            this.ctx.fillRect(-half + s, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(half - s * 3, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(-half + s * 3, -half + s * 3, s * 2, s * 3);
            this.ctx.fillRect(-half + s * 2, -half + s * 4, s * 4, s * 3);

            const elapsed = (performance.now() - b.createdAt) / 1000;
            const remaining = Math.max(0, Math.ceil((b.fuseTimer || 14) - elapsed));
            this.ctx.fillStyle = '#facc15';
            this.ctx.font = 'bold 16px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`💣 ДЕТОНАЦИЯ: ${remaining}s`, 0, -half - 15);
        } else {
            this.ctx.fillStyle = '#581c87';
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

    updateAndDrawTargets() {
        const playerX = this.width / 2;
        const playerY = this.height / 2;

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];

            const dx = playerX - t.x;
            const dy = playerY - t.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
                t.vx = (dx / dist) * t.speed;
                t.vy = (dy / dist) * t.speed;
                t.x += t.vx;
                t.y += t.vy;
            }

            // Компактный радиус попадания по уменьшенному игроку (36px)
            if (dist < 36) {
                this.damagePlayer(t.damage || 12);
                this.createExplosion(t.x, t.y, t.type);
                this.targets.splice(i, 1);
                continue;
            }

            this.drawMobPixelArt(t, dist);
        }
    }

    drawMobPixelArt(t, distToPlayer) {
        this.ctx.save();
        this.ctx.translate(t.x, t.y);

        const halfW = t.width / 2;
        const halfH = t.height / 2;

        if (t.type === 'zombie') {
            this.ctx.fillStyle = '#1e3a8a';
            this.ctx.fillRect(-halfW * 0.8, -halfH + 20, t.width * 0.8, t.height - 20);
            this.ctx.fillStyle = '#16a34a';
            this.ctx.fillRect(-halfW * 0.7, -halfH, t.width * 0.7, 20);
            this.ctx.fillStyle = '#0f172a';
            this.ctx.fillRect(-8, -halfH + 6, 4, 4);
            this.ctx.fillRect(4, -halfH + 6, 4, 4);
        } else if (t.type === 'creeper') {
            this.ctx.fillStyle = '#16a34a';
            this.ctx.fillRect(-halfW, -halfH, t.width, t.height);
            this.ctx.fillStyle = '#052e16';
            this.ctx.fillRect(-12, -halfH + 8, 8, 8);
            this.ctx.fillRect(4, -halfH + 8, 8, 8);
            this.ctx.fillRect(-6, -halfH + 16, 12, 16);
        } else if (t.type === 'spider') {
            this.ctx.fillStyle = '#18181b';
            this.ctx.fillRect(-halfW, -halfH, t.width, t.height);
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(-10, -halfH + 4, 4, 4);
            this.ctx.fillRect(6, -halfH + 4, 4, 4);
            this.ctx.fillRect(-6, -halfH + 4, 3, 3);
            this.ctx.fillRect(3, -halfH + 4, 3, 3);
        } else if (t.type === 'skeleton') {
            this.ctx.fillStyle = '#e2e8f0';
            this.ctx.fillRect(-halfW * 0.7, -halfH, t.width * 0.7, t.height);
            this.ctx.fillStyle = '#0f172a';
            this.ctx.fillRect(-8, -halfH + 8, 5, 5);
            this.ctx.fillRect(3, -halfH + 8, 5, 5);
        } else if (t.type === 'tnt') {
            this.ctx.fillStyle = '#dc2626';
            this.ctx.fillRect(-halfW, -halfH, t.width, t.height);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(-halfW, -6, t.width, 12);
            this.ctx.fillStyle = '#000000';
            this.ctx.font = 'bold 10px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('TNT', 0, 3);
        } else if (t.type === 'lucky_block') {
            this.ctx.fillStyle = '#eab308';
            this.ctx.fillRect(-halfW, -halfH, t.width, t.height);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 20px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('?', 0, 7);
        }

        // Полоска здоровья моба
        const hpPct = Math.max(0, t.hp / t.maxHp);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(-halfW, -halfH - 8, t.width, 4);
        this.ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : (hpPct > 0.25 ? '#eab308' : '#ef4444');
        this.ctx.fillRect(-halfW, -halfH - 8, t.width * hpPct, 4);

        this.ctx.restore();
    }

    spawnLootDrop(x, y, type = 'heal', weaponId = null) {
        this.lootDrops.push({
            x,
            y,
            type, // 'heal' | 'buff_rapid' | 'buff_damage' | 'buff_shield' | 'nuke' | 'weapon'
            weaponId,
            wobble: Math.random() * Math.PI * 2,
            createdAt: performance.now()
        });
    }

    triggerNukeBlast() {
        audioSynth.playBassDrop();
        this.triggerScreenShake(10);
        this.createExplosion(this.width / 2, this.height / 2, 'tnt');

        // Уничтожаем всех обычных мобов на экране
        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            t.alive = false;
            this.createExplosion(t.x, t.y, t.type);
            this.spawnDamageNumber(t.x, t.y, 999, true, 'rpg7');
        }
        this.targets = [];

        // Урон боссу
        if (this.currentBoss) {
            this.currentBoss.hp -= 80;
            this.spawnDamageNumber(this.currentBoss.x, this.currentBoss.y, 80, true, 'rpg7');
            this.updateBossHealthHUD();
            if (this.currentBoss.hp <= 0) {
                this.onBossDefeated();
            }
        }
    }

    updateAndDrawLootDrops() {
        if (this.lootDrops.length === 0) return;

        const playerX = this.width / 2;
        const playerY = this.height / 2;

        for (let i = this.lootDrops.length - 1; i >= 0; i--) {
            const drop = this.lootDrops[i];
            drop.wobble += 0.05;

            // Притяжение лута к игроку
            const dx = playerX - drop.x;
            const dy = playerY - drop.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 160) {
                drop.x += (dx / dist) * 3.8;
                drop.y += (dy / dist) * 3.8;
            }

            // Подбор лута игроком (радиус 36px)
            if (dist < 36) {
                const now = performance.now();

                if (drop.type === 'weapon' && drop.weaponId) {
                    const w = WEAPONS[drop.weaponId];
                    if (!this.unlockedWeapons.includes(drop.weaponId)) {
                        this.unlockedWeapons.push(drop.weaponId);
                    }
                    this.switchWeapon(drop.weaponId);
                    audioSynth.playFanfare();
                    this.spawnFloatingBanner(
                        this.width / 2,
                        this.height / 2 - 60,
                        `🎁 НОВОЕ ОРУЖИЕ: ${w ? w.name.toUpperCase() : drop.weaponId}!`,
                        '#fbbf24'
                    );
                } else if (drop.type === 'heal') {
                    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 35);
                    this.updatePlayerDefenseHUD();
                    audioSynth.playCoinPickup();
                    this.spawnFloatingBanner(
                        this.width / 2,
                        this.height / 2 - 60,
                        `💚 +35 HP ЛЕЧЕНИЕ!`,
                        '#22c55e'
                    );
                } else if (drop.type === 'buff_rapid') {
                    this.buffs.rapidFire = now + 10000;
                    // Мгновенно перезаряжаем текущее оружие
                    const curW = this.getCurrentWeapon();
                    this.clips[curW.id] = curW.magSize;
                    this.isReloading = false;
                    audioSynth.playEquip();
                    this.spawnFloatingBanner(
                        this.width / 2,
                        this.height / 2 - 60,
                        `⚡ ГИПЕР-СКОРОСТРЕЛЬНОСТЬ (10с)!`,
                        '#fbbf24'
                    );
                } else if (drop.type === 'buff_damage') {
                    this.buffs.doubleDamage = now + 10000;
                    audioSynth.playBossWarning();
                    this.spawnFloatingBanner(
                        this.width / 2,
                        this.height / 2 - 60,
                        `💥 КВАД-УРОН 2.2x (10с)!`,
                        '#ef4444'
                    );
                } else if (drop.type === 'buff_shield') {
                    this.buffs.shield = now + 8000;
                    audioSynth.playFanfare();
                    this.spawnFloatingBanner(
                        this.width / 2,
                        this.height / 2 - 60,
                        `🛡️ ЭНЕРГО-ЩИТ (8с)!`,
                        '#38bdf8'
                    );
                } else if (drop.type === 'nuke') {
                    this.triggerNukeBlast();
                    this.spawnFloatingBanner(
                        this.width / 2,
                        this.height / 2 - 60,
                        `☢️ ТАКТИЧЕСКИЙ УДАР!`,
                        '#facc15'
                    );
                }

                this.updateHotbarView();
                this.updateTopControlsView();
                this.lootDrops.splice(i, 1);
                continue;
            }

            // Отрисовка лута
            this.ctx.save();
            this.ctx.translate(drop.x, drop.y + Math.sin(drop.wobble) * 6);

            // Настройка ауры и цвета
            let auraColor = '#22c55e';
            let iconText = '💚';

            if (drop.type === 'weapon') {
                auraColor = '#fbbf24';
                iconText = '🔫';
            } else if (drop.type === 'buff_rapid') {
                auraColor = '#fbbf24';
                iconText = '⚡';
            } else if (drop.type === 'buff_damage') {
                auraColor = '#ef4444';
                iconText = '💥';
            } else if (drop.type === 'buff_shield') {
                auraColor = '#38bdf8';
                iconText = '🛡️';
            } else if (drop.type === 'nuke') {
                auraColor = '#eab308';
                iconText = '☢️';
            }

            // Свечение ауры
            this.ctx.fillStyle = auraColor;
            this.ctx.globalAlpha = 0.35 + Math.sin(drop.wobble * 2) * 0.15;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
            this.ctx.fill();

            // Рамка ящика
            this.ctx.globalAlpha = 0.95;
            this.ctx.fillStyle = '#0f172a';
            this.ctx.strokeStyle = auraColor;
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(-14, -14, 28, 28);
            this.ctx.strokeRect(-14, -14, 28, 28);

            // Иконка
            this.ctx.fillStyle = auraColor;
            this.ctx.font = '14px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(iconText, 0, 5);

            this.ctx.restore();
        }
    }

    updateAndDrawBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            if (b.isHoming && this.targets.length > 0) {
                const target = this.targets[0];
                const tdx = target.x - b.x;
                const tdy = target.y - b.y;
                const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
                if (tdist > 0) {
                    b.vx += (tdx / tdist) * 1.6;
                    b.vy += (tdy / tdist) * 1.6;
                    const curSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                    b.vx = (b.vx / curSpd) * 22;
                    b.vy = (b.vy / curSpd) * 22;
                }
            }

            b.x += b.vx;
            b.y += b.vy;
            b.distTravelled += Math.sqrt(b.vx * b.vx + b.vy * b.vy);

            this.ctx.save();
            this.ctx.strokeStyle = b.color || '#39ff14';
            this.ctx.lineWidth = b.width || 3;
            this.ctx.lineCap = 'round';

            const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
            const tailLen = Math.min(b.length || 24, b.distTravelled);
            const tailX = b.x - (b.vx / spd) * tailLen;
            const tailY = b.y - (b.vy / spd) * tailLen;

            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(b.x, b.y);
            this.ctx.stroke();
            this.ctx.restore();

            const bulletConsumed = this.checkBulletCollisions(b);

            if (bulletConsumed || b.distTravelled >= b.maxDist || b.x < -100 || b.x > this.width + 100 || b.y < -100 || b.y > this.height + 100) {
                this.bullets.splice(i, 1);
            }
        }
    }

    checkBulletCollisions(bullet) {
        if (this.currentBoss) {
            const b = this.currentBoss;
            const dx = bullet.x - b.x;
            const dy = bullet.y - b.y;
            const distSq = dx * dx + dy * dy;
            const hitR = b.width * 0.75;

            if (distSq < hitR * hitR) {
                b.hp -= bullet.damage;
                this.spawnDamageNumber(bullet.x, bullet.y, bullet.damage, bullet.isCrit, bullet.weaponId);

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
                return !bullet.isPiercing;
            }
        }

        for (let j = this.targets.length - 1; j >= 0; j--) {
            const t = this.targets[j];
            if (!t.alive) continue;

            const dx = bullet.x - t.x;
            const dy = bullet.y - t.y;
            const distSq = dx * dx + dy * dy;
            const hitR = t.width * 0.75;

            if (distSq < hitR * hitR) {
                t.hp -= bullet.damage;
                this.spawnDamageNumber(t.x, t.y, bullet.damage, bullet.isCrit, bullet.weaponId);

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
                return !bullet.isPiercing;
            }
        }

        return false;
    }

    updateBossHealthHUD() {
        if (!this.currentBoss || !this.bossHudElem) return;
        const b = this.currentBoss;
        const hpTextEl = dom.get('boss-hp-numbers');
        const hpFillEl = dom.get('boss-hp-fill');

        const pct = Math.max(0, Math.min(100, (b.hp / b.maxHp) * 100));
        if (hpTextEl) hpTextEl.innerText = `${Math.max(0, Math.round(b.hp))} / ${b.maxHp} HP (${Math.round(pct)}%)`;
        if (hpFillEl) hpFillEl.style.width = `${pct}%`;
    }

    onBossDefeated() {
        if (!this.currentBoss) return;
        const b = this.currentBoss;

        this.bossKills++;
        this.kills += 5;
        this.score += 1500;

        taczAudio.playKill();
        audioSynth.playBossDefeated();
        this.triggerScreenShake(8);

        this.createExplosion(b.x, b.y, 'lucky_block');
        this.createExplosion(b.x - 30, b.y - 20, 'tnt');
        this.createExplosion(b.x + 30, b.y + 20, 'creeper');

        // Гарантированный дроп оружия из босса
        const locked = Object.keys(WEAPONS).filter(k => !this.unlockedWeapons.includes(k));
        if (locked.length > 0) {
            const dropW = locked[Math.floor(Math.random() * locked.length)];
            this.spawnLootDrop(b.x, b.y, 'weapon', dropW);
        } else {
            this.spawnLootDrop(b.x, b.y, 'buff_damage');
        }
        // Дополнительный бафф/хилка с босса
        this.spawnLootDrop(b.x + 30, b.y, 'heal');

        this.spawnFloatingBanner(b.x, b.y, `🏆 БОСС УНИЧТОЖЕН!`, '#fbbf24');

        if (this.bossHudElem) {
            this.bossHudElem.classList.remove('visible');
        }

        this.currentBoss = null;
        this.saveProgression();
        this.updateTopControlsView();
    }

    onTargetDestroyed(target) {
        this.kills++;
        this.score += 100;

        taczAudio.playKill();
        if (Math.random() > 0.4) taczAudio.playHeadHit();

        this.createExplosion(target.x, target.y, target.type);

        // Шанс дропа лута (24% обычный моб, 75% lucky block)
        const dropChance = target.type === 'lucky_block' ? 0.75 : 0.24;
        if (Math.random() < dropChance) {
            const locked = Object.keys(WEAPONS).filter(k => !this.unlockedWeapons.includes(k));

            // Если есть неоткрытое оружие — 35% шанс дропа оружия
            if (locked.length > 0 && Math.random() < 0.35) {
                const dropW = locked[Math.floor(Math.random() * locked.length)];
                this.spawnLootDrop(target.x, target.y, 'weapon', dropW);
            } else {
                // Иначе выбираем полезный дроп: хилка или боевой бафф
                const pool = ['heal', 'heal', 'buff_rapid', 'buff_damage', 'buff_shield', 'nuke'];
                const selected = pool[Math.floor(Math.random() * pool.length)];
                this.spawnLootDrop(target.x, target.y, selected);
            }
        }

        this.saveProgression();
        this.updateTopControlsView();
    }

    spawnFloatingBanner(x, y, text, color = '#fbbf24') {
        if (this.damageNumbers.length >= 25) {
            this.damageNumbers.shift();
        }
        this.damageNumbers.push({
            x,
            y,
            vy: -1.8,
            text,
            isBanner: true,
            color,
            life: 1,
            decay: 0.02
        });
    }

    spawnDamageNumber(x, y, dmg, isCrit, weaponId) {
        if (this.damageNumbers.length >= 25) {
            this.damageNumbers.shift();
        }
        this.damageNumbers.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 15,
            vy: -2.2,
            damage: dmg,
            isCrit,
            weaponId,
            life: 1,
            decay: 0.035
        });
    }

    updateAndDrawDamageNumbers() {
        if (this.damageNumbers.length === 0) return;
        this.ctx.textAlign = 'center';

        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const d = this.damageNumbers[i];
            d.y += d.vy;
            d.life -= d.decay;

            if (d.life <= 0) {
                this.damageNumbers.splice(i, 1);
                continue;
            }

            this.ctx.globalAlpha = Math.max(0, d.life);

            if (d.isBanner) {
                this.ctx.font = 'bold 16px monospace';
                this.ctx.fillStyle = d.color || '#fbbf24';
                this.ctx.fillText(d.text, d.x, d.y);
            } else {
                this.ctx.font = d.isCrit ? 'bold 18px monospace' : 'bold 14px monospace';
                let color = '#39ff14';
                if (d.weaponId === 'player_hit') color = '#ff4d4d';
                else if (d.weaponId === 'shield_blocked') color = '#38bdf8';
                else if (d.isCrit) color = '#fbbf24';
                else if (d.weaponId === 'awp') color = '#c084fc';
                else if (d.weaponId === 'rpg7') color = '#f43f5e';

                this.ctx.fillStyle = color;
                if (d.weaponId === 'shield_blocked') {
                    this.ctx.fillText(`🛡️ БЛОК`, d.x, d.y);
                } else {
                    this.ctx.fillText(`-${d.damage}${d.isCrit ? ' ⚡' : ''}`, d.x, d.y);
                }
            }
        }
        this.ctx.globalAlpha = 1.0;
    }

    createExplosion(x, y, type) {
        if (this.explosions.length >= 75) {
            this.explosions.splice(0, 15);
        }
        const colors = type === 'creeper' 
            ? ['#16a34a', '#22c55e', '#052e16'] 
            : (type === 'tnt' ? ['#ef4444', '#f97316', '#ffffff'] : ['#eab308', '#fbbf24', '#38bdf8']);

        const count = type === 'tnt' ? 24 : 12;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 4.5;
            this.explosions.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 3 + Math.random() * 4,
                life: 1,
                decay: 0.045
            });
        }
    }

    updateAndDrawExplosions() {
        if (this.explosions.length === 0) return;

        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const p = this.explosions[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;

            if (p.life <= 0) {
                this.explosions.splice(i, 1);
                continue;
            }

            this.ctx.globalAlpha = Math.max(0, p.life);
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        }
        this.ctx.globalAlpha = 1.0;
    }

    updateAndDrawMuzzleFlashes() {
        if (this.muzzleFlashes.length === 0) return;

        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const m = this.muzzleFlashes[i];
            m.life -= m.decay;

            if (m.life <= 0) {
                this.muzzleFlashes.splice(i, 1);
                continue;
            }

            this.ctx.globalAlpha = Math.max(0, m.life);
            this.ctx.fillStyle = m.color || '#39ff14';

            this.ctx.beginPath();
            this.ctx.arc(m.x, m.y, m.radius * (1 - m.life * 0.3), 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;
    }
}

export const gunShooter = new GunShooterEngine();
