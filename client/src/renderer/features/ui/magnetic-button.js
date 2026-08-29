/**
 * Ganj4Craft Launcher - Magnetic Button Physics & Center Twitch
 * Плавное притяжение круглой кнопки запуска к курсору и энергичное дёргание в центре
 */

import { dom } from '../../utils/dom.js';
import { createSnowBurst } from '../../ui/effects/index.js';
import { appState } from '../../state/app-state.js';

let isInitialized = false;
let currentX = 0;
let currentY = 0;
let targetX = 0;
let targetY = 0;
let isHovered = false;
let isMouseDown = false;
let centerIntensity = 0;
let targetCenterIntensity = 0;
let animId = null;

/**
 * Инициализация магнитной физики для круглой кнопки Play
 */
export function initMagneticPlayButton() {
    const playBtn = dom.get('play-btn');
    if (!playBtn || isInitialized) return;
    isInitialized = true;

    const ATTRACTION_RADIUS = 130; // Радиус притяжения в пикселях
    const MAX_DISPLACEMENT = 16;   // Максимальное смещение кнопки
    const CENTER_RADIUS = 28;      // Зона центра, при входе в которую кнопка начинает дёргаться

    function onMouseMove(e) {
        // Вычисляем центр родительского контейнера (стабильная точка отсчета)
        const container = playBtn.parentElement;
        const rect = container ? container.getBoundingClientRect() : playBtn.getBoundingClientRect();
        const btnCenterX = rect.left + rect.width / 2;
        const btnCenterY = rect.top + rect.height / 2;

        const distX = e.clientX - btnCenterX;
        const distY = e.clientY - btnCenterY;
        const distance = Math.hypot(distX, distY);

        if (distance < ATTRACTION_RADIUS) {
            isHovered = true;
            const factor = Math.pow(1 - distance / ATTRACTION_RADIUS, 1.2);
            targetX = (distX / (distance || 1)) * MAX_DISPLACEMENT * factor;
            targetY = (distY / (distance || 1)) * MAX_DISPLACEMENT * factor;

            // Динамический угол наклона (3D tilt)
            const rotX = (distY / ATTRACTION_RADIUS) * -12;
            const rotY = (distX / ATTRACTION_RADIUS) * 12;
            playBtn.style.setProperty('--rot-x', `${rotX.toFixed(2)}deg`);
            playBtn.style.setProperty('--rot-y', `${rotY.toFixed(2)}deg`);
            playBtn.classList.add('magnetic-active');

            // Реакция на нахождение курсора в центре
            if (distance < CENTER_RADIUS) {
                targetCenterIntensity = Math.pow(1 - distance / CENTER_RADIUS, 0.7);
                playBtn.classList.add('play-btn-jittering');
            } else {
                targetCenterIntensity = 0;
                playBtn.classList.remove('play-btn-jittering');
            }
        } else {
            isHovered = false;
            targetCenterIntensity = 0;
            targetX = 0;
            targetY = 0;
            playBtn.style.setProperty('--rot-x', '0deg');
            playBtn.style.setProperty('--rot-y', '0deg');
            playBtn.classList.remove('magnetic-active');
            playBtn.classList.remove('play-btn-jittering');
        }
    }

    function onMouseLeave() {
        isHovered = false;
        isMouseDown = false;
        targetCenterIntensity = 0;
        targetX = 0;
        targetY = 0;
        playBtn.style.setProperty('--rot-x', '0deg');
        playBtn.style.setProperty('--rot-y', '0deg');
        playBtn.classList.remove('magnetic-active');
        playBtn.classList.remove('play-btn-jittering');
    }

    function animate() {
        // Плавная интерполяция магнитной позиции
        const lerp = isHovered ? 0.22 : 0.14;
        currentX += (targetX - currentX) * lerp;
        currentY += (targetY - currentY) * lerp;

        // Плавный переход интенсивности дёргания
        centerIntensity += (targetCenterIntensity - centerIntensity) * 0.3;

        let jitterX = 0;
        let jitterY = 0;
        let jitterRot = 0;
        let jitterScale = 1;

        if (centerIntensity > 0.01) {
            // Интенсивное высокочастотное дёргание/вибрация в центре
            const twitchMagnitude = centerIntensity * 4.5;
            const twitchAngle = Math.random() * Math.PI * 2;
            const twitchDist = (0.3 + Math.random() * 0.7) * twitchMagnitude;

            jitterX = Math.cos(twitchAngle) * twitchDist;
            jitterY = Math.sin(twitchAngle) * twitchDist;
            jitterRot = (Math.random() - 0.5) * 8 * centerIntensity;
            jitterScale = 1 + (Math.random() * 0.06 - 0.02) * centerIntensity;
        }

        if (Math.abs(currentX) > 0.01 || Math.abs(currentY) > 0.01 || isHovered || centerIntensity > 0.01) {
            const finalX = currentX + jitterX;
            const finalY = currentY + jitterY;
            const baseScale = isMouseDown ? 0.94 : (isHovered ? 1.06 : 1.0);
            const finalScale = baseScale * jitterScale;

            playBtn.style.transform = `translate3d(${finalX.toFixed(2)}px, ${finalY.toFixed(2)}px, 0) rotateX(var(--rot-x, 0deg)) rotateY(var(--rot-y, 0deg)) rotateZ(${jitterRot.toFixed(2)}deg) scale(${finalScale.toFixed(3)})`;
        } else {
            playBtn.style.transform = '';
        }

        animId = requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    playBtn.addEventListener('mousedown', () => {
        isMouseDown = true;
    });

    window.addEventListener('mouseup', () => {
        isMouseDown = false;
    });

    // Добавляем частицы при нажатии
    playBtn.addEventListener('click', () => {
        if (appState.get('effects.snowEnabled')) {
            createSnowBurst();
        }
    });

    animate();
}
