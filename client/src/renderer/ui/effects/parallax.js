/**
 * GanjaCraft Launcher - Parallax Effect
 * Эффект параллакса фона (оптимизировано)
 */

import { appState } from '../../state/app-state.js';
import { rafThrottle } from '../../utils/performance.js';

let parallaxTargetX = 0;
let parallaxTargetY = 0;
let parallaxCurrentX = 0;
let parallaxCurrentY = 0;
let parallaxAnimId = null;
let isWindowVisible = true;

/**
 * Анимационный цикл для плавного параллакса
 */
// Кеш для bg-overlay элемента
let cachedBgOverlay = null;

function animateParallax() {
    if (isWindowVisible && appState.get('effects.parallaxEnabled')) {
        // Кешируем bg-overlay reference
        if (!cachedBgOverlay) {
            cachedBgOverlay = document.getElementById('bg-overlay');
        }
        
        if (cachedBgOverlay) {
            // Linear Interpolation (Lerp) for smoothness
            parallaxCurrentX += (parallaxTargetX - parallaxCurrentX) * 0.05;
            parallaxCurrentY += (parallaxTargetY - parallaxCurrentY) * 0.05;
            
            // Используем translate3d для GPU ускорения
            cachedBgOverlay.style.transform = `translate3d(${parallaxCurrentX.toFixed(2)}px, ${parallaxCurrentY.toFixed(2)}px, 0)`;
        }
    }
    parallaxAnimId = requestAnimationFrame(animateParallax);
}

/**
 * Обработчик движения мыши для параллакса
 * Оптимизирован через rafThrottle для синхронизации с refresh rate
 */
const handleMouseMove = rafThrottle((e) => {
    if (!appState.get('effects.parallaxEnabled')) return;
    
    // Кешируем main-content reference
    if (!cachedMainContent) {
        cachedMainContent = document.getElementById('main-content');
    }
    
    const rect = cachedMainContent ? cachedMainContent.getBoundingClientRect() : null;
    const centerX = rect ? (rect.left + rect.width / 2) : (window.innerWidth / 2);
    const centerY = rect ? (rect.top + rect.height / 2) : (window.innerHeight / 2);

    parallaxTargetX = (centerX - e.clientX) * 0.03;
    parallaxTargetY = (centerY - e.clientY) * 0.03;
});

// Кеш для main-content элемента
let cachedMainContent = null;

/**
 * Обработчик видимости окна
 */
function handleVisibilityChange() {
    isWindowVisible = !document.hidden;
}

/**
 * Запустить параллакс эффект
 */
export function startParallax() {
    if (!parallaxAnimId) {
        parallaxAnimId = requestAnimationFrame(animateParallax);
    }
    appState.set('effects.parallaxEnabled', true);
}

/**
 * Остановить параллакс и сбросить позицию
 */
export function stopParallax() {
    const bg = document.getElementById('bg-overlay');
    if (bg) {
        bg.style.transform = 'none';
    }
    
    parallaxTargetX = 0;
    parallaxTargetY = 0;
    parallaxCurrentX = 0;
    parallaxCurrentY = 0;
    
    appState.set('effects.parallaxEnabled', false);
}

/**
 * Инициализация параллакс эффекта
 */
export function initParallax() {
    // Passive listener для лучшей производительности скролла
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startParallax();
}

/**
 * Очистка (для cleanup)
 */
export function destroyParallax() {
    if (parallaxAnimId) {
        cancelAnimationFrame(parallaxAnimId);
        parallaxAnimId = null;
    }
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
}
