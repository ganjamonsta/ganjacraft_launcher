/**
 * GanjaCraft Launcher - Smoke Effect
 * Визуальный эффект дыма от курсора (оптимизировано)
 */

import { appState } from '../../state/app-state.js';
import { throttle } from '../../utils/performance.js';

let smokeInterval = null;
let mouseX = 0;
let mouseY = 0;
let hasMouseMoved = false;

/**
 * Создать частицу дыма
 */
function createSmokeParticle(x, y) {
    const particle = document.createElement('div');
    particle.classList.add('smoke-particle');
    
    // Randomize drift
    const driftX = (Math.random() - 0.5) * 30 + 'px';
    particle.style.setProperty('--tx', driftX);
    
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    
    document.body.appendChild(particle);
    
    particle.addEventListener('animationend', () => {
        particle.remove();
    });
}

/**
 * Запустить эффект дыма
 */
export function startSmokeEffect() {
    if (smokeInterval) return;
    
    smokeInterval = setInterval(() => {
        if (hasMouseMoved) {
            createSmokeParticle(mouseX, mouseY);
        }
    }, 50);
    
    appState.set('effects.smokeEnabled', true);
}

/**
 * Остановить эффект дыма
 */
export function stopSmokeEffect() {
    if (smokeInterval) {
        clearInterval(smokeInterval);
        smokeInterval = null;
    }
    
    appState.set('effects.smokeEnabled', false);
}

/**
 * Обработчик движения мыши (throttled для оптимизации)
 */
const handleMouseMove = throttle((e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    hasMouseMoved = true;
}, 16); // ~60fps

/**
 * Инициализация отслеживания мыши
 */
export function initSmokeMouseTracking() {
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
}

/**
 * Получить текущие координаты мыши
 */
export function getMousePosition() {
    return { x: mouseX, y: mouseY };
}
