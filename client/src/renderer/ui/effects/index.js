/**
 * GanjaCraft Launcher - Visual Effects Index
 * Единая точка управления визуальными эффектами
 */

import { effectsEngine } from './effects-engine.js';
import { appState } from '../../state/app-state.js';

export { effectsEngine } from './effects-engine.js';

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
 * Применить конфигурацию визуальных эффектов
 * @param {Object} config 
 */
export function applyEffectsConfig(config) {
    // Determine preset: if legacy enableSnow === false, set to 'off'
    let preset = config.effectsPreset || 'auto';
    if (config.enableSnow === false && (!config.effectsPreset || config.effectsPreset === 'snow')) {
        preset = 'off';
    }

    const density = config.effectsDensity || 'low';
    const enabled = preset !== 'off';

    effectsEngine.configure({ preset, density, enabled });

    // Update app state
    appState.set('effects.preset', preset);
    appState.set('effects.density', density);
    appState.set('effects.snowEnabled', enabled);
}

/**
 * Инициализация всех визуальных эффектов
 * @param {Object} config - конфигурация лаунчера
 */
export async function initAllEffects(config) {
    const { startSmokeEffect, initSmokeMouseTracking } = await import('./smoke.js');
    const { initParallax, stopParallax } = await import('./parallax.js');
    
    // Mouse tracking for smoke
    initSmokeMouseTracking();
    
    // Parallax
    initParallax();
    if (config.enableParallax === false) {
        stopParallax();
    }
    
    // Smoke
    if (config.enableSmoke !== false) {
        startSmokeEffect();
    }

    // Universal particle engine setup
    applyEffectsConfig(config);

    // Auto pause/resume when window visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            effectsEngine.stop();
        } else {
            const currentPreset = appState.get('effects.preset') || config.effectsPreset || 'auto';
            if (currentPreset !== 'off') {
                effectsEngine.start();
            }
        }
    });
}
