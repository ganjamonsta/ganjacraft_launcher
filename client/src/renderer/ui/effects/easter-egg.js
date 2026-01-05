/**
 * GanjaCraft Launcher - Easter Egg
 * Пасхалка с 420 и BeatDrop анимацией
 */

import { appState } from '../../state/app-state.js';
import { 
    EASTER_EGG_TRIGGER, 
    EASTER_EGG_TIMEOUT, 
    EASTER_EGG_BEAT_INTERVAL 
} from '../../constants.js';

// Локальный стейт
let keySequence = '';
let keyTimeout = null;
let beatDropActive = false;
let beatInterval = null;

// DOM элементы (кэшируются при первом использовании)
let easterEggOverlay = null;
let beatFlash = null;
let beatText = null;
let beatAudio = null;

/**
 * Получить или создать DOM элементы для пасхалки
 */
function getEasterEggElements() {
    if (!easterEggOverlay) {
        easterEggOverlay = document.getElementById('easter-egg-overlay');
        beatFlash = document.getElementById('beat-flash');
        beatText = document.getElementById('beat-text');
        beatAudio = document.getElementById('beat-audio');
    }
    return { easterEggOverlay, beatFlash, beatText, beatAudio };
}

/**
 * Эффект вспышки под бит
 */
function beatFlashEffect() {
    const { beatFlash, beatText, easterEggOverlay } = getEasterEggElements();
    if (!beatFlash || !beatText || !easterEggOverlay) return;
    
    // Flash
    beatFlash.style.opacity = '0.7';
    setTimeout(() => {
        beatFlash.style.opacity = '0';
    }, 100);
    
    // Пульс текста
    beatText.style.transform = 'translate(-50%, -50%) scale(1.2)';
    setTimeout(() => {
        beatText.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 100);
    
    // Shake контейнера
    easterEggOverlay.style.transform = `rotate(${(Math.random() - 0.5) * 4}deg)`;
    setTimeout(() => {
        easterEggOverlay.style.transform = 'none';
    }, 50);
}

/**
 * Запустить BeatDrop
 */
function startBeatDrop() {
    if (beatDropActive) return;
    
    const elements = getEasterEggElements();
    if (!elements.easterEggOverlay || !elements.beatAudio) return;
    
    beatDropActive = true;
    appState.set('easterEgg.active', true);
    
    elements.easterEggOverlay.classList.remove('hidden');
    elements.easterEggOverlay.classList.add('show');
    
    // Запуск аудио
    elements.beatAudio.currentTime = 0;
    elements.beatAudio.play().catch(e => console.warn('Audio playback failed:', e));
    
    // Синхронизация с битом
    beatInterval = setInterval(beatFlashEffect, EASTER_EGG_BEAT_INTERVAL);
    
    // Остановка по окончанию аудио или через таймаут
    elements.beatAudio.onended = stopBeatDrop;
    
    // Fallback timeout (30 секунд)
    setTimeout(() => {
        if (beatDropActive) stopBeatDrop();
    }, 30000);
}

/**
 * Остановить BeatDrop
 */
function stopBeatDrop() {
    if (!beatDropActive) return;
    
    const elements = getEasterEggElements();
    
    beatDropActive = false;
    appState.set('easterEgg.active', false);
    
    if (beatInterval) {
        clearInterval(beatInterval);
        beatInterval = null;
    }
    
    if (elements.beatAudio) {
        elements.beatAudio.pause();
        elements.beatAudio.currentTime = 0;
    }
    
    if (elements.easterEggOverlay) {
        elements.easterEggOverlay.classList.remove('show');
        elements.easterEggOverlay.classList.add('hidden');
    }
}

/**
 * Обработчик клавиатуры для ввода последовательности
 */
function handleKeyPress(e) {
    // Игнорируем, если фокус в текстовом поле
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // Сброс таймера
    if (keyTimeout) clearTimeout(keyTimeout);
    
    // Добавляем символ
    keySequence += e.key;
    
    // Проверяем триггер
    if (keySequence.endsWith(EASTER_EGG_TRIGGER)) {
        keySequence = '';
        startBeatDrop();
        return;
    }
    
    // Если нажали слишком много символов, обрезаем
    if (keySequence.length > 10) {
        keySequence = keySequence.slice(-10);
    }
    
    // Сброс через таймаут
    keyTimeout = setTimeout(() => {
        keySequence = '';
    }, EASTER_EGG_TIMEOUT);
}

/**
 * Обработчик клика для закрытия
 */
function handleClick() {
    if (beatDropActive) {
        stopBeatDrop();
    }
}

/**
 * Инициализация Easter Egg
 */
export function initEasterEgg() {
    document.addEventListener('keypress', handleKeyPress);
    
    // Клик для закрытия
    const elements = getEasterEggElements();
    if (elements.easterEggOverlay) {
        elements.easterEggOverlay.addEventListener('click', handleClick);
    }
}

/**
 * Очистка
 */
export function destroyEasterEgg() {
    document.removeEventListener('keypress', handleKeyPress);
    stopBeatDrop();
    
    if (keyTimeout) {
        clearTimeout(keyTimeout);
        keyTimeout = null;
    }
}

/**
 * Проверка активности
 */
export function isEasterEggActive() {
    return beatDropActive;
}
