/**
 * Ganj4Craft Launcher - Gun Shooter (Aim Lab Mini-Game)
 * Легкая, отзывчивая и залипательная мини-игра для тренировки аима во время загрузки Minecraft.
 * Бесконечный боезапас, сочные звуки TACZ, комбо-серии, взрывы TNT и лаки-блоки.
 */

import * as THREE from 'three';
import { getSkinViewer3d, getSkinViewerMode, setTopDownShooterCamera } from '../skin-viewer/skin-viewer.js';
import { equipmentManager } from '../skin-viewer/equipment-manager.js';
import { audioSynth } from './audio-synth.js';
import { taczAudio } from './tacz-audio.js';
import { dom } from '../../utils/dom.js';

// Арсенал мини-игры: тяжелый пулемет Minigun и гранатомет RPG-7
export const WEAPONS = {
    minigun: {
        id: 'minigun',
        name: 'Minigun M134',
        key: '1',
        icon: 'assets/tacz/hud/minigun.png',
        isImg: true,
        damage: 26,
        cooldown: 40,
        speed: 46,
        color: '#ffd700',
        desc: 'Шестиствольный пулемет — шквал свинца'
    },
    rpg7: {
        id: 'rpg7',
        name: 'RPG-7',
        key: '2',
        icon: 'assets/tacz/hud/rpg7.png',
        isImg: true,
        damage: 280,
        aoeRadius: 150,
        cooldown: 800,
        speed: 24,
        color: '#ff0055',
        isHoming: true,
        desc: 'РПГ-7 — мощный фугасный взрыв'
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

        // Ввод и автострельба
        this.mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.isFiring = false;
        this.lastFireTime = 0;
        this.targetSpawnTimer = null;

        // Счет и комбо
        this.score = 0;
        this.kills = 0;
        this.combo = 1;
        this.maxCombo = 1;
        this.lastHitTime = 0;
        this.currentWeaponId = 'minigun';

        // Состояние
        this.isEnabled = localStorage.getItem('ganjacraft_shooter_enabled') !== 'false';
        this.isGameLaunching = false;
        this.isActive = false;
        this.isLogModalOpen = false;

        this.shakeIntensity = 0;

        // UI элементы
        this.crosshairElem = null;
        this.hotbarElem = null;
        this.topControlsElem = null;

        // Привязка обработчиков
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.render = this.render.bind(this);
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

    init() {
        this.ensureCanvas();
        this.ensureCrosshair();
        this.ensureHotbarHUD();
        this.ensureTopControlsHUD();

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
            <div class="crosshair-bracket top"></div>
            <div class="crosshair-bracket bottom"></div>
            <div class="crosshair-bracket left"></div>
            <div class="crosshair-bracket right"></div>
        `;
        document.body.appendChild(crosshair);
        this.crosshairElem = crosshair;
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
        Object.keys(WEAPONS).forEach(key => {
            const w = WEAPONS[key];
            const isActive = w.id === this.currentWeaponId;

            const iconMarkup = w.isImg 
                ? `<img class="weapon-slot-img" src="${w.icon}" alt="${w.name}" />`
                : `<span class="weapon-slot-icon">${w.icon}</span>`;

            html += `
                <div class="weapon-slot ${isActive ? 'active' : ''}" 
                     data-weapon-id="${w.id}" 
                     title="${w.name} — ${w.desc}">
                    <span class="weapon-slot-key">${w.key}</span>
                    <div class="weapon-slot-icon-box">
                        ${iconMarkup}
                    </div>
                    <span class="weapon-slot-name">${w.name.split(' ')[0]}</span>
                    <span class="weapon-slot-ammo">∞</span>
                </div>
            `;
        });

        this.hotbarElem.innerHTML = html;

        this.hotbarElem.querySelectorAll('.weapon-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                e.stopPropagation();
                const wid = slot.getAttribute('data-weapon-id');
                if (WEAPONS[wid]) {
                    this.switchWeapon(wid);
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
            <div class="shooter-wave-badge shooter-score-badge">
                <span class="wave-icon">🎯</span>
                <span id="shooter-score-display">ОЧКИ: 0</span>
            </div>
            <div class="shooter-ammo-badge shooter-combo-badge" id="shooter-combo-badge">
                <span class="ammo-icon">🔥</span>
                <span id="shooter-combo-display">СЕРИЯ x1</span>
            </div>
        `;

        document.body.appendChild(container);
        this.topControlsElem = container;
    }

    updateTopControlsView() {
        const scoreDisplay = dom.get('shooter-score-display');
        if (scoreDisplay) {
            scoreDisplay.innerText = `ОЧКИ: ${this.score.toLocaleString()}`;
        }

        const comboDisplay = dom.get('shooter-combo-display');
        const comboBadge = dom.get('shooter-combo-badge');
        if (comboDisplay) {
            comboDisplay.innerText = `СЕРИЯ x${this.combo}`;
        }
        if (comboBadge) {
            if (this.combo >= 5) {
                comboBadge.classList.add('is-reloading');
            } else {
                comboBadge.classList.remove('is-reloading');
            }
        }
    }

    switchWeapon(weaponId) {
        if (WEAPONS[weaponId]) {
            this.currentWeaponId = weaponId;
            taczAudio.playDryFire();
            this.updateHotbarView();
            this.attach3DGun();

            const w = WEAPONS[weaponId];
            this.spawnFloatingBanner(
                this.width / 2,
                this.height - 120,
                `🔫 ${w.name.toUpperCase()}`,
                '#38bdf8'
            );
        }
    }

    handleKeyDown(e) {
        if (!this.isGameLaunching || this.isLogModalOpen || !this.isEnabled) return;

        // Выбор оружия клавишами 1 (Миниган) и 2 (РПГ-7)
        if (e.key === '1' || e.key === '2') {
            const keys = Object.keys(WEAPONS);
            const index = parseInt(e.key, 10) - 1;
            if (keys[index]) {
                this.switchWeapon(keys[index]);
            }
        }
    }

    handleWheel(e) {
        if (!this.isGameLaunching || this.isLogModalOpen || !this.isEnabled) return;

        const keys = Object.keys(WEAPONS);
        const curIdx = keys.indexOf(this.currentWeaponId);
        if (curIdx === -1) return;

        let nextIdx = e.deltaY > 0 ? curIdx + 1 : curIdx - 1;
        if (nextIdx >= keys.length) nextIdx = 0;
        if (nextIdx < 0) nextIdx = keys.length - 1;

        this.switchWeapon(keys[nextIdx]);
    }

    attach3DGun() {
        if (!this.isGameLaunching || getSkinViewerMode() !== '3d') return;
        const viewer = getSkinViewer3d();
        if (!viewer || !viewer.playerObject || !viewer.playerObject.skin) {
            setTimeout(() => {
                if (this.isGameLaunching) this.attach3DGun();
            }, 250);
            return;
        }

        const taczGunId = this.currentWeaponId === 'rpg7' ? 'tacz_rpg7' : 'tacz_minigun';
        equipmentManager.setSlot('mainHand', taczGunId);
        equipmentManager.applyToViewer(viewer);

        const rightArm = viewer.playerObject.skin.rightArm;
        const leftArm = viewer.playerObject.skin.leftArm;
        if (rightArm) {
            if (this.currentWeaponId === 'rpg7') {
                rightArm.rotation.set(-Math.PI / 2.05, -0.20, 0.08);
            } else {
                rightArm.rotation.set(-0.95, -0.15, 0.08);
            }
        }
        if (leftArm) {
            if (this.currentWeaponId === 'rpg7') {
                leftArm.rotation.set(-Math.PI / 2.05, 0.70, -0.30);
            } else {
                leftArm.rotation.set(-1.25, 0.65, -0.30);
            }
        }
    }

    detach3DGun() {
        if (getSkinViewerMode() !== '3d') return;
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

        // Поворот 3D персонажа за мышкой
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
        if (e.target.closest('button, input, select, textarea, a, .launch-log-modal, .shooter-hotbar-container, .shooter-top-controls, .custom-modal, #title-bar')) return;

        this.mousePos.x = e.clientX;
        this.mousePos.y = e.clientY;
        this.isFiring = true;

        const now = performance.now();
        const weapon = this.getCurrentWeapon();
        const effCooldown = weapon.cooldown || 220;

        if (now - this.lastFireTime >= effCooldown) {
            this.fireCurrentWeapon(e.clientX, e.clientY);
            this.lastFireTime = now;
        }
    }

    handlePointerUp() {
        this.isFiring = false;
    }

    getCurrentWeapon() {
        return WEAPONS[this.currentWeaponId] || WEAPONS.minigun;
    }

    fireCurrentWeapon(targetX, targetY) {
        const weapon = this.getCurrentWeapon();

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

        // Пул пуль: если превысили лимит, удаляем старейшие
        if (this.bullets.length >= 70) {
            this.bullets.splice(0, 15);
        }

        const isCrit = Math.random() < 0.15;
        const finalDamage = Math.round(weapon.damage * (isCrit ? 2.0 : 1));

        if (weapon.id === 'rpg7') {
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
                weaponId: 'rpg7',
                distTravelled: 0,
                maxDist: window.innerWidth * 1.5,
                length: 32,
                width: 7,
                color: weapon.color
            });
            taczAudio.playShoot('rpg7');
            this.triggerScreenShake(4.5);
        } else {
            // Minigun - мощный поток трассеров с микро-разбросом
            const spread = (Math.random() - 0.5) * 0.08;
            const angle = aimAngle + spread;
            const spd = weapon.speed * (0.94 + Math.random() * 0.12);

            this.bullets.push({
                x: startX,
                y: startY,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                damage: finalDamage,
                isCrit,
                weaponId: 'minigun',
                distTravelled: 0,
                maxDist: dist + 200,
                length: 26,
                width: 3.5,
                color: isCrit ? '#ffffff' : weapon.color
            });
            taczAudio.playShoot('minigun');
            this.triggerScreenShake(0.8);
        }

        if (this.muzzleFlashes.length < 5) {
            this.muzzleFlashes.push({
                x: startX,
                y: startY,
                radius: weapon.id === 'rpg7' ? 34 : 22,
                life: 1,
                decay: 0.3,
                color: weapon.color
            });
        }

        this.triggerGunRecoil(weapon.id === 'rpg7' ? 1.3 : 0.6);
    }

    triggerScreenShake(intensity = 3) {
        this.shakeIntensity = Math.min(8, (this.shakeIntensity || 0) + intensity);
    }

    triggerGunRecoil(mult = 1) {
        if (getSkinViewerMode() !== '3d') return;
        try {
            const viewer = getSkinViewer3d();
            if (!viewer || !viewer.playerObject || !viewer.playerObject.skin) return;

            const rightArm = viewer.playerObject.skin.rightArm;
            if (rightArm) {
                rightArm.rotation.x = Math.max(-2.4, Math.min(-0.8, rightArm.rotation.x + 0.12 * mult));
            }
        } catch (_) {}
    }

    startTargetSpawner(intervalMs = 900) {
        if (this.targetSpawnTimer) clearInterval(this.targetSpawnTimer);

        this.targetSpawnTimer = setInterval(() => {
            if (this.isGameLaunching && !this.isLogModalOpen) {
                if (this.targets.length < 8) {
                    this.spawnTarget();
                }
            }
        }, intervalMs);
    }

    spawnTarget() {
        if (!this.isGameLaunching) return;

        const mobPool = ['zombie', 'creeper', 'spider', 'skeleton', 'tnt', 'lucky_block'];
        const type = mobPool[Math.floor(Math.random() * mobPool.length)];

        // Появление мишеней в случайных местах экрана на безопасном расстоянии от центра
        const padding = 100;
        let x, y, distToCenter;
        let attempts = 0;

        do {
            x = padding + Math.random() * (this.width - padding * 2);
            y = 80 + Math.random() * (this.height - 220);
            const dx = x - this.width / 2;
            const dy = y - this.height / 2;
            distToCenter = Math.sqrt(dx * dx + dy * dy);
            attempts++;
        } while (distToCenter < 140 && attempts < 10);

        let hp = 30;
        let width = 48;
        let height = 48;
        let lifetime = 6000; // Мишень плавно исчезает через 6с, если в нее не стрелять

        if (type === 'zombie') {
            hp = 35;
        } else if (type === 'creeper') {
            hp = 25;
        } else if (type === 'spider') {
            hp = 20;
            width = 44;
            height = 36;
        } else if (type === 'skeleton') {
            hp = 25;
        } else if (type === 'tnt') {
            hp = 15;
            lifetime = 8000;
        } else if (type === 'lucky_block') {
            hp = 40;
            lifetime = 5000;
        }

        this.targets.push({
            type,
            x,
            y,
            baseX: x,
            baseY: y,
            driftVx: (Math.random() - 0.5) * 1.2,
            driftVy: (Math.random() - 0.5) * 1.2,
            width,
            height,
            alive: true,
            hp,
            maxHp: hp,
            wobble: Math.random() * Math.PI * 2,
            scale: 0.1, // Эффект появления
            createdAt: performance.now(),
            lifetime
        });
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

            this.score = 0;
            this.kills = 0;
            this.combo = 1;
            this.maxCombo = 1;

            this.startTargetSpawner(900);

            if (this.crosshairElem) this.crosshairElem.classList.remove('hidden');
            if (this.hotbarElem) this.hotbarElem.classList.remove('hidden');
            if (this.topControlsElem) this.topControlsElem.classList.remove('hidden');

            this.updateHotbarView();
            this.updateTopControlsView();

            // Спавним 3 начальные мишени
            this.spawnTarget();
            this.spawnTarget();
            this.spawnTarget();

            this.startLoop();
        } else {
            document.body.classList.remove('is-shooter-active');
            if (is3d) {
                setTopDownShooterCamera(false);
                this.detach3DGun();
            }
            this.stopLoop();
            if (this.targetSpawnTimer) {
                clearInterval(this.targetSpawnTimer);
                this.targetSpawnTimer = null;
            }
            this.targets = [];
            this.bullets = [];
            this.explosions = [];
            this.muzzleFlashes = [];
            this.damageNumbers = [];

            if (this.crosshairElem) this.crosshairElem.classList.add('hidden');
            if (this.hotbarElem) this.hotbarElem.classList.add('hidden');
            if (this.topControlsElem) this.topControlsElem.classList.add('hidden');

            if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
        }
    }

    setLogModalOpen(isOpen) {
        this.isLogModalOpen = isOpen;
        if (isOpen) {
            this.isFiring = false;
            if (this.canvas) this.canvas.style.display = 'none';
            if (this.crosshairElem) this.crosshairElem.classList.add('hidden');
            if (this.hotbarElem) this.hotbarElem.classList.add('hidden');
            if (this.topControlsElem) this.topControlsElem.classList.add('hidden');
        } else {
            if (this.canvas) this.canvas.style.display = 'block';
            if (this.isGameLaunching && this.isEnabled) {
                if (this.crosshairElem) this.crosshairElem.classList.remove('hidden');
                if (this.hotbarElem) this.hotbarElem.classList.remove('hidden');
                if (this.topControlsElem) this.topControlsElem.classList.remove('hidden');
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
                    this.shakeIntensity *= 0.84;
                } else {
                    this.shakeIntensity = 0;
                }

                // 1. Автострельба
                this.processAutoFire();

                // 2. Мишени
                this.updateAndDrawTargets();

                // 3. Снаряды
                this.updateAndDrawBullets();

                // 4. Вспышки и взрывы
                this.updateAndDrawMuzzleFlashes();
                this.updateAndDrawExplosions();

                // 5. Всплывающий урон и баннеры комбо
                this.updateAndDrawDamageNumbers();

                if (hasShake) {
                    this.ctx.restore();
                }

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

    processAutoFire() {
        if (this.isFiring) {
            const now = performance.now();
            const weapon = this.getCurrentWeapon();
            const effCooldown = weapon.cooldown || 220;

            if (now - this.lastFireTime >= effCooldown) {
                this.fireCurrentWeapon(this.mousePos.x, this.mousePos.y);
                this.lastFireTime = now;
            }
        }
    }

    updateAndDrawTargets() {
        const now = performance.now();

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];

            // Плавное появление
            if (t.scale < 1) {
                t.scale = Math.min(1, t.scale + 0.08);
            }

            // Плавное покачивание и дрейф
            t.wobble += 0.03;
            t.x = t.baseX + Math.sin(t.wobble) * 20 + (now - t.createdAt) * 0.001 * t.driftVx * 10;
            t.y = t.baseY + Math.cos(t.wobble * 0.8) * 15 + (now - t.createdAt) * 0.001 * t.driftVy * 10;

            // Время жизни (если не сбили — плавно улетает и исчезает)
            const age = now - t.createdAt;
            if (age > t.lifetime) {
                t.scale -= 0.04;
                if (t.scale <= 0) {
                    this.targets.splice(i, 1);
                    // Сброс комбо при пропуске мишени
                    if (this.combo > 1) {
                        this.combo = 1;
                        this.updateTopControlsView();
                    }
                    continue;
                }
            }

            this.drawTargetShape(t);
        }
    }

    drawTargetShape(t) {
        this.ctx.save();
        this.ctx.translate(t.x, t.y);
        this.ctx.scale(t.scale, t.scale);

        const halfW = t.width / 2;
        const halfH = t.height / 2;

        // Внешнее неоновое кольцо мишени
        this.ctx.strokeStyle = t.type === 'lucky_block' ? '#facc15' : (t.type === 'tnt' ? '#ef4444' : '#39ff14');
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.6 + Math.sin(t.wobble * 2) * 0.3;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, halfW + 8, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.globalAlpha = 1.0;

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
            this.ctx.font = 'bold 22px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('?', 0, 7);
        }

        this.ctx.restore();
    }

    updateAndDrawBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            if (b.isHoming && this.targets.length > 0) {
                let closestTarget = null;
                let minDistSq = Infinity;
                for (let tIdx = 0; tIdx < this.targets.length; tIdx++) {
                    const t = this.targets[tIdx];
                    if (!t.alive) continue;
                    const tdx = t.x - b.x;
                    const tdy = t.y - b.y;
                    const distSq = tdx * tdx + tdy * tdy;
                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        closestTarget = t;
                    }
                }

                if (closestTarget) {
                    const tdx = closestTarget.x - b.x;
                    const tdy = closestTarget.y - b.y;
                    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
                    if (tdist > 0) {
                        b.vx += (tdx / tdist) * 2.2;
                        b.vy += (tdy / tdist) * 2.2;
                        const curSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                        b.vx = (b.vx / curSpd) * 22;
                        b.vy = (b.vy / curSpd) * 22;
                    }
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
        for (let j = this.targets.length - 1; j >= 0; j--) {
            const t = this.targets[j];
            if (!t.alive) continue;

            const dx = bullet.x - t.x;
            const dy = bullet.y - t.y;
            const distSq = dx * dx + dy * dy;
            const hitR = (t.width * t.scale) * 0.85;

            if (distSq < hitR * hitR) {
                t.hp -= bullet.damage;
                this.spawnDamageNumber(t.x, t.y, bullet.damage, bullet.isCrit, bullet.weaponId);

                if (bullet.weaponId === 'rpg7') {
                    this.triggerAoeBlast(bullet.x, bullet.y, bullet.aoeRadius || 140, bullet.damage);
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

    triggerAoeBlast(x, y, radius, dmg) {
        this.createExplosion(x, y, 'tnt');
        this.triggerScreenShake(6);

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            if (!t.alive) continue;

            const dx = t.x - x;
            const dy = t.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= radius) {
                t.hp -= Math.round(dmg * (1 - dist / radius));
                this.spawnDamageNumber(t.x, t.y, dmg, true, 'rpg7');

                if (t.hp <= 0) {
                    t.alive = false;
                    this.onTargetDestroyed(t);
                    this.targets.splice(i, 1);
                }
            }
        }
    }

    onTargetDestroyed(target) {
        this.kills++;
        this.lastHitTime = performance.now();

        // Увеличение серии комбо
        this.combo++;
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }

        // Очки с множителем комбо
        const baseScore = target.type === 'lucky_block' ? 500 : (target.type === 'tnt' ? 250 : 100);
        const earned = baseScore * Math.min(10, this.combo);
        this.score += earned;

        taczAudio.playKill();
        if (Math.random() > 0.4) taczAudio.playHeadHit();

        this.createExplosion(target.x, target.y, target.type);

        // Особые эффекты мишеней
        if (target.type === 'tnt') {
            // Взрыв TNT уничтожает соседние мишени
            audioSynth.playBassDrop();
            this.triggerAoeBlast(target.x, target.y, 220, 200);
            this.spawnFloatingBanner(target.x, target.y - 20, '💥 ЦЕПНОЙ ВЗРЫВ TNT!', '#ef4444');
        } else if (target.type === 'lucky_block') {
            audioSynth.playFanfare();
            this.spawnFloatingBanner(target.x, target.y - 20, `🎁 ДЖЕКПОТ +${earned}!`, '#facc15');
        }

        // Комбо поздравления
        if (this.combo === 5) {
            audioSynth.playFanfare();
            this.spawnFloatingBanner(this.width / 2, 160, '🔥 СЕРИЯ 5X! ОГОНЬ!', '#fbbf24');
        } else if (this.combo === 10) {
            audioSynth.playFanfare();
            this.spawnFloatingBanner(this.width / 2, 160, '⚡ СЕРИЯ 10X! НЕУДЕРЖИМЫЙ!', '#38bdf8');
        } else if (this.combo === 20) {
            audioSynth.playFanfare();
            this.spawnFloatingBanner(this.width / 2, 160, '👑 СЕРИЯ 20X! СТРЕЛОК-АС!', '#a855f7');
        }

        this.updateTopControlsView();
    }

    spawnFloatingBanner(x, y, text, color = '#fbbf24') {
        if (this.damageNumbers.length >= 25) {
            this.damageNumbers.shift();
        }
        this.damageNumbers.push({
            x,
            y,
            vy: -1.6,
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
            x: x + (Math.random() - 0.5) * 16,
            y: y + (Math.random() - 0.5) * 12,
            vy: -2.0,
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
                this.ctx.font = 'bold 16px "JetBrains Mono", monospace';
                this.ctx.fillStyle = d.color || '#fbbf24';
                this.ctx.fillText(d.text, d.x, d.y);
            } else {
                this.ctx.font = d.isCrit ? 'bold 18px monospace' : 'bold 14px monospace';
                let color = '#ffd700';
                if (d.isCrit) color = '#fbbf24';
                else if (d.weaponId === 'rpg7') color = '#f43f5e';

                this.ctx.fillStyle = color;
                this.ctx.fillText(`+${d.damage}${d.isCrit ? ' ⚡' : ''}`, d.x, d.y);
            }
        }
        this.ctx.globalAlpha = 1.0;
    }

    createExplosion(x, y, type) {
        if (this.explosions.length >= 80) {
            this.explosions.splice(0, 20);
        }
        const colors = type === 'creeper' 
            ? ['#16a34a', '#22c55e', '#052e16'] 
            : (type === 'tnt' ? ['#ef4444', '#f97316', '#ffffff'] : ['#eab308', '#fbbf24', '#38bdf8']);

        const count = type === 'tnt' ? 24 : (type === 'lucky_block' ? 20 : 12);
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
