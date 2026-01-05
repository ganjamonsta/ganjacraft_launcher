/**
 * GanjaCraft Launcher - Snow Effect
 * Визуальный эффект снега с burst-эффектами (оптимизировано)
 */

import { appState } from '../../state/app-state.js';
import { 
    MAX_SNOWFLAKES, 
    SNOW_INTERVAL, 
    SNOW_BURST_COUNT, 
    DIRECTIONAL_BURST_COUNT, 
    SIDE_BURST_COUNT 
} from '../../constants.js';

let snowInterval = null;

// Кеш для контейнера снега
let cachedSnowContainer = null;

// Пул снежинок для переиспользования
const snowflakePool = [];
const POOL_SIZE = 50;

// Предварительные значения для animations
const FALL_ANIMATIONS = ['fall-1', 'fall-2', 'fall-3'];

/**
 * Получить снежинку из пула или создать новую
 */
function getSnowflake() {
    if (snowflakePool.length > 0) {
        return snowflakePool.pop();
    }
    
    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    snowflake.textContent = '❄';
    return snowflake;
}

/**
 * Вернуть снежинку в пул
 */
function recycleSnowflake(snowflake) {
    if (snowflakePool.length < POOL_SIZE) {
        snowflake.remove();
        // Сброс стилей
        snowflake.style.cssText = '';
        snowflake.classList.remove('burst');
        snowflakePool.push(snowflake);
    } else {
        snowflake.remove();
    }
}

/**
 * Создать снежинку (оптимизировано)
 */
function createSnowflake() {
    if (!cachedSnowContainer) {
        cachedSnowContainer = document.getElementById('snow-container');
    }
    if (!cachedSnowContainer) return;
    
    // Limit max snowflakes to prevent performance issues
    if (cachedSnowContainer.children.length > MAX_SNOWFLAKES) return;

    const snowflake = getSnowflake();
    
    // Randomize position, speed, opacity, size
    snowflake.style.left = Math.random() * 100 + 'vw';
    snowflake.style.animationDuration = Math.random() * 7 + 8 + 's'; 
    snowflake.style.opacity = Math.random() * 0.6 + 0.2;
    snowflake.style.fontSize = Math.random() * 10 + 8 + 'px';
    
    // Randomize Animation (Swaying)
    snowflake.style.animationName = FALL_ANIMATIONS[Math.floor(Math.random() * 3)];

    cachedSnowContainer.appendChild(snowflake);
    
    // Recycle after animation ends
    snowflake.addEventListener('animationend', function handler() {
        snowflake.removeEventListener('animationend', handler);
        recycleSnowflake(snowflake);
    });
}

/**
 * Включить/выключить снег
 * @param {boolean} enable 
 */
export function toggleSnow(enable) {
    if (!cachedSnowContainer) {
        cachedSnowContainer = document.getElementById('snow-container');
    }
    
    if (enable) {
        if (!snowInterval) {
            snowInterval = setInterval(createSnowflake, SNOW_INTERVAL);
            // Create initial batch
            for (let i = 0; i < 10; i++) {
                setTimeout(createSnowflake, i * 300);
            }
        }
    } else {
        if (snowInterval) {
            clearInterval(snowInterval);
            snowInterval = null;
        }
        if (cachedSnowContainer) {
            cachedSnowContainer.innerHTML = '';
        }
    }
    
    appState.set('effects.snowEnabled', enable);
}

/**
 * Burst effect - взрыв снега сверху (при открытии настроек)
 */
export function createSnowBurst() {
    const burstContainer = document.getElementById('snow-burst-container') || document.getElementById('snow-container');
    if (!burstContainer) return;
    
    for (let i = 0; i < SNOW_BURST_COUNT; i++) {
        setTimeout(() => {
            const snowflake = document.createElement('div');
            snowflake.classList.add('snowflake', 'burst');
            snowflake.textContent = '❄';
            
            // Старт по ВСЕЙ ширине окна
            const startX = 5 + Math.random() * 90;
            snowflake.style.left = startX + 'vw';
            snowflake.style.top = '-10px';
            
            // Направление разлёта
            const spreadX = (Math.random() - 0.5) * 200;
            const spreadY = 120 + Math.random() * 280;
            const rotation = (Math.random() - 0.5) * 360;
            
            snowflake.style.setProperty('--burst-x', spreadX + 'px');
            snowflake.style.setProperty('--burst-y', spreadY + 'px');
            snowflake.style.setProperty('--burst-rotate', rotation + 'deg');
            
            const duration = 0.7 + Math.random() * 1.0;
            snowflake.style.animationDuration = duration + 's';
            
            snowflake.style.opacity = 0.75 + Math.random() * 0.25;
            snowflake.style.fontSize = (14 + Math.random() * 16) + 'px';
            
            burstContainer.appendChild(snowflake);
            
            snowflake.addEventListener('animationend', () => {
                snowflake.remove();
            });
        }, i * 5);
    }
}

