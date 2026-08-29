/**
 * Ganj4Craft Launcher - Settings Easter Egg
 * Пасхалка при закрытии настроек
 */

import { dom } from '../../utils/dom.js';
import { createSnowBurst, createSideBurst } from '../../ui/effects/index.js';
import { appState } from '../../state/app-state.js';
import { EASTER_EGG_CHANCE, EASTER_EGG_IMAGE } from '../../constants.js';

let easterEggActive = false;
let easterEggStage = 0;
let originalNewsContent = null;
let originalPanelTitle = null;
let burstChaosTimeout = null;

/**
 * Добавить стили пасхалки если не добавлены
 */
function ensureEasterEggStyles() {
    if (document.getElementById('easter-egg-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'easter-egg-styles';
    style.textContent = `
        @keyframes rainbow-hue {
            0% { filter: hue-rotate(0deg) saturate(1.5); }
            100% { filter: hue-rotate(360deg) saturate(1.5); }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        @keyframes glitch {
            0%, 100% { transform: translate(0); filter: hue-rotate(0deg); }
            20% { transform: translate(-2px, 2px); filter: hue-rotate(90deg); }
            40% { transform: translate(2px, -2px); filter: hue-rotate(180deg); }
            60% { transform: translate(-2px, -2px); filter: hue-rotate(270deg); }
            80% { transform: translate(2px, 2px); filter: hue-rotate(360deg); }
        }
        .easter-egg-rainbow {
            animation: rainbow-hue 2s linear infinite !important;
        }
        .easter-egg-shake {
            animation: shake 0.5s ease-in-out;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Триггер пасхалки (Stage 1 - Веб-камера)
 */
export function triggerSettingsEasterEgg() {
    const newsList = dom.get('news-list');
    const consoleOutput = dom.get('console-output');
    const panelTitleEl = dom.get('panel-title');
    
    if (!newsList || easterEggActive) return;
    if (consoleOutput && !consoleOutput.classList.contains('hidden')) return;
    
    originalNewsContent = newsList.innerHTML;
    originalPanelTitle = panelTitleEl ? panelTitleEl.innerText : 'Новости';
    easterEggActive = true;
    easterEggStage = 1;
    
    if (panelTitleEl) {
        panelTitleEl.innerText = '📹 Веб-камера';
    }
    
    newsList.innerHTML = `
        <div class="easter-egg-container" style="display: flex; justify-content: center; align-items: center; height: 100%; padding: 10px;">
            <img src="${EASTER_EGG_IMAGE}" style="max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
        </div>
    `;
    
    // Add click listener to advance
    const container = newsList.querySelector('.easter-egg-container');
    if (container) {
        container.style.cursor = 'pointer';
        container.title = 'Нажми меня';
        container.addEventListener('click', triggerEasterEggStage2);
    }
    
    console.log('🥚 Easter egg Stage 1: Веб-камера активирована!');
}

/**
 * Триггер Stage 2 - Хаос
 */
export function triggerEasterEggStage2() {
    const newsList = dom.get('news-list');
    const panelTitleEl = dom.get('panel-title');
    const mainContent = dom.get('main-content');
    
    if (!easterEggActive || easterEggStage !== 1) return;
    
    ensureEasterEggStyles();
    easterEggStage = 2;
    
    if (panelTitleEl) {
        panelTitleEl.innerText = '🌈 ЁБАНЫЙ НАСОС';
    }
    
    newsList.innerHTML = `
        <div class="easter-egg-container" style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; padding: 20px; text-align: center;">
            <div style="font-size: 64px; animation: glitch 0.3s infinite;">🌈🔥💀🎉</div>
            <div style="font-size: 24px; color: #ff00ff; font-weight: bold; margin: 15px 0; text-shadow: 2px 2px #00ffff, -2px -2px #ffff00;">ВСЁ СЛОМАЛОСЬ</div>
            <div style="font-size: 14px; color: #00ff00;">Нажми ещё раз чтобы починить</div>
        </div>
    `;
    
    // Add click listener to hide
    const container = newsList.querySelector('.easter-egg-container');
    if (container) {
        container.style.cursor = 'pointer';
        container.addEventListener('click', hideEasterEgg);
    }
    
    if (mainContent) {
        mainContent.classList.add('easter-egg-rainbow', 'easter-egg-shake');
    }
    
    // Хаос из burst эффектов
    const burstChaos = () => {
        if (!easterEggActive || easterEggStage !== 2) return;
        
        createSnowBurst();
        
        setTimeout(() => {
            if (easterEggActive && easterEggStage === 2) createSideBurst('left');
        }, 200);
        setTimeout(() => {
            if (easterEggActive && easterEggStage === 2) createSideBurst('right');
        }, 400);
        
        burstChaosTimeout = setTimeout(() => {
            if (easterEggActive && easterEggStage === 2) burstChaos();
        }, 800);
    };
    
    burstChaos();
    
    console.log('🥚 Easter egg Stage 2: ХАОС АКТИВИРОВАН!');
}

/**
 * Скрыть пасхалку
 */
export function hideEasterEgg() {
    if (!easterEggActive || !originalNewsContent) return;
    
    const newsList = dom.get('news-list');
    const panelTitleEl = dom.get('panel-title');
    const mainContent = dom.get('main-content');
    
    if (newsList) {
        newsList.innerHTML = originalNewsContent;
    }
    
    if (panelTitleEl && originalPanelTitle) {
        panelTitleEl.innerText = originalPanelTitle;
    }
    
    if (mainContent) {
        mainContent.classList.remove('easter-egg-rainbow', 'easter-egg-shake');
    }
    
    if (burstChaosTimeout) {
        clearTimeout(burstChaosTimeout);
        burstChaosTimeout = null;
    }
    
    easterEggActive = false;
    easterEggStage = 0;
    originalNewsContent = null;
    originalPanelTitle = null;
}

/**
 * Проверить активность пасхалки
 */
export function isSettingsEasterEggActive() {
    return easterEggActive;
}

/**
 * Получить текущий stage
 */
export function getEasterEggStage() {
    return easterEggStage;
}

/**
 * Попытаться триггернуть пасхалку (с учётом шанса)
 */
export function tryTriggerEasterEgg() {
    if (Math.random() < EASTER_EGG_CHANCE) {
        triggerSettingsEasterEgg();
        return true;
    }
    return false;
}
