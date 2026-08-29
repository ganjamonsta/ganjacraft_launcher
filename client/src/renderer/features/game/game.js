/**
 * Ganj4Craft Launcher - Game Launch Feature
 * Запуск игры и обработка прогресса
 */

import { dom } from '../../utils/dom.js';
import { logToConsole } from '../console/index.js';
import { getCurrentUsername, getAuthToken } from '../auth/index.js';
import { getCurrentConfig, settingsChanged, saveSettings } from '../settings/index.js';

/**
 * Обновить прогресс-бар игры (реалистичный эффект тления косяка)
 * @param {HTMLElement} container - Контейнер с изображением косяка
 * @param {HTMLElement} burn - Элемент с эффектом горения (огонёк)
 * @param {HTMLElement} endImg - Изображение окурка (показывается при 100%)
 * @param {number} percent - Процент прогресса (0-100)
 */
export function setJointProgress(container, burn, endImg, percent) {
    if (!container) return;
    
    // Constants for realistic smoking effect
    const MAX_WIDTH = 260; // Total width of the image in pixels
    const MIN_WIDTH = 28;  // Width at 100% progress (the filter/butt)
    const START_BURN_HEIGHT = 19; // Thickness at start
    const END_BURN_HEIGHT = 10;    // Thickness at end

    // Calculate current width of the container (the unsmoked part)
    // 0% progress -> MAX_WIDTH
    // 100% progress -> MIN_WIDTH
    const currentWidthPx = MAX_WIDTH - ((MAX_WIDTH - MIN_WIDTH) * (percent / 100));
    
    // Calculate burn height (thickness)
    const currentBurnHeight = START_BURN_HEIGHT - ((START_BURN_HEIGHT - END_BURN_HEIGHT) * (percent / 100));

    if (percent >= 100) {
        // Finished
        container.classList.add('hidden');
        if (burn) burn.classList.add('hidden');
        if (endImg) endImg.classList.remove('hidden');
    } else {
        // In progress
        container.classList.remove('hidden');
        container.style.width = `${currentWidthPx}px`;
        
        if (burn) {
            burn.classList.remove('hidden');
            
            // Position: The burn is separate from the container in the DOM.
            // It tracks the left edge of the visible joint.
            // Since the joint is anchored right, the left edge is at (MAX_WIDTH - currentWidthPx).
            const burnLeftPos = MAX_WIDTH - currentWidthPx;
            burn.style.left = `${burnLeftPos}px`;
            
            // Vertical Trajectory: Moves down by 3px as it burns
            // 0% -> 0px offset
            // 100% -> 3px offset
            const verticalOffset = 3 * (percent / 100);
            burn.style.top = `${verticalOffset}px`;
            
            // Update height/thickness of the burning tip
            const burnTip = burn.querySelector('.joint-burn');
            if (burnTip) {
                burnTip.style.height = `${currentBurnHeight}px`;
            }
        }
        
        if (endImg) endImg.classList.add('hidden');
    }
}

/**
 * Показать экран игры (после отмены или ошибки запуска)
 */
function showPlayScreen() {
    const stepPlay = dom.get('step-play');
    const stepProgress = dom.get('step-progress');
    
    if (stepProgress) stepProgress.classList.add('hidden');
    if (stepPlay) {
        stepPlay.classList.remove('hidden');
        stepPlay.classList.add('fade-in');
    }
}

/**
 * Запустить игру
 */
export async function startLaunch() {
    const statusDiv = dom.get('game-status') || dom.get('status');
    const consoleOutput = dom.get('console-output');
    const retryBtn = dom.get('retry-btn');
    const cancelBtn = dom.get('cancel-btn');
    const gameJointProgress = dom.get('game-joint-progress');
    const gameJointBurn = dom.get('game-joint-burn');
    const gameJointEnd = dom.get('game-joint-end');
    
    // Reset UI
    if (statusDiv) {
        statusDiv.innerText = 'Инициализация запуска...';
        statusDiv.style.color = '#39ff14';
    }
    setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);
    
    if (retryBtn) retryBtn.classList.add('hidden');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    
    // Auto-save any pending setting or mod changes before launching
    if (settingsChanged()) {
        logToConsole('[SETTINGS] Сохранение изменённых настроек перед запуском...');
        await saveSettings();
    }

    logToConsole('[LAUNCHER] Подготовка к запуску игры...');

    const result = await window.api.launchGame({ 
        username: getCurrentUsername(),
        token: getAuthToken()
    });
    
    if (result.success) {
        if (statusDiv) {
            statusDiv.innerText = 'Игра запущена';
            statusDiv.style.color = '#39ff14';
        }
        setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 100);
        if (cancelBtn) cancelBtn.classList.add('hidden');

        const cfg = getCurrentConfig() || {};
        if (cfg.hideOnPlay !== false) {
            window.api.minimize();
        }
    } else {
        // Error Handling
        console.error(result.error);
        
        const err = result.error ? result.error.toString() : 'Неизвестная ошибка';

        // Handle Cancellation
        if (err === 'Запуск отменен') {
            logToConsole('[LAUNCHER] Запуск отменен пользователем.');
            showPlayScreen();
            setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);
            return;
        }
        
        let msg = 'Ошибка запуска';
        
        if (err.includes('ENOTFOUND') || err.includes('ETIMEDOUT') || err.includes('UnknownHostException')) {
            msg = 'Потеряно соединение. Проверьте интернет.';
        } else {
            msg = 'Ошибка: ' + err.substring(0, 40) + (err.length > 40 ? '...' : '');
        }
        
        if (statusDiv) {
            statusDiv.innerText = msg;
            statusDiv.style.color = '#ef5350';
        }
        
        logToConsole(`[ERROR] ${result.error}`);
        
        // Show Retry
        if (retryBtn) retryBtn.classList.remove('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');
    }
}

