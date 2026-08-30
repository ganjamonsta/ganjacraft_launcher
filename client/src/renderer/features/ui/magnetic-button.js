/**
 * Ganj4Craft Launcher - Smooth Magnetic Button Physics
 * Плавное премиальное притяжение круглой кнопки запуска к курсору без тряски
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
let animId = null;

/**
 * Инициализация магнитной физики для круглой кнопки Play
 */
export function initMagneticPlayButton() {
    const playBtn = dom.get('play-btn');
    if (!playBtn || isInitialized) return;
    isInitialized = true;

    const ATTRACTION_RADIUS = 100; // Радиус притяжения в пикселях
    const MAX_DISPLACEMENT = 8;    // Максимальное мягкое смещение кнопки

    function onMouseMove(e) {
        // Вычисляем центр родительского контейнера
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

            // Мягкий 3D наклон
            const rotX = (distY / ATTRACTION_RADIUS) * -6;
            const rotY = (distX / ATTRACTION_RADIUS) * 6;
            playBtn.style.setProperty('--rot-x', `${rotX.toFixed(2)}deg`);
            playBtn.style.setProperty('--rot-y', `${rotY.toFixed(2)}deg`);
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
        isMouseDown = false;
        targetX = 0;
        targetY = 0;
        playBtn.style.setProperty('--rot-x', '0deg');
        playBtn.style.setProperty('--rot-y', '0deg');
        playBtn.classList.remove('magnetic-active');
    }

    function animate() {
        // Плавная интерполяция магнитной позиции
        const lerp = isHovered ? 0.2 : 0.12;
        currentX += (targetX - currentX) * lerp;
        currentY += (targetY - currentY) * lerp;

        if (Math.abs(currentX) > 0.01 || Math.abs(currentY) > 0.01 || isHovered) {
            const scale = isMouseDown ? 0.94 : (isHovered ? 1.05 : 1.0);
            playBtn.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0) rotateX(var(--rot-x, 0deg)) rotateY(var(--rot-y, 0deg)) scale(${scale.toFixed(3)})`;
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
