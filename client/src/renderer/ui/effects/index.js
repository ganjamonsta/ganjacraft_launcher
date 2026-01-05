/**
 * GanjaCraft Launcher - Visual Effects Index
 * Реэкспорт всех визуальных эффектов
 */

export { 
    toggleSnow, 
    createSnowBurst, 
    createDirectionalBurst, 
    createSideBurst,
    initSnowVisibilityHandler 
} from './snow.js';

export { 
    startSmokeEffect, 
    stopSmokeEffect, 
    initSmokeMouseTracking,
    getMousePosition 
} from './smoke.js';

export { 
    startParallax, 
    stopParallax, 
    initParallax, 
    destroyParallax 
} from './parallax.js';

export { initEasterEgg, destroyEasterEgg, isEasterEggActive } from './easter-egg.js';

/**
 * Инициализация всех визуальных эффектов
 * @param {Object} config - конфигурация лаунчера
 */
export async function initAllEffects(config) {
    const { toggleSnow, initSnowVisibilityHandler } = await import('./snow.js');
    const { startSmokeEffect, initSmokeMouseTracking } = await import('./smoke.js');
    const { initParallax, stopParallax } = await import('./parallax.js');
    
    // Initialize mouse tracking
    initSmokeMouseTracking();
    
    // Initialize parallax
    initParallax();
    
    // Initialize snow visibility handler
    initSnowVisibilityHandler();
    
    // Apply config
    toggleSnow(config.enableSnow !== false);
    
    if (config.enableSmoke !== false) {
        startSmokeEffect();
    }
    
    if (config.enableParallax === false) {
        stopParallax();
    }
}