/**
 * Отменить запуск
 */
export async function cancelLaunch() {
    logToConsole('[LAUNCHER] Отмена запуска...');
    await window.api.cancelLaunch();
}

/**
 * Инициализация IPC обработчиков прогресса
 */
export function initProgressHandlers() {
    const statusDiv = dom.get('game-status') || dom.get('status');
    const gameJointProgress = dom.get('game-joint-progress');
    const gameJointBurn = dom.get('game-joint-burn');
    const gameJointEnd = dom.get('game-joint-end');
    const cancelBtn = dom.get('cancel-btn');
    const stepProgress = dom.get('step-progress');
    const stepPlay = dom.get('step-play');
    
    // Progress Handler
    if (window.api.onProgress) {
        window.api.onProgress((e) => {
            const percent = (e.task / e.total) * 100;
            setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, percent);
            const statusEl = dom.get('game-status') || dom.get('status');
            if (statusEl) {
                if (e.currentFile) {
                    const filename = e.currentFile.split(/[/\\]/).pop();
                    const tag = e.sourceName ? `[${e.sourceName}] ` : '';
                    statusEl.innerText = `${tag}${filename} (${Math.round(percent)}%)`;
                } else {
                    statusEl.innerText = `Загрузка ресурсов: ${Math.round(percent)}%`;
                }
            }
        });
    }

    // Log Handler
    window.api.onLog((text) => {
        logToConsole(text);
        const statusEl = dom.get('game-status') || dom.get('status');
        
        if (text.includes('Скачивание:')) {
            if (statusEl) statusEl.innerText = 'Загрузка ресурсов...';
            if (gameJointProgress && !gameJointProgress.classList.contains('hidden') && gameJointProgress.style.width === '100%') {
                setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 40);
            }
        } else if (text.includes('Обновление завершено')) {
            if (statusEl) statusEl.innerText = 'Запуск игры...';
            setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 100);
            if (cancelBtn) cancelBtn.classList.add('hidden');
        } else if (text.includes('Проверка обновлений')) {
            if (statusEl) statusEl.innerText = 'Проверка обновлений...';
            setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 5);
        }
    });

    // Game Closed Handler
    window.api.onGameClosed(() => {
        logToConsole('[LAUNCHER] Игровая сессия завершена.');
        
        if (stepProgress) stepProgress.classList.add('hidden');
        if (stepPlay) {
            stepPlay.classList.remove('hidden');
            stepPlay.classList.add('fade-in');
        }
        
        setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);
        const statusEl = dom.get('game-status') || dom.get('status');
        if (statusEl) {
            statusEl.innerText = 'Готов к игре';
            statusEl.style.color = '#39ff14';
        }
        
        const playBtn = dom.get('play-btn');
        if (playBtn) {
            playBtn.disabled = false;
        }
    });
}

/**
 * Инициализация кнопок запуска
 */
export function initGameButtons() {
    const playBtn = dom.get('play-btn');
    const cancelBtn = dom.get('cancel-btn');
    const retryBtn = dom.get('retry-btn');
    const stepPlay = dom.get('step-play');
    const stepProgress = dom.get('step-progress');
    
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (stepPlay) stepPlay.classList.add('hidden');
            if (stepProgress) {
                stepProgress.classList.remove('hidden');
                stepProgress.classList.add('fade-in');
            }
            startLaunch();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelLaunch);
    }
    
    if (retryBtn) {
        retryBtn.addEventListener('click', startLaunch);
    }
}
