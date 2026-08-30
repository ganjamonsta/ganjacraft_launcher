/**
 * Ganj4Craft Launcher - Gun Shooter Mini-Game Engine v2.0
 * 3D Прицеливание персонажа, арсенал из 5 видов оружия, автострельба,
 * эпические боссы с полосками HP, прокачка и сохранение в профиле.
 */

import * as THREE from 'three';
import { getSkinViewer3d, getSkinViewerMode } from '../skin-viewer/skin-viewer.js';
import { audioSynth } from './audio-synth.js';
import { particlePopper } from './particle-pop.js';
import { dom } from '../../utils/dom.js';

// Конфигурация арсенала оружия
export const WEAPONS = {
    blaster: {
        id: 'blaster',
        name: 'Бластер',
        key: '1',
        icon: '🔫',
        damage: 14,
        cooldown: 260, // ms
        speed: 28,
        color: '#39ff14',
        unlockCost: 0,
        unlocked: true,
        desc: 'Точный плазменный пистолет'
    },
    shotgun: {
        id: 'shotgun',
        name: 'Дробовик',
        key: '2',
        icon: '💥',
        damage: 8,
        pellets: 5,
        spread: 0.24,
        cooldown: 580,
        speed: 24,
        color: '#ffaa00',
        unlockCost: 120,
        desc: 'Разрывной залп из 5 дробин'
    },
    smg: {
        id: 'smg',
        name: 'Hyper SMG',
        key: '3',
        icon: '⚡',
        damage: 7,
        cooldown: 85, // Высокая скорострельность при зажатии ЛКМ
        speed: 32,
        color: '#00f2fe',
        unlockCost: 280,
        desc: 'Скорострельный плазмомет (зажми ЛКМ)'
    },
    railgun: {
        id: 'railgun',
        name: 'Рельсотрон BFG',
        key: '4',
        icon: '🔮',
        damage: 75,
        cooldown: 920,
        speed: 50,
        color: '#a855f7',
        unlockCost: 650,
        isPiercing: true,
        desc: 'Пробивает всех врагов насквозь'
    },
    rocket: {
        id: 'rocket',
        name: 'Ракетница',
        key: '5',
        icon: '🚀',
        damage: 65,
        aoeRadius: 90,
        cooldown: 780,
        speed: 14,
        color: '#ff0055',
        unlockCost: 1100,
        isHoming: true,
        desc: 'Самонаводящиеся ракеты с взрывным уроном'
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
        this.currentWeaponId = 'blaster';
        this.unlockedWeapons = ['blaster'];
        this.upgrades = {
            damage: 0,
            fireRate: 0,
            critChance: 0,
            multiShot: 0
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
                if (Array.isArray(data.unlockedWeapons)) this.unlockedWeapons = data.unlockedWeapons;
                if (data.upgrades) this.upgrades = { ...this.upgrades, ...data.upgrades };
                if (data.currentWeaponId && this.unlockedWeapons.includes(data.currentWeaponId)) {
                    this.currentWeaponId = data.currentWeaponId;
                }
            }
        } catch (e) {
            console.debug('[ShooterEngine] Load save error', e);
        }
    }

    /**
     * Сохранение прогресса
     */
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

    /**
     * Инициализация холста и слушателей
     */
    init() {
        this.ensureCanvas();
        this.ensureCrosshair();
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

    /**
     * Прицел
     */
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
     * Полоса здоровья босса (Boss Health Bar)
     */
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

    /**
     * Хотбар оружия (1-5)
     */
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

            html += `
                <div class="weapon-slot ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}" data-weapon-id="${w.id}">
                    <span class="weapon-slot-key">${index + 1}</span>
                    <span class="weapon-slot-icon">${w.icon}</span>
                    <span class="weapon-slot-name">${w.name.split(' ')[0]}</span>
                    ${!isUnlocked ? '<span class="weapon-lock-badge">🔒</span>' : ''}
                </div>
            `;
        });

        this.hotbarElem.innerHTML = html;

        // Навешиваем клики на слоты
        this.hotbarElem.querySelectorAll('.weapon-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const wid = slot.getAttribute('data-weapon-id');
                if (this.unlockedWeapons.includes(wid)) {
                    this.switchWeapon(wid);
                } else {
                    this.openShop();
                }
            });
        });
    }

    /**
     * Верхние элементы (монеты + кнопка магазина)
     */
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
                <span>АРСЕНАЛ</span>
            </button>
        `;

        document.body.appendChild(container);
        this.topControlsElem = container;

        const shopBtn = dom.get('shooter-shop-btn');
        if (shopBtn) {
            shopBtn.addEventListener('click', () => this.toggleShop());
        }
    }

    /**
     * Окно магазина улучшений и арсенала
     */
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
                        <span>КИБЕР-АРСЕНАЛ & ПРОКАЧКА</span>
                    </div>
                    <button class="shooter-shop-close" id="shooter-shop-close">✕</button>
                </div>
                <div class="shooter-shop-body" id="shooter-shop-body">
                    <!-- Заполняется динамически -->
                </div>
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

    /**
     * Открыть / закрыть магазин
     */
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

        // 1. Оружие
        html += `<div class="shop-section-title"><span>🔫</span> <span>РАЗБЛОКИРОВКА ОРУЖИЯ</span></div>`;
        html += `<div class="shop-grid">`;
        Object.keys(WEAPONS).forEach(key => {
            const w = WEAPONS[key];
            const isUnlocked = this.unlockedWeapons.includes(w.id);
            const canAfford = this.coins >= w.unlockCost;

            html += `
                <div class="upgrade-card">
                    <div class="upgrade-info">
                        <div class="upgrade-name">
                            <span>${w.icon}</span>
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

        // 2. Улучшения характеристик
        const upgradeItems = [
            { key: 'damage', name: '💥 Урон пушек', desc: '+15% к урону всех орудий', baseCost: 50 },
            { key: 'fireRate', name: '⚡ Скорострельность', desc: '+12% к скорости стрельбы', baseCost: 50 },
            { key: 'critChance', name: '🎯 Шанс крита', desc: '+5% к шансу нанести 2.5x урон', baseCost: 60 },
            { key: 'multiShot', name: '🔱 Мульти-выстрел', desc: '+1 параллельный снаряд', baseCost: 250, max: 3 }
        ];

        html += `<div class="shop-section-title" style="margin-top:15px;"><span>⚙️</span> <span>МОДИФИКАЦИИ БОЙЦА</span></div>`;
        html += `<div class="shop-grid">`;

        upgradeItems.forEach(item => {
            const currentLvl = this.upgrades[item.key] || 0;
            const maxLvl = item.max || 10;
            const isMax = currentLvl >= maxLvl;
            const cost = Math.round(item.baseCost * Math.pow(1.5, currentLvl));
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

        // Слушатели покупок оружия
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
                    this.updateCoinsDisplay();
                }
            });
        });

        // Слушатели покупок улучшений
        body.querySelectorAll('[data-buy-upgrade]').forEach(btn => {
            btn.addEventListener('click', () => {
                const upKey = btn.getAttribute('data-buy-upgrade');
                const cost = parseInt(btn.getAttribute('data-cost'), 10);
                if (upKey && this.coins >= cost) {
                    this.coins -= cost;
                    this.upgrades[upKey] = (this.upgrades[upKey] || 0) + 1;
                    audioSynth.playUpgradePurchased();
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

    /**
     * Смена текущего оружия
     */
    switchWeapon(weaponId) {
        if (WEAPONS[weaponId] && this.unlockedWeapons.includes(weaponId)) {
            this.currentWeaponId = weaponId;
            audioSynth.playJump();
            this.updateHotbarView();
            this.saveProgression();

            // Всплывающее оповещение
            const w = WEAPONS[weaponId];
            particlePopper.spawnFloatingScore(
                window.innerWidth / 2,
                window.innerHeight - 90,
                `${w.icon} ${w.name.toUpperCase()}`
            );
        }
    }

    /**
     * Переключение горячими клавишами 1-5, B/U
     */
    handleKeyDown(e) {
        if (!this.isGameLaunching || this.isLogModalOpen) return;

        // 1-5
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
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

    /**
     * Прикрепить 3D кибер-бластер к руке скина
     */
    attach3DGun() {
        const viewer = getSkinViewer3d();
        if (!viewer || !viewer.playerObject || !viewer.playerObject.skin) {
            setTimeout(() => this.attach3DGun(), 500);
            return;
        }

        const rightArm = viewer.playerObject.skin.rightArm;
        if (!rightArm || this.isGunAttached) return;

        if (!this.defaultRightArmPos) {
            this.defaultRightArmPos = {
                x: rightArm.position.x !== 0 ? rightArm.position.x : -5,
                y: rightArm.position.y !== 0 ? rightArm.position.y : 22,
                z: rightArm.position.z || 0
            };
        }

        const gunGroup = new THREE.Group();
        gunGroup.name = 'CyberBlaster';

        // Рукоять
        const gripGeo = new THREE.BoxGeometry(1.6, 3.2, 2.0);
        const gripMat = new THREE.MeshBasicMaterial({ color: 0x111813 });
        const gripMesh = new THREE.Mesh(gripGeo, gripMat);
        gripMesh.position.set(0, -0.8, 0);
        gunGroup.add(gripMesh);

        // Корпус
        const bodyGeo = new THREE.BoxGeometry(2.4, 3.4, 7.5);
        const bodyMat = new THREE.MeshBasicMaterial({ color: 0x1f2937 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(0, 1.2, 2.6);
        gunGroup.add(bodyMesh);

        // Неоновый энергетический сердечник
        const coreGeo = new THREE.BoxGeometry(2.5, 0.8, 4.5);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        coreMesh.position.set(0, 1.6, 2.8);
        gunGroup.add(coreMesh);

        // Ствол
        const barrelGeo = new THREE.BoxGeometry(1.8, 1.8, 3.5);
        const barrelMat = new THREE.MeshBasicMaterial({ color: 0x059669 });
        const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
        barrelMesh.position.set(0, 1.2, 7.0);
        gunGroup.add(barrelMesh);

        gunGroup.position.set(0, -10, 0);
        rightArm.add(gunGroup);
        this.gunMesh = gunGroup;
        this.isGunAttached = true;

        rightArm.rotation.x = -Math.PI / 2;
    }

    detach3DGun() {
        if (this.gunMesh) {
            if (this.gunMesh.parent) {
                this.gunMesh.parent.remove(this.gunMesh);
            }
            this.gunMesh = null;
        }
        this.isGunAttached = false;

        const viewer = getSkinViewer3d();
        if (viewer && viewer.playerObject && viewer.playerObject.skin) {
            const rightArm = viewer.playerObject.skin.rightArm;
            const head = viewer.playerObject.skin.head;
            if (rightArm) {
                rightArm.rotation.set(0, 0, 0);
                if (this.defaultRightArmPos) {
                    rightArm.position.set(
                        this.defaultRightArmPos.x,
                        this.defaultRightArmPos.y,
                        this.defaultRightArmPos.z
                    );
                } else {
                    rightArm.position.set(-5, 22, 0);
                }
            }
            if (head) head.rotation.set(0, 0, 0);
            viewer.playerObject.rotation.y = -0.45;
        }
    }

    /**
     * Прицеливание мыши
     */
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

        const skinCanvas = dom.get('skin-canvas-3d');
        if (!skinCanvas) return;

        const rect = skinCanvas.getBoundingClientRect();
        const originX = rect.left + rect.width * 0.45;
        const originY = rect.top + rect.height * 0.38;

        const deltaX = (e.clientX - originX) / (window.innerWidth / 2);
        const deltaY = (e.clientY - originY) / (window.innerHeight / 2);

        // Поворот тела
        const targetBodyRotY = -0.45 + Math.max(-0.6, Math.min(0.65, deltaX * 0.75));
        viewer.playerObject.rotation.y += (targetBodyRotY - viewer.playerObject.rotation.y) * 0.18;

        const rightArm = viewer.playerObject.skin.rightArm;
        const head = viewer.playerObject.skin.head;

        // Поворот руки
        if (rightArm) {
            const targetRotX = -Math.PI / 2 + Math.max(-0.6, Math.min(0.6, deltaY * 0.75));
            const targetRotY = Math.max(-0.4, Math.min(0.4, deltaX * 0.45));
            const targetRotZ = Math.max(-0.2, Math.min(0.2, deltaY * 0.3));

            rightArm.rotation.x += (targetRotX - rightArm.rotation.x) * 0.25;
            rightArm.rotation.y += (targetRotY - rightArm.rotation.y) * 0.25;
            rightArm.rotation.z += (targetRotZ - rightArm.rotation.z) * 0.25;
        }

        // Поворот головы
        if (head) {
            const headRotY = Math.max(-0.6, Math.min(0.6, deltaX * 0.6));
            const headRotX = Math.max(-0.4, Math.min(0.4, deltaY * 0.5));
            head.rotation.y += (headRotY - head.rotation.y) * 0.2;
            head.rotation.x += (headRotX - head.rotation.x) * 0.2;
        }
    }

    /**
     * Обработка нажатия клавиши мыши (старт автострельбы)
     */
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

    /**
     * Текущее оружие со всеми бонусами прокачки
     */
    getCurrentWeapon() {
        return WEAPONS[this.currentWeaponId] || WEAPONS.blaster;
    }

    /**
     * Произвести выстрел из текущего оружия
     */
    fireCurrentWeapon(targetX, targetY) {
        const weapon = this.getCurrentWeapon();
        const skinCanvas = dom.get('skin-canvas-3d');
        let startX = 140;
        let startY = 220;

        if (skinCanvas) {
            const rect = skinCanvas.getBoundingClientRect();
            startX = rect.left + rect.width * 0.62;
            startY = rect.top + rect.height * 0.42;
        }

        const dx = targetX - startX;
        const dy = targetY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        // Расчет урона и бонусов
        const dmgMult = 1 + (this.upgrades.damage * 0.15);
        const isCrit = Math.random() < (0.08 + this.upgrades.critChance * 0.05);
        const finalDamage = Math.round(weapon.damage * dmgMult * (isCrit ? 2.5 : 1));
        const extraPellets = this.upgrades.multiShot || 0;

        // Выстрел в зависимости от типа оружия
        if (weapon.id === 'shotgun') {
            const totalPellets = (weapon.pellets || 5) + extraPellets * 2;
            for (let p = 0; p < totalPellets; p++) {
                const spreadAngle = (Math.random() - 0.5) * (weapon.spread || 0.24);
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
            audioSynth.playShotgun();
            this.triggerScreenShake(3);
        } else if (weapon.id === 'smg') {
            const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.08;
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
                length: 22,
                width: 3,
                color: weapon.color
            });
            audioSynth.playSMG();
        } else if (weapon.id === 'railgun') {
            // BFG Рельсотрон - мгновенный пробивающий луч
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
                length: 60,
                width: 8,
                color: weapon.color
            });
            audioSynth.playRailgun();
            this.triggerScreenShake(7);
        } else if (weapon.id === 'rocket') {
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
                length: 28,
                width: 6,
                color: weapon.color
            });
            audioSynth.playRocketLaunch();
        } else {
            // Базовый бластер (+ мультишот)
            const shots = 1 + extraPellets;
            for (let s = 0; s < shots; s++) {
                const spreadAngle = shots > 1 ? (s - (shots - 1) / 2) * 0.1 : 0;
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
                    maxDist: dist + 100,
                    length: 30,
                    width: 4,
                    color: weapon.color
                });
            }
            audioSynth.playLaserShot();
        }

        // Вспышка у дула
        this.muzzleFlashes.push({
            x: startX,
            y: startY,
            radius: weapon.id === 'railgun' ? 32 : 22,
            life: 1,
            decay: 0.25,
            color: weapon.color
        });

        // Отдача
        this.triggerGunRecoil(weapon.id === 'railgun' ? 1.8 : 1.0);
    }

    triggerScreenShake(intensity = 4) {
        document.body.classList.remove('screen-shaking');
        void document.body.offsetWidth; // Reflow
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
     * Спавн мишеней и проверка появления БОССА
     */
    startTargetSpawner(intervalMs = 1400) {
        if (this.targetSpawnTimer) clearInterval(this.targetSpawnTimer);

        this.targetSpawnTimer = setInterval(() => {
            if (this.isGameLaunching && !this.isLogModalOpen && !this.isShopOpen) {
                // Проверка спавна босса каждые 12 фрагов
                if (!this.currentBoss && (this.kills - this.lastBossKills >= 12)) {
                    this.spawnBoss();
                } else if (this.targets.length < 6) {
                    this.spawnTarget();
                }
            }
        }, intervalMs);
    }

    spawnTarget() {
        if (!this.isGameLaunching) return;

        const types = ['creeper', 'drone', 'tnt', 'lucky_block'];
        const type = types[Math.floor(Math.random() * types.length)];

        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? -50 : this.width + 50;
        const y = 90 + Math.random() * (this.height - 240);
        const speed = (fromLeft ? 1 : -1) * (1.3 + Math.random() * 2.0);

        this.targets.push({
            type,
            x: startX,
            y,
            baseY: y,
            vx: speed,
            wobbleOffset: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.04 + Math.random() * 0.03,
            wobbleAmp: 18 + Math.random() * 15,
            width: 46,
            height: 46,
            alive: true,
            hp: type === 'lucky_block' ? 30 : 15,
            maxHp: type === 'lucky_block' ? 30 : 15,
            createdAt: performance.now()
        });
    }

    /**
     * Спавн БОССА
     */
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
            y: -100, // Вылетает сверху
            targetY: 130 + Math.random() * 60,
            vx: 2.2,
            width,
            height,
            isEnraged: false,
            wobble: 0,
            fuseTimer: type === 'giga_creeper' ? 14 : null, // 14 секунд детонации
            lastTeleport: performance.now(),
            createdAt: performance.now()
        };

        audioSynth.playBossWarning();
        this.triggerScreenShake(8);

        // Обновляем Boss HUD
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

        // Всплывающее предупреждение
        particlePopper.spawnFloatingScore(
            this.width / 2,
            180,
            `🚨 ВНИМАНИЕ: БОСС! 🚨`
        );
    }

    /**
     * Включение / выключение игрового режима при запуске
     */
    setGameLaunchingMode(isLaunching) {
        this.isGameLaunching = isLaunching;
        this.isActive = isLaunching;
        this.isFiring = false;

        if (isLaunching) {
            this.attach3DGun();
            this.startTargetSpawner(1400);

            if (this.crosshairElem) this.crosshairElem.classList.remove('hidden');
            if (this.hotbarElem) this.hotbarElem.classList.remove('hidden');
            if (this.topControlsElem) this.topControlsElem.classList.remove('hidden');

            this.updateHotbarView();
            this.updateCoinsDisplay();

            // Стартовые мишени
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
        } else {
            if (this.canvas) this.canvas.style.display = 'block';
            if (this.isGameLaunching && this.crosshairElem) {
                this.crosshairElem.classList.remove('hidden');
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

            // 1. Автострельба
            this.processAutoFire();

            // 2. Обновление босса
            this.updateAndDrawBoss();

            // 3. Обычные мишени
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

    /**
     * Отрисовка и поведение БОССА
     */
    updateAndDrawBoss() {
        if (!this.currentBoss) return;
        const b = this.currentBoss;

        // Плавный вход сверху
        if (b.y < b.targetY) {
            b.y += (b.targetY - b.y) * 0.08;
        } else {
            // Паттерны движения
            b.wobble += 0.04;
            b.x += b.vx;

            // Отскок от границ
            if (b.x < b.width) {
                b.x = b.width;
                b.vx = Math.abs(b.vx);
            } else if (b.x > this.width - b.width) {
                b.x = this.width - b.width;
                b.vx = -Math.abs(b.vx);
            }

            b.y = b.targetY + Math.sin(b.wobble) * 25;

            // Телепортация для Эндер-Дрона
            if (b.type === 'ender_drone' && performance.now() - b.lastTeleport > 3500) {
                b.lastTeleport = performance.now();
                b.x = 100 + Math.random() * (this.width - 200);
                this.createExplosion(b.x, b.y, 'lucky_block');
                audioSynth.playJump();
            }
        }

        // Проверка ярости при HP < 50%
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
            // Кибер-Визер 3 головы
            this.ctx.fillStyle = b.isEnraged ? '#ff0055' : '#1e1b4b';
            this.ctx.shadowColor = b.isEnraged ? '#ff0055' : '#a855f7';
            this.ctx.shadowBlur = 25;

            // Тело
            this.ctx.fillRect(-half * 0.6, -half * 0.4, b.width * 0.6, b.height * 0.8);

            // Центральная голова
            this.ctx.fillStyle = '#0f172a';
            this.ctx.fillRect(-18, -half - 10, 36, 32);
            // Глаза
            this.ctx.fillStyle = b.isEnraged ? '#ff0055' : '#38bdf8';
            this.ctx.fillRect(-12, -half + 2, 8, 8);
            this.ctx.fillRect(4, -half + 2, 8, 8);

            // Левая голова
            this.ctx.fillStyle = '#0f172a';
            this.ctx.fillRect(-half - 12, -half + 5, 24, 24);
            this.ctx.fillStyle = '#a855f7';
            this.ctx.fillRect(-half - 8, -half + 12, 6, 6);

            // Правая голова
            this.ctx.fillStyle = '#0f172a';
            this.ctx.fillRect(half - 12, -half + 5, 24, 24);
            this.ctx.fillStyle = '#a855f7';
            this.ctx.fillRect(half - 8, -half + 12, 6, 6);
        } else if (b.type === 'giga_creeper') {
            // Гига-крипер
            this.ctx.fillStyle = b.isEnraged ? '#ef4444' : '#22c55e';
            this.ctx.shadowColor = b.isEnraged ? '#ef4444' : '#39ff14';
            this.ctx.shadowBlur = 30;

            this.ctx.fillRect(-half, -half, b.width, b.height);

            // Лицо
            this.ctx.fillStyle = '#052e16';
            const s = b.width / 8;
            this.ctx.fillRect(-half + s, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(half - s * 3, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(-half + s * 3, -half + s * 3, s * 2, s * 3);
            this.ctx.fillRect(-half + s * 2, -half + s * 4, s * 4, s * 3);

            // Таймер взрыва над головой
            const elapsed = (performance.now() - b.createdAt) / 1000;
            const remaining = Math.max(0, Math.ceil(b.fuseTimer - elapsed));
            this.ctx.fillStyle = '#facc15';
            this.ctx.font = 'bold 16px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`💣 ДЕТОНАЦИЯ: ${remaining}s`, 0, -half - 15);
        } else {
            // Эндер-Дрон Омега
            this.ctx.fillStyle = '#581c87';
            this.ctx.shadowColor = '#d946ef';
            this.ctx.shadowBlur = 25;

            // Крылья
            this.ctx.beginPath();
            this.ctx.moveTo(-half - 20, -10);
            this.ctx.lineTo(half + 20, -10);
            this.ctx.lineTo(0, half + 10);
            this.ctx.closePath();
            this.ctx.fill();

            // Фиолетовый глаз
            this.ctx.fillStyle = '#f0abfc';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    /**
     * Отрисовка плазменных снарядов
     */
    updateAndDrawBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            // Самонаведение ракет
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

            // Внешний луч
            this.ctx.strokeStyle = b.color;
            this.ctx.lineWidth = b.width;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(b.x, b.y);
            this.ctx.stroke();

            // Ядро
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = b.width * 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(b.x, b.y);
            this.ctx.stroke();
            this.ctx.restore();

            // Столкновения
            this.checkBulletCollisions(b, i);

            // Удаление
            if (b.distTravelled >= b.maxDist || b.x < -100 || b.x > this.width + 100 || b.y < -100 || b.y > this.height + 100) {
                this.bullets.splice(i, 1);
            }
        }
    }

    /**
     * Проверка попаданий снарядов
     */
    checkBulletCollisions(bullet, bulletIndex) {
        // 1. Попадание в БОССА
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

                if (bullet.weaponId === 'rocket') {
                    audioSynth.playRocketExplode();
                    this.createExplosion(b.x, b.y, 'tnt');
                } else {
                    audioSynth.playTargetHit();
                }

                this.updateBossHealthHUD();

                if (b.hp <= 0) {
                    this.onBossDefeated();
                }
                return;
            }
        }

        // 2. Попадание в обычные мишени
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

                if (bullet.weaponId === 'rocket') {
                    audioSynth.playRocketExplode();
                    this.createExplosion(t.x, t.y, 'tnt');
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

        audioSynth.playBossDefeated();
        this.triggerScreenShake(12);

        // Салют монет
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
        const dropCoins = target.type === 'lucky_block' ? 12 : (target.type === 'tnt' ? 6 : 3);
        this.coins += dropCoins;

        audioSynth.playTargetHit();
        if (Math.random() > 0.5) audioSynth.playHeadshot();

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

            if (d.isCrit) {
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
            c.vy += 0.18; // Гравитация
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

    updateAndDrawTargets() {
        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            t.x += t.vx;
            t.wobbleOffset += t.wobbleSpeed;
            t.y = t.baseY + Math.sin(t.wobbleOffset) * t.wobbleAmp;

            this.drawTargetShape(t);

            if ((t.vx > 0 && t.x > this.width + 100) || (t.vx < 0 && t.x < -100)) {
                this.targets.splice(i, 1);
            }
        }
    }

    drawTargetShape(t) {
        this.ctx.save();
        this.ctx.translate(t.x, t.y);

        const half = t.width / 2;

        if (t.type === 'creeper') {
            this.ctx.fillStyle = '#22c55e';
            this.ctx.shadowColor = '#22c55e';
            this.ctx.shadowBlur = 10;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            this.ctx.fillStyle = '#0f172a';
            const s = t.width / 8;
            this.ctx.fillRect(-half + s, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(half - s * 3, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(-half + s * 3, -half + s * 3, s * 2, s * 3);
            this.ctx.fillRect(-half + s * 2, -half + s * 4, s * 4, s * 3);
            this.ctx.fillRect(-half + s * 2, -half + s * 6, s, s * 2);
            this.ctx.fillRect(half - s * 3, -half + s * 6, s, s * 2);
        } else if (t.type === 'tnt') {
            this.ctx.fillStyle = '#ef4444';
            this.ctx.shadowColor = '#ef4444';
            this.ctx.shadowBlur = 12;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            this.ctx.fillStyle = '#f8fafc';
            this.ctx.fillRect(-half, -6, t.width, 12);

            this.ctx.fillStyle = '#0f172a';
            this.ctx.font = 'bold 10px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('TNT', 0, 3);
        } else if (t.type === 'lucky_block') {
            this.ctx.fillStyle = '#eab308';
            this.ctx.shadowColor = '#eab308';
            this.ctx.shadowBlur = 14;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 18px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('?', 0, 6);
        } else {
            this.ctx.fillStyle = '#10b981';
            this.ctx.shadowColor = '#39ff14';
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, half, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#ff0055';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
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
