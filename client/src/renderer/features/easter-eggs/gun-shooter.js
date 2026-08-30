/**
 * Ganj4Craft Launcher - Gun Shooter Mini-Game Engine
 * 3D Прицеливание персонажа, стрельба лазерами, отдача, летающие мишени и тир во время запуска
 */

import * as THREE from 'three';
import { getSkinViewer3d, getSkinViewerMode } from '../skin-viewer/skin-viewer.js';
import { audioSynth } from './audio-synth.js';
import { particlePopper } from './particle-pop.js';
import { dom } from '../../utils/dom.js';

class GunShooterEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
        this.animId = null;

        this.bullets = [];
        this.targets = [];
        this.explosions = [];
        this.muzzleFlashes = [];

        this.gunMesh = null;
        this.muzzleMesh = null;
        this.isGunAttached = false;

        this.mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.targetSpawnTimer = null;
        this.score = 0;
        this.kills = 0;
        this.isGameLaunching = false;
        this.isActive = false;

        this.crosshairElem = null;
        this.hudElem = null;

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.render = this.render.bind(this);
    }

    /**
     * Инициализация холста и слушателей
     */
    init() {
        this.ensureCanvas();
        this.ensureCrosshair();
        this.ensureHUD();

        window.addEventListener('resize', this.handleResize, { passive: true });
        window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
        document.addEventListener('pointerdown', this.handleClick, { passive: false });

        this.startLoop();
    }

    /**
     * Создать холст для снарядов и мишеней
     */
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
     * Создать кастомный кибер-прицел
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
     * Обеспечить HUD плашку тира (интегрирована в прогресс-бар)
     */
    ensureHUD() {
        // Счётчик фрагов интегрирован в нижний Cyber Bar (#gun-kills-count)
    }

    /**
     * Прикрепить 3D кибер-бластер к правой руке скина
     */
    attach3DGun() {
        const viewer = getSkinViewer3d();
        if (!viewer || !viewer.playerObject || !viewer.playerObject.skin) {
            // Повторная попытка через 500ms если скин еще загружается
            setTimeout(() => this.attach3DGun(), 500);
            return;
        }

        const rightArm = viewer.playerObject.skin.rightArm;
        if (!rightArm || this.isGunAttached) return;

        // Создаем 3D модель кибер-бластера из вокселей Three.js
        const gunGroup = new THREE.Group();
        gunGroup.name = 'CyberBlaster';

        // 1. Рукоять (внутри кисти руки)
        const gripGeo = new THREE.BoxGeometry(1.6, 3.2, 2.0);
        const gripMat = new THREE.MeshBasicMaterial({ color: 0x111813 });
        const gripMesh = new THREE.Mesh(gripGeo, gripMat);
        gripMesh.position.set(0, -0.8, 0);
        gunGroup.add(gripMesh);

        // 2. Ствольная коробка / Корпус (матовый кибер-металл)
        const bodyGeo = new THREE.BoxGeometry(2.0, 2.4, 5.5);
        const bodyMat = new THREE.MeshBasicMaterial({ color: 0x1f2922 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(0, 1.2, 1.8);
        gunGroup.add(bodyMesh);

        // 3. Неоновый плазменный ствол (зеленый лазерный канал)
        const barrelGeo = new THREE.BoxGeometry(1.3, 1.3, 5.5);
        const barrelMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
        const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
        barrelMesh.position.set(0, 1.4, 6.5);
        gunGroup.add(barrelMesh);

        // 4. Оптический голографический прицел (сверху)
        const scopeGeo = new THREE.BoxGeometry(1.0, 1.0, 2.2);
        const scopeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const scopeMesh = new THREE.Mesh(scopeGeo, scopeMat);
        scopeMesh.position.set(0, 2.8, 0.8);
        gunGroup.add(scopeMesh);

        // 5. Светящийся кончик дула (Muzzle Emitter)
        const muzzleGeo = new THREE.BoxGeometry(1.6, 1.6, 0.9);
        const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xa6ff00 });
        const muzzleMesh = new THREE.Mesh(muzzleGeo, muzzleMat);
        muzzleMesh.position.set(0, 1.4, 9.4);
        gunGroup.add(muzzleMesh);

        // Позиционируем и ориентируем пушку строго вперед из кулака
        gunGroup.position.set(-0.1, -10.0, 0.4);
        gunGroup.rotation.set(Math.PI / 2, 0, 0);
        gunGroup.scale.set(0.75, 0.75, 0.75);

        rightArm.add(gunGroup);

        this.gunMesh = gunGroup;
        this.muzzleMesh = muzzleMesh;
        this.isGunAttached = true;

        // Поднимаем руку в боевую стойку
        rightArm.rotation.x = -Math.PI / 2;

        console.log('🔫 3D CyberBlaster armed for game launch!');
    }

    /**
     * Снять оружие и вернуть персонажа в спокойную позу
     */
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
                rightArm.position.set(0, 0, 0);
            }
            if (head) {
                head.rotation.set(0, 0, 0);
            }
            viewer.playerObject.rotation.y = -0.45;
        }
    }

    /**
     * Движение мыши — прицеливание всего тела, руки и головы 3D персонажа (только при запуске)
     */
    handleMouseMove(e) {
        if (!this.isGameLaunching) {
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

        // 1. Поворот ВСЕГО ТЕЛА персонажа в сторону прицеливания
        const targetBodyRotY = -0.45 + Math.max(-0.6, Math.min(0.65, deltaX * 0.75));
        viewer.playerObject.rotation.y += (targetBodyRotY - viewer.playerObject.rotation.y) * 0.18;

        const rightArm = viewer.playerObject.skin.rightArm;
        const head = viewer.playerObject.skin.head;

        // 2. Прицеливание руки с пушкой
        if (rightArm) {
            const targetRotX = -Math.PI / 2 + Math.max(-0.6, Math.min(0.6, deltaY * 0.75));
            const targetRotY = Math.max(-0.4, Math.min(0.4, deltaX * 0.45));
            const targetRotZ = Math.max(-0.2, Math.min(0.2, deltaY * 0.3));

            rightArm.rotation.x += (targetRotX - rightArm.rotation.x) * 0.25;
            rightArm.rotation.y += (targetRotY - rightArm.rotation.y) * 0.25;
            rightArm.rotation.z += (targetRotZ - rightArm.rotation.z) * 0.25;
        }

        // 3. Поворот головы к цели
        if (head) {
            const headRotY = Math.max(-0.6, Math.min(0.6, deltaX * 0.6));
            const headRotX = Math.max(-0.4, Math.min(0.4, deltaY * 0.5));
            head.rotation.y += (headRotY - head.rotation.y) * 0.2;
            head.rotation.x += (headRotX - head.rotation.x) * 0.2;
        }
    }

    /**
     * Обработка клика — ВЫСТРЕЛ ИЗ БЛАСТЕРА (только при запуске)
     */
    handleClick(e) {
        if (!this.isGameLaunching) return;

        // Пропускаем клики по интерактивным элементам форм
        const tag = e.target.tagName;
        if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(tag)) return;
        if (e.target.closest('button, input, select, textarea, a, .interactive-card, .pseudo-console-window, .custom-modal, .webcam-window-frame')) return;

        this.fireShot(e.clientX, e.clientY);
    }

    /**
     * Произвести выстрел по координатам (targetX, targetY)
     */
    fireShot(targetX, targetY) {
        // Определяем точку вылета (ствол пушки)
        const skinCanvas = dom.get('skin-canvas-3d');
        let startX = 140;
        let startY = 220;

        if (skinCanvas) {
            const rect = skinCanvas.getBoundingClientRect();
            startX = rect.left + rect.width * 0.62;
            startY = rect.top + rect.height * 0.42;
        }

        // Вектор направления
        const dx = targetX - startX;
        const dy = targetY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const speed = 26; // Скорость снаряда (px per frame)
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;

        // Создаем плазменный снаряд
        this.bullets.push({
            x: startX,
            y: startY,
            vx,
            vy,
            targetX,
            targetY,
            distTravelled: 0,
            maxDist: dist + 60,
            length: 32,
            width: 4,
            life: 1,
            color: Math.random() > 0.3 ? '#39ff14' : '#00ffff'
        });

        // Создаем вспышку у дула
        this.muzzleFlashes.push({
            x: startX,
            y: startY,
            radius: 20,
            maxRadius: 28,
            life: 1,
            decay: 0.25
        });

        // Отдача руки 3D персонажа (Recoil Kick)
        this.triggerGunRecoil();

        // Звук выстрела
        audioSynth.playLaserShot();
    }

    /**
     * Анимация отдачи оружия (Recoil)
     */
    triggerGunRecoil() {
        const viewer = getSkinViewer3d();
        if (!viewer || !viewer.playerObject) return;

        const rightArm = viewer.playerObject.skin.rightArm;
        if (rightArm) {
            rightArm.rotation.x += 0.3; // Отдача вверх
            rightArm.position.z -= 3.5; // Отдача назад

            setTimeout(() => {
                if (rightArm) {
                    rightArm.position.z = 0;
                }
            }, 100);
        }
    }

    /**
     * Спавн летающих мишеней (Криперы, Дроны, Бочки)
     */
    startTargetSpawner(intervalMs = 1500) {
        if (this.targetSpawnTimer) clearInterval(this.targetSpawnTimer);

        this.targetSpawnTimer = setInterval(() => {
            if (this.isGameLaunching && this.targets.length < 6) {
                this.spawnTarget();
            }
        }, intervalMs);
    }

    spawnTarget() {
        if (!this.isGameLaunching) return;

        const types = ['creeper', 'drone', 'tnt', 'lucky_block'];
        const type = types[Math.floor(Math.random() * types.length)];

        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? -50 : this.width + 50;
        const targetX = fromLeft ? this.width + 80 : -80;
        const y = 80 + Math.random() * (this.height - 220);

        const speed = (fromLeft ? 1 : -1) * (1.2 + Math.random() * 1.8);

        this.targets.push({
            type,
            x: startX,
            y,
            baseY: y,
            vx: speed,
            wobbleOffset: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.04 + Math.random() * 0.03,
            wobbleAmp: 18 + Math.random() * 15,
            width: 44,
            height: 44,
            alive: true,
            hp: 1,
            createdAt: performance.now()
        });
    }

    /**
     * Включение / отключение режима тира при запуске игры
     */
    setGameLaunchingMode(isLaunching) {
        this.isGameLaunching = isLaunching;
        this.isActive = isLaunching;

        if (isLaunching) {
            this.attach3DGun();
            this.startTargetSpawner(1500);
            if (this.hudElem) {
                this.hudElem.classList.remove('hidden');
            }
            if (this.crosshairElem) {
                this.crosshairElem.classList.remove('hidden');
            }
            // Сразу спавним цели для стрельбы во время ожидания
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
            if (this.hudElem) {
                this.hudElem.classList.add('hidden');
            }
            if (this.crosshairElem) {
                this.crosshairElem.classList.add('hidden');
            }
            if (this.ctx) {
                this.ctx.clearRect(0, 0, this.width, this.height);
            }
        }
    }

    /**
     * Главный цикл рендера (Canvas 2D)
     */
    startLoop() {
        if (this.animId) return;
        this.render();
    }

    render() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.width, this.height);

            // 1. Отрисовка и обновление мишеней
            this.updateAndDrawTargets();

            // 2. Отрисовка и обновление плазменных снарядов
            this.updateAndDrawBullets();

            // 3. Отрисовка дульных вспышек
            this.updateAndDrawMuzzleFlashes();

            // 4. Отрисовка взрывов и частиц
            this.updateAndDrawExplosions();
        }

        this.animId = requestAnimationFrame(this.render);
    }

    /**
     * Отрисовка летящих плазменных снарядов
     */
    updateAndDrawBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            b.x += b.vx;
            b.y += b.vy;
            b.distTravelled += Math.sqrt(b.vx * b.vx + b.vy * b.vy);

            // Отрисовка лазерного трассера
            const tailX = b.x - (b.vx / 26) * b.length;
            const tailY = b.y - (b.vy / 26) * b.length;

            this.ctx.save();
            this.ctx.shadowColor = b.color;
            this.ctx.shadowBlur = 14;

            // Внешний неоновый луч
            this.ctx.strokeStyle = b.color;
            this.ctx.lineWidth = b.width;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(b.x, b.y);
            this.ctx.stroke();

            // Белое ядро луча
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = b.width * 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(b.x, b.y);
            this.ctx.stroke();

            this.ctx.restore();

            // Проверка попадания в мишени
            this.checkBulletCollisions(b, i);

            // Удаление при выходе за экран или превышении дистанции
            if (b.distTravelled >= b.maxDist || b.x < -50 || b.x > this.width + 50 || b.y < -50 || b.y > this.height + 50) {
                this.bullets.splice(i, 1);
            }
        }
    }

    /**
     * Проверка попадания снаряда в мишени
     */
    checkBulletCollisions(bullet, bulletIndex) {
        for (let j = this.targets.length - 1; j >= 0; j--) {
            const t = this.targets[j];
            if (!t.alive) continue;

            const dx = bullet.x - t.x;
            const dy = bullet.y - t.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < t.width * 0.75) {
                // ПОПАДАНИЕ!
                t.alive = false;
                this.bullets.splice(bulletIndex, 1);

                this.onTargetDestroyed(t);
                this.targets.splice(j, 1);
                break;
            }
        }
    }

    /**
     * Обработка уничтожения мишени
     */
    onTargetDestroyed(target) {
        this.kills++;
        this.score += 100;

        // Звуки попадания и крита
        audioSynth.playTargetHit();
        if (Math.random() > 0.5) {
            audioSynth.playHeadshot();
        }

        // Создаем взрыв вокселей
        this.createExplosion(target.x, target.y, target.type);

        // Всплывающий текст
        const texts = ['💥 HEADSHOT!', '🔥 +100', '⚡ CRIT! 420', '🎯 BOOM!'];
        const text = texts[Math.floor(Math.random() * texts.length)];
        particlePopper.spawnFloatingScore(target.x, target.y, text);

        // Обновляем HUD
        const killsCountElem = dom.get('gun-kills-count');
        if (killsCountElem) {
            killsCountElem.innerText = this.kills;
        }

        // Пополняем урожайный комбо-счетчик
        particlePopper.registerHit(target.x, target.y);
    }

    /**
     * Отрисовка и физика мишеней
     */
    updateAndDrawTargets() {
        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];

            t.x += t.vx;
            t.wobbleOffset += t.wobbleSpeed;
            t.y = t.baseY + Math.sin(t.wobbleOffset) * t.wobbleAmp;

            this.drawTargetShape(t);

            // Удаление при выходе за пределы экрана
            if ((t.vx > 0 && t.x > this.width + 100) || (t.vx < 0 && t.x < -100)) {
                this.targets.splice(i, 1);
            }
        }
    }

    /**
     * Отрисовка спрайтов мишеней (Pixel Art)
     */
    drawTargetShape(t) {
        this.ctx.save();
        this.ctx.translate(t.x, t.y);

        const half = t.width / 2;

        if (t.type === 'creeper') {
            // Пиксельный крипер-дрон
            this.ctx.fillStyle = '#22c55e';
            this.ctx.shadowColor = '#22c55e';
            this.ctx.shadowBlur = 10;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            // Лицо крипера
            this.ctx.fillStyle = '#0f172a';
            const s = t.width / 8;
            // Глаза
            this.ctx.fillRect(-half + s, -half + s * 2, s * 2, s * 2);
            this.ctx.fillRect(half - s * 3, -half + s * 2, s * 2, s * 2);
            // Рот
            this.ctx.fillRect(-half + s * 3, -half + s * 3, s * 2, s * 3);
            this.ctx.fillRect(-half + s * 2, -half + s * 4, s * 4, s * 3);
            this.ctx.fillRect(-half + s * 2, -half + s * 6, s, s * 2);
            this.ctx.fillRect(half - s * 3, -half + s * 6, s, s * 2);

            // Маленький пропеллер сверху
            this.ctx.fillStyle = '#38bdf8';
            this.ctx.fillRect(-12, -half - 6, 24, 3);
        } else if (t.type === 'tnt') {
            // Блок TNT
            this.ctx.fillStyle = '#ef4444';
            this.ctx.shadowColor = '#ef4444';
            this.ctx.shadowBlur = 12;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            this.ctx.fillStyle = '#f8fafc';
            this.ctx.fillRect(-half, -6, t.width, 12);

            this.ctx.fillStyle = '#0f172a';
            this.ctx.font = 'bold 9px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('TNT', 0, 3);
        } else if (t.type === 'lucky_block') {
            // Лаки-блок
            this.ctx.fillStyle = '#eab308';
            this.ctx.shadowColor = '#eab308';
            this.ctx.shadowBlur = 12;
            this.ctx.fillRect(-half, -half, t.width, t.height);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 18px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('?', 0, 6);
        } else {
            // Ganja Drone
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

    /**
     * Создание взрыва при уничтожении мишени
     */
    createExplosion(x, y, type) {
        const count = 16;
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

    /**
     * Отрисовка взрывов и осколков
     */
    updateAndDrawExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const p = this.explosions[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15; // Гравитация
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

    /**
     * Отрисовка вспышки у дула
     */
    updateAndDrawMuzzleFlashes() {
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const m = this.muzzleFlashes[i];
            m.life -= m.decay;

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, m.life);
            this.ctx.fillStyle = '#a6ff00';
            this.ctx.shadowColor = '#39ff14';
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