/**
 * Directional burst - взрыв при переключении табов
 * @param {'left' | 'right'} direction 
 */
export function createDirectionalBurst(direction) {
    const burstContainer = document.getElementById('snow-burst-container') || document.getElementById('snow-container');
    if (!burstContainer) return;
    
    for (let i = 0; i < DIRECTIONAL_BURST_COUNT; i++) {
        setTimeout(() => {
            const snowflake = document.createElement('div');
            snowflake.classList.add('snowflake', 'burst');
            snowflake.textContent = '❄';
            
            let startX, spreadX;
            const startY = 10 + Math.random() * 80;
            
            if (direction === 'right') {
                startX = 103 + Math.random() * 5;
                spreadX = -(280 + Math.random() * 320);
            } else {
                startX = -8 + Math.random() * 5;
                spreadX = 280 + Math.random() * 320;
            }
            
            snowflake.style.left = startX + 'vw';
            snowflake.style.top = startY + 'vh';
            
            const spreadY = 40 + Math.random() * 80;
            const rotation = (Math.random() - 0.5) * 360;
            
            snowflake.style.setProperty('--burst-x', spreadX + 'px');
            snowflake.style.setProperty('--burst-y', spreadY + 'px');
            snowflake.style.setProperty('--burst-rotate', rotation + 'deg');
            
            const duration = 0.8 + Math.random() * 0.6;
            snowflake.style.animationDuration = duration + 's';
            
            snowflake.style.opacity = 0.4 + Math.random() * 0.25;
            snowflake.style.fontSize = (12 + Math.random() * 12) + 'px';
            
            burstContainer.appendChild(snowflake);
            
            snowflake.addEventListener('animationend', () => {
                snowflake.remove();
            });
        }, i * 4);
    }
}

/**
 * Side burst - взрыв с боков
 * @param {'left' | 'right'} side 
 */
export function createSideBurst(side) {
    const burstContainer = document.getElementById('snow-burst-container') || document.getElementById('snow-container');
    if (!burstContainer) return;
    
    for (let i = 0; i < SIDE_BURST_COUNT; i++) {
        setTimeout(() => {
            const snowflake = document.createElement('div');
            snowflake.classList.add('snowflake', 'burst');
            snowflake.textContent = '❄';
            
            if (side === 'left') {
                snowflake.style.left = '-10px';
            } else {
                snowflake.style.left = 'calc(100vw + 10px)';
            }
            
            const startY = 10 + Math.random() * 80;
            snowflake.style.top = startY + 'vh';
            
            const spreadX = side === 'left' 
                ? 80 + Math.random() * 150
                : -(80 + Math.random() * 150);
            const spreadY = (Math.random() - 0.3) * 150;
            const rotation = (Math.random() - 0.5) * 360;
            
            snowflake.style.setProperty('--burst-x', spreadX + 'px');
            snowflake.style.setProperty('--burst-y', spreadY + 'px');
            snowflake.style.setProperty('--burst-rotate', rotation + 'deg');
            
            const duration = 0.6 + Math.random() * 1.0;
            snowflake.style.animationDuration = duration + 's';
            
            snowflake.style.opacity = 0.6 + Math.random() * 0.4;
            snowflake.style.fontSize = (10 + Math.random() * 12) + 'px';
            
            burstContainer.appendChild(snowflake);
            
            snowflake.addEventListener('animationend', () => {
                snowflake.remove();
            });
        }, i * 10);
    }
}

/**
 * Pause/resume snow based on window visibility
 */
export function handleVisibilityChange() {
    const isVisible = !document.hidden;
    const snowEnabled = appState.get('effects.snowEnabled');
    
    if (isVisible && snowEnabled) {
        toggleSnow(true);
    } else if (!isVisible) {
        if (snowInterval) {
            clearInterval(snowInterval);
            snowInterval = null;
        }
    }
}

/**
 * Initialize visibility listener
 */
export function initSnowVisibilityHandler() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
}
