/**
 * Ganj4Craft Launcher - 420 Blaze It & BeatDrop Mode
 * Восстановленная и улучшенная пасхалка по набору "420" / "ganja" на клавиатуре
 */

import { EASTER_EGG_TRIGGER, EASTER_EGG_TIMEOUT, EASTER_EGG_BEAT_INTERVAL } from '../../constants.js';
import { createSnowBurst, createSideBurst } from '../../ui/effects/index.js';
import { audioSynth } from './audio-synth.js';
import { skinTricks } from './skin-tricks.js';
import { dom } from '../../utils/dom.js';

let keySequence = '';
let keyTimeout = null;
let raveActive = false;
let beatInterval = null;
let raveOverlay = null;
let originalBrandText = 'GANJ4CRAFT';

/**
 * Создать или получить элементы оверлея 420 Rave
 */
function ensureRaveDOM() {
    if (raveOverlay) return raveOverlay;

    const overlay = document.createElement('div');
    overlay.id = 'blaze-rave-overlay';
    overlay.className = 'blaze-rave-overlay hidden';
    overlay.innerHTML = `
        <div class="rave-smoke-fog"></div>
        <div class="rave-vignette"></div>
        <div class="rave-center-badge">
            <div class="rave-badge-top">✨ 420 BLAZE IT ✨</div>
            <div class="rave-badge-title">GANJA DROP</div>
            <div class="rave-badge-sub">Нажми в любое место, чтобы выйти</div>
        </div>
    `;

    document.body.appendChild(overlay);
    raveOverlay = overlay;

    overlay.addEventListener('click', () => {
        stopBlazeRave();
    });

    return overlay;
}

/**
 * Вспышка под бит
 */
function raveBeatPulse() {
    if (!raveActive) return;

    audioSynth.playBassDrop();
    createSideBurst(Math.random() > 0.5 ? 'left' : 'right');

    const overlay = ensureRaveDOM();
    overlay.classList.add('rave-pulse');
    setTimeout(() => overlay.classList.remove('rave-pulse'), 120);

    const brandHeader = document.querySelector('.hero-neon-title-cyber');
    if (brandHeader) {
        brandHeader.style.transform = 'scale(1.15)';
        brandHeader.style.filter = 'drop-shadow(0 0 25px #39ff14)';
        setTimeout(() => {
            brandHeader.style.transform = '';
            brandHeader.style.filter = '';
        }, 120);
    }
}

/**
 * Запуск режима 420 Rave
 */
export function triggerBlazeRave() {
    if (raveActive) return;
    raveActive = true;

    const overlay = ensureRaveDOM();
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('visible'), 10);

    // Меняем текст шапки
    const brandHeader = document.querySelector('.hero-neon-title-cyber');
    if (brandHeader) {
        originalBrandText = brandHeader.innerText;
        brandHeader.innerText = '420 BLAZE IT';
        brandHeader.classList.add('brand-rave-active');
    }

    // Взрыв листьев
    createSnowBurst();
    createSideBurst('left');
    createSideBurst('right');

    // 3D скин делает трюк
    skinTricks.doAcrobaticSpin();

    // Запуск ритма битов
    raveBeatPulse();
    beatInterval = setInterval(raveBeatPulse, EASTER_EGG_BEAT_INTERVAL);

    // Автоматическая остановка через 15 секунд
    setTimeout(() => {
        if (raveActive) stopBlazeRave();
    }, 15000);

    console.log('💨 420 Blaze It Rave activated!');
}

/**
 * Остановка режима 420 Rave
 */
export function stopBlazeRave() {
    if (!raveActive) return;
    raveActive = false;

    if (beatInterval) {
        clearInterval(beatInterval);
        beatInterval = null;
    }

    if (raveOverlay) {
        raveOverlay.classList.remove('visible');
        setTimeout(() => {
            raveOverlay.classList.add('hidden');
        }, 300);
    }

    const brandHeader = document.querySelector('.hero-neon-title-cyber');
    if (brandHeader) {
        brandHeader.innerText = originalBrandText || 'GANJ4CRAFT';
        brandHeader.classList.remove('brand-rave-active');
    }
}

/**
 * Клавиатурный слушатель набора триггеров ("420", "ganja", "blaze")
 */
function handleKeyPress(e) {
    // Игнорируем ввод в input / textarea
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

    if (keyTimeout) clearTimeout(keyTimeout);

    keySequence += e.key.toLowerCase();

    if (keySequence.endsWith(EASTER_EGG_TRIGGER) || keySequence.endsWith('ganja') || keySequence.endsWith('blaze')) {
        keySequence = '';
        triggerBlazeRave();
        return;
    }

    if (keySequence.length > 10) {
        keySequence = keySequence.slice(-10);
    }

    keyTimeout = setTimeout(() => {
        keySequence = '';
    }, EASTER_EGG_TIMEOUT);
}

/**
 * Инициализация
 */
export function initBlazeRave() {
    document.addEventListener('keypress', handleKeyPress);
}

export function isBlazeRaveActive() {
    return raveActive;
}
