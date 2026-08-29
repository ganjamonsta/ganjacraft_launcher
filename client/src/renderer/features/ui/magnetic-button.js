/**
 * GanjaCraft Launcher - Magnetic Button Physics
 * Плавное притяжение кнопки «ИГРАТЬ» к курсору и сочные эффекты
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
let animId = null;

/**
 * Инициализация магнитной физики для кнопки Play
 */
export function initMagneticPlayButton() {
    const playBtn = dom.get('play-btn');
    if (!playBtn || isInitialized) return;
    isInitialized = true;

    const ATTRACTION_RADIUS = 140; // Радиус притяжения в пикселях
    const MAX_DISPLACEMENT = 22;   // Максимальное смещение в пикселях

    function onMouseMove(e) {
        const rect = playBtn.getBoundingClientRect();
        const btnCenterX = rect.left + rect.width / 2;
        const btnCenterY = rect.top + rect.height / 2;

        const distX = e.clientX - btnCenterX;
        const distY = e.clientY - btnCenterY;
        const distance = Math.hypot(distX, distY);

        if (distance < ATTRACTION_RADIUS) {
            isHovered = true;
            const factor = Math.pow(1 - distance / ATTRACTION_RADIUS, 1.2);
            targetX = (distX / distance) * MAX_DISPLACEMENT * factor;
            targetY = (distY / distance) * MAX_DISPLACEMENT * factor;
            
            // Динамический угол наклона
            const rotX = (distY / ATTRACTION_RADIUS) * -8;
            const rotY = (distX / ATTRACTION_RADIUS) * 8;
            playBtn.style.setProperty('--rot-x', `${rotX}deg`);
            playBtn.style.setProperty('--rot-y', `${rotY}deg`);
            playBtn.classList.add('magnetic-active');
        } else {
            isHovered = false;
            targetX = 0;
            targetY = 0;
            playBtn.style.setProperty('--rot-x', '0deg');
            playBtn.style.setProperty('--rot-y', '0deg');
            playBtn.classList.remove('magnetic-active');
        }
    }

    function onMouseLeave() {
        isHovered = false;
        targetX = 0;
        targetY = 0;
        playBtn.style.setProperty('--rot-x', '0deg');
        playBtn.style.setProperty('--rot-y', '0deg');
        playBtn.classList.remove('magnetic-active');
    }

    function animate() {
        // Плавная интерполяция (Spring damping)
        const lerp = isHovered ? 0.18 : 0.12;
        currentX += (targetX - currentX) * lerp;
        currentY += (targetY - currentY) * lerp;

        if (Math.abs(currentX) > 0.01 || Math.abs(currentY) > 0.01 || isHovered) {
            playBtn.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0) rotateX(var(--rot-x, 0deg)) rotateY(var(--rot-y, 0deg))`;
        } else {
            playBtn.style.transform = '';
        }

        animId = requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    // Добавляем частицы при нажатии
    playBtn.addEventListener('click', () => {
        if (appState.get('effects.snowEnabled')) {
            createSnowBurst();
        }
    });

    animate();
}
