/**
 * GanjaCraft Launcher - Joint Progress Bar
 * Анимированный индикатор прогресса (косяк)
 */

import { appState } from '../../state/app-state.js';
import { dom } from '../../utils/dom.js';

/**
 * Обновить прогресс-бар "косяк"
 * @param {number} percent - процент прогресса (0-100)
 */
export function updateJointProgress(percent) {
    const jointProgress = dom.get('joint-progress');
    const jointFill = dom.get('joint-fill');
    const jointAsh = dom.get('joint-ash');
    const jointEmber = dom.get('joint-ember');
    const jointSmoke = dom.get('joint-smoke');
    
    if (!jointProgress || !jointFill) return;
    
    // Ограничиваем значение
    const clampedPercent = Math.max(0, Math.min(100, percent));
    
    // Обновляем заполнение (инвертируем - уменьшается справа налево)
    jointFill.style.width = (100 - clampedPercent) + '%';
    
    // Показываем/скрываем элементы
    if (clampedPercent > 0) {
        jointProgress.classList.add('active');
        
        if (jointAsh) jointAsh.style.opacity = '1';
        if (jointEmber) jointEmber.style.opacity = '1';
        if (jointSmoke) jointSmoke.style.opacity = '1';
    } else {
        if (jointAsh) jointAsh.style.opacity = '0';
        if (jointEmber) jointEmber.style.opacity = '0';
        if (jointSmoke) jointSmoke.style.opacity = '0';
    }
    
    // Сохраняем в state
    appState.set('game.downloadPercent', clampedPercent);
}

/**
 * Сбросить прогресс-бар
 */
export function resetJointProgress() {
    const jointProgress = dom.get('joint-progress');
    const jointFill = dom.get('joint-fill');
    const jointAsh = dom.get('joint-ash');
    const jointEmber = dom.get('joint-ember');
    const jointSmoke = dom.get('joint-smoke');
    
    if (jointFill) jointFill.style.width = '100%';
    if (jointProgress) jointProgress.classList.remove('active');
    if (jointAsh) jointAsh.style.opacity = '0';
    if (jointEmber) jointEmber.style.opacity = '0';
    if (jointSmoke) jointSmoke.style.opacity = '0';
    
    appState.set('game.downloadPercent', 0);
}

/**
 * Показать прогресс-бар
 */
export function showJointProgress() {
    const jointProgress = dom.get('joint-progress');
    if (jointProgress) {
        jointProgress.classList.remove('hidden');
    }
}

/**
 * Скрыть прогресс-бар
 */
export function hideJointProgress() {
    const jointProgress = dom.get('joint-progress');
    if (jointProgress) {
        jointProgress.classList.add('hidden');
    }
    resetJointProgress();
}

/**
 * Анимация завершения (100% с эффектами)
 */
export function completeJointProgress() {
    updateJointProgress(100);
    
    // Финальная анимация дыма
    const jointSmoke = dom.get('joint-smoke');
    if (jointSmoke) {
        jointSmoke.classList.add('complete');
        setTimeout(() => {
            jointSmoke.classList.remove('complete');
        }, 2000);
    }
    
    // Скрываем через небольшую задержку
    setTimeout(() => {
        hideJointProgress();
    }, 1500);
}
