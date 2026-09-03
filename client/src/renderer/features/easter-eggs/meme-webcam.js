/**
 * Ganj4Craft Launcher - Meme Webcam Easter Egg ("Админ у меня крафт не работает")
 * Легендарная пасхалка с веб-камерой, CRT/VHS эффектами и режимом Рейв-Хаоса
 */

import { EASTER_EGG_CHANCE, EASTER_EGG_IMAGE } from '../../constants.js';
import { createSnowBurst, createSideBurst } from '../../ui/effects/index.js';
import { audioSynth } from './audio-synth.js';
import { skinTricks } from './skin-tricks.js';
import { dom } from '../../utils/dom.js';

let webcamModal = null;
let currentStage = 0; // 0 = closed, 1 = webcam, 2 = chaos
let chaosInterval = null;

/**
 * Создать или получить DOM элемент окна веб-камеры
 */
function ensureWebcamDOM() {
    if (webcamModal) return webcamModal;

    const modal = document.createElement('div');
    modal.id = 'meme-webcam-modal';
    modal.className = 'meme-webcam-modal hidden';
    modal.innerHTML = `
        <div class="webcam-window-frame">
            <div class="webcam-header-bar">
                <div class="webcam-status-pill">
                    <span class="rec-dot"></span>
                    <span class="webcam-title-text">📹 СЛУЖБА ПОДДЕРЖКИ — ПРЯМОЙ ЭФИР [REC]</span>
                </div>
                <button class="webcam-close-btn" id="webcam-close-btn" title="Закрыть">✕</button>
            </div>
            <div class="webcam-screen-content" id="webcam-screen-content">
                <div class="crt-scanlines"></div>
                <div class="crt-vignette"></div>
                <div class="webcam-timestamp" id="webcam-time">LIVE 00:04:20</div>
                <img src="${EASTER_EGG_IMAGE}" class="webcam-img" alt="Админ у меня крафт не работает">
                <div class="webcam-glitch-overlay hidden" id="webcam-chaos-view">
                    <div class="chaos-icons">🌈🔥💀🎉</div>
                    <div class="chaos-title">ВСЁ СЛОМАЛОСЬ</div>
                    <div class="chaos-sub">ЁБАНЫЙ НАСОС АКТИВИРОВАН</div>
                </div>
            </div>
            <div class="webcam-footer-bar" id="webcam-footer-text">
                👉 Нажми на изображение, чтобы починить крафт
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    webcamModal = modal;

    const closeBtn = modal.querySelector('#webcam-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideMemeWebcam();
        });
    }

    const screen = modal.querySelector('#webcam-screen-content');
    if (screen) {
        screen.addEventListener('click', () => {
            if (currentStage === 1) {
                triggerChaosStage();
            } else if (currentStage === 2) {
                hideMemeWebcam();
            }
        });
    }

    return modal;
}

/**
 * Триггер Stage 1: Открытие веб-камеры
 */
export function triggerMemeWebcam() {
    if (currentStage > 0) return;

    const modal = ensureWebcamDOM();
    currentStage = 1;

    const chaosView = modal.querySelector('#webcam-chaos-view');
    const footerText = modal.querySelector('#webcam-footer-text');
    if (chaosView) chaosView.classList.add('hidden');
    if (footerText) footerText.innerText = '👉 Нажми на изображение, чтобы починить крафт';

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('visible');
    }, 10);

    audioSynth.playError();
    console.log('🥚 Easter egg: Веб-камера активирована!');
}

/**
 * Триггер Stage 2: Режим Хаоса (ЁБАНЫЙ НАСОС)
 */
export function triggerChaosStage() {
    if (currentStage !== 1) return;
    currentStage = 2;

    const modal = ensureWebcamDOM();
    const chaosView = modal.querySelector('#webcam-chaos-view');
    const footerText = modal.querySelector('#webcam-footer-text');
    const mainContent = dom.get('main-content') || document.body;

    if (chaosView) chaosView.classList.remove('hidden');
    if (footerText) footerText.innerHTML = '✨ <strong>Нажми ещё раз</strong>, чтобы админ всё починил!';

    // Включаем тряску и радугу
    mainContent.classList.add('easter-egg-rainbow', 'easter-egg-shake');
    document.body.classList.add('chaos-screen-active');

    // 3D скин крутится
    skinTricks.spinContinuous(true);

    // Звук бас-дропа
    audioSynth.playBassDrop();
    audioSynth.playFanfare();

    // Хаос из взрывов
    const burstLoop = () => {
        if (currentStage !== 2) return;
        createSnowBurst();
        createSideBurst(Math.random() > 0.5 ? 'left' : 'right');
        audioSynth.playPop(1.5 + Math.random() * 0.5);

        chaosInterval = setTimeout(burstLoop, 650);
    };
    burstLoop();

    console.log('🥚 Easter egg: ХАОС АКТИВИРОВАН!');
}

/**
 * Закрытие и восстановление системы
 */
export function hideMemeWebcam() {
    if (currentStage === 0) return;

    if (chaosInterval) {
        clearTimeout(chaosInterval);
        chaosInterval = null;
    }

    const mainContent = dom.get('main-content') || document.body;
    mainContent.classList.remove('easter-egg-rainbow', 'easter-egg-shake');
    document.body.classList.remove('chaos-screen-active');

    skinTricks.spinContinuous(false);

    if (webcamModal) {
        webcamModal.classList.remove('visible');
        setTimeout(() => {
            webcamModal.classList.add('hidden');
        }, 250);
    }

    if (currentStage === 2) {
        audioSynth.playCoin();
        showRepairToast();
    }

    currentStage = 0;
}

/**
 * Всплывающее уведомление об успешном ремонте
 */
function showRepairToast() {
    const toast = document.createElement('div');
    toast.className = 'craft-repaired-toast';
    toast.innerHTML = `<span>🛠️ Ошибка успешно исправлена. Приятной игры.</span>`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

/**
 * Попытка триггера при закрытии настроек с шансом 5%
 */
export function tryTriggerSettingsEasterEgg() {
    if (Math.random() < EASTER_EGG_CHANCE) {
        triggerMemeWebcam();
        return true;
    }
    return false;
}

export function isMemeWebcamActive() {
    return currentStage > 0;
}
