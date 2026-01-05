/**
 * GanjaCraft Launcher - Settings Feature
 * Управление настройками лаунчера
 */

import { dom } from '../../utils/dom.js';
import { customAlert, customConfirm } from '../../ui/modals.js';
import { toggleSnow, createSnowBurst, createDirectionalBurst, createSideBurst } from '../../ui/effects/index.js';
import { startSmokeEffect, stopSmokeEffect } from '../../ui/effects/smoke.js';
import { startParallax, stopParallax } from '../../ui/effects/parallax.js';
import { loadModsList, getDisabledMods, updateModsCounter, updateCategorySidebar } from '../mods/index.js';
import { logToConsole } from '../console/console.js';
import { initRamSlider } from './ram-slider.js';
import { debounce } from '../../utils/performance.js';

// Стейт для отслеживания изменений
let initialSettingsState = null;
let hasUnsavedChanges = false;
let settingsAnimating = false;
let currentTabIndex = 0;

// DOM references
let settingsScreen = null;
let consoleOutput = null;
let currentConfig = {};

/**
 * Инициализация DOM references
 */
function initDOMRefs() {
    settingsScreen = dom.get('step-settings');
    consoleOutput = dom.get('console-output');
}

/**
 * Получить текущее состояние настроек
 */
export function getCurrentSettingsState() {
    return {
        installPath: document.getElementById('setting-path')?.value || '',
        javaPath: document.getElementById('setting-java')?.value || '',
        memoryMin: document.getElementById('setting-ram-min')?.value.trim().toUpperCase() || '2G',
        memoryMax: document.getElementById('setting-ram-max')?.value.trim().toUpperCase() || '6G',
        hideOnPlay: document.getElementById('setting-hide-on-play')?.checked ?? true,
        enableSnow: document.getElementById('setting-enable-snow')?.checked ?? true,
        enableSmoke: document.getElementById('setting-enable-smoke')?.checked ?? true,
        enableParallax: document.getElementById('setting-enable-parallax')?.checked ?? true,
        skipSync: document.getElementById('dev-skip-sync-checkbox')?.checked || false,
        disabledMods: getDisabledMods().sort().join(',')
    };
}

/**
 * Проверить изменились ли настройки
 */
export function settingsChanged() {
    const current = getCurrentSettingsState();
    return JSON.stringify(current) !== JSON.stringify(initialSettingsState);
}

/**
 * Обновить видимость кнопки сохранения (debounced для производительности)
 */
export const updateSaveButtonVisibility = debounce(() => {
    const saveBtn = dom.get('save-settings');
    if (!saveBtn) return;
    
    hasUnsavedChanges = settingsChanged();
    
    if (hasUnsavedChanges) {
        saveBtn.classList.add('visible');
    } else {
        saveBtn.classList.remove('visible');
    }
}, 100);

/**
 * Настроить слушатели изменений полей
 */
export function setupSettingsChangeListeners() {
    // Text inputs - используем passive для лучшей производительности
    const textInputs = [
        'setting-path',
        'setting-java', 
        'setting-ram-min',
        'setting-ram-max'
    ];
    
    textInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateSaveButtonVisibility, { passive: true });
            el.addEventListener('change', updateSaveButtonVisibility, { passive: true });
        }
    });
    
    // RAM Sliders (новый UI)
    const ramSliders = [
        'setting-ram-slider-min',
        'setting-ram-slider-max'
    ];
    
    ramSliders.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateSaveButtonVisibility, { passive: true });
            el.addEventListener('change', updateSaveButtonVisibility, { passive: true });
        }
    });
    
    // Checkboxes
    const checkboxes = [
        'setting-hide-on-play',
        'setting-enable-snow',
        'setting-enable-smoke',
        'setting-enable-parallax',
        'dev-skip-sync-checkbox'
    ];
    
    checkboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', updateSaveButtonVisibility, { passive: true });
        }
    });
    
    // Admin token input
    const adminTokenInput = document.getElementById('admin-api-token-input');
    if (adminTokenInput) {
        adminTokenInput.addEventListener('input', updateSaveButtonVisibility, { passive: true });
    }
    
    // Mods list - event delegation
    const modsList = document.getElementById('mods-list');
    if (modsList) {
        modsList.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                updateSaveButtonVisibility();
                updateModsCounter();
                updateCategorySidebar();
            }
        });
    }
}

// Кеш для UI элементов в toggleMainUIVisibility
let cachedUIElements = null;

/**
 * Показать/скрыть основные UI элементы (оптимизировано)
 */
export function toggleMainUIVisibility(show, config) {
    // Ленивая инициализация кеша элементов
    if (!cachedUIElements) {
        cachedUIElements = [
            { el: document.getElementById('news-section'), defaultTransform: 'none', hideTransform: 'translateX(-120%)', side: 'left' },
            { el: document.getElementById('server-status-widget'), defaultTransform: 'none', hideTransform: 'translateY(-150%)', side: null },
            { el: document.querySelector('.auth-container'), defaultTransform: 'translateY(-50%)', hideTransform: 'translateY(-50%) translateX(120%)', side: 'right' }
        ];
    }
    
    cachedUIElements.forEach(({ el, defaultTransform, hideTransform, side }, index) => {
        if (el) {
            if (show) {
                const delay = index * 50;
                el.style.transition = `transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`;
                el.style.transform = defaultTransform;
                
                if (side && config?.enableSnow !== false) {
                    setTimeout(() => createSideBurst(side), delay + 50);
                }
            } else {
                const delay = index * 20;
                el.style.transition = `transform 0.15s cubic-bezier(0.4, 0, 1, 1) ${delay}ms`;
                el.style.transform = hideTransform;
            }
            el.style.pointerEvents = show ? 'auto' : 'none';
        }
    });
}

/**
 * Открыть настройки с анимацией
 */
export function openSettings(config) {
    initDOMRefs();
    if (settingsAnimating || !settingsScreen) return;
    settingsAnimating = true;
    
    settingsScreen.classList.remove('hidden', 'closing');
    settingsScreen.classList.add('opening');
    
    // Reset tab index
    const tabButtons = Array.from(document.querySelectorAll('.settings-tabs .tab-btn'));
    const activeTabBtn = document.querySelector('.settings-tabs .tab-btn.active');
    if (activeTabBtn) {
        currentTabIndex = tabButtons.indexOf(activeTabBtn);
    } else {
        currentTabIndex = 0;
    }
    
    // Snow burst
    if (config?.enableSnow !== false) {
        createSnowBurst();
    }
    
    setTimeout(() => { settingsAnimating = false; }, 300);
}

/**
 * Закрыть настройки с анимацией
 */
export function closeSettings() {
    initDOMRefs();
    if (settingsAnimating || !settingsScreen) return;
    settingsAnimating = true;
    
    settingsScreen.classList.remove('opening');
    settingsScreen.classList.add('closing');
    
    setTimeout(() => {
        settingsScreen.classList.remove('closing');
        settingsScreen.classList.add('hidden');
        settingsAnimating = false;
    }, 250);
}

/**
 * Заполнить поля настроек из конфига
 */
export function populateSettingsFields(config) {
    currentConfig = config;
    
    const pathInput = document.getElementById('setting-path');
    const javaInput = document.getElementById('setting-java');
    const ramMinInput = document.getElementById('setting-ram-min');
    const ramMaxInput = document.getElementById('setting-ram-max');
    const hideOnPlayCheckbox = document.getElementById('setting-hide-on-play');
    const snowCheckbox = document.getElementById('setting-enable-snow');
    const smokeCheckbox = document.getElementById('setting-enable-smoke');
    const parallaxCheckbox = document.getElementById('setting-enable-parallax');
    
    if (pathInput) pathInput.value = config.installPath || '';
    if (javaInput) javaInput.value = config.javaPath || '';
    if (ramMinInput) ramMinInput.value = config.memoryMin || '2G';
    if (ramMaxInput) ramMaxInput.value = config.memoryMax || '6G';
    if (hideOnPlayCheckbox) hideOnPlayCheckbox.checked = config.hideOnPlay !== false;
    if (snowCheckbox) snowCheckbox.checked = config.enableSnow !== false;
    if (smokeCheckbox) smokeCheckbox.checked = config.enableSmoke !== false;
    if (parallaxCheckbox) parallaxCheckbox.checked = config.enableParallax !== false;
    
    // Инициализация RAM slider (новый UI)
    initRamSlider(config);
}

/**
 * Сохранить настройки
 */
export async function saveSettings() {
    let memMin = document.getElementById('setting-ram-min')?.value.trim().toUpperCase() || '2G';
    let memMax = document.getElementById('setting-ram-max')?.value.trim().toUpperCase() || '6G';

    // Append 'G' if just number
    if (memMin && /^\d+$/.test(memMin)) memMin += 'G';
    if (memMax && /^\d+$/.test(memMax)) memMax += 'G';

    // Validate format
    if (!/^\d+[MG]$/.test(memMin)) memMin = '2G';
    if (!/^\d+[MG]$/.test(memMax)) memMax = '6G';

    const newConfig = {
        ...currentConfig,
        installPath: document.getElementById('setting-path')?.value || '',
        javaPath: document.getElementById('setting-java')?.value || '',
        memoryMin: memMin,
        memoryMax: memMax,
        hideOnPlay: document.getElementById('setting-hide-on-play')?.checked ?? true,
        enableSnow: document.getElementById('setting-enable-snow')?.checked ?? true,
        enableSmoke: document.getElementById('setting-enable-smoke')?.checked ?? true,
        enableParallax: document.getElementById('setting-enable-parallax')?.checked ?? true,
        skipSync: document.getElementById('dev-skip-sync-checkbox')?.checked || false,
        disabledMods: getDisabledMods(),
        modsDefaultsApplied: true,
    };
    
    const ok = await window.api.saveConfig(newConfig);
    if (!ok) {
        logToConsole('[SETTINGS] Ошибка сохранения настроек (конфиг не записан).');
        return false;
    }
    
    currentConfig = newConfig;
    
    // Apply Visual Effects
    toggleSnow(newConfig.enableSnow);
    if (newConfig.enableSmoke) {
        startSmokeEffect();
    } else {
        stopSmokeEffect();
    }
    
    // Toggle Parallax
    if (newConfig.enableParallax) {
        startParallax();
    } else {
        stopParallax();
    }

    // Update UI values
    const ramMinInput = document.getElementById('setting-ram-min');
    const ramMaxInput = document.getElementById('setting-ram-max');
    if (ramMinInput) ramMinInput.value = memMin;
    if (ramMaxInput) ramMaxInput.value = memMax;

    // Update state and hide save button
    initialSettingsState = getCurrentSettingsState();
    hasUnsavedChanges = false;
    const saveBtn = dom.get('save-settings');
    if (saveBtn) saveBtn.classList.remove('visible');

    logToConsole('[SETTINGS] Saved.');
    return true;
}

/**
 * Инициализация табов настроек
 */
export function initSettingsTabs(config) {
    const tabButtons = Array.from(document.querySelectorAll('.settings-tabs .tab-btn'));
    
    tabButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const targetTabId = btn.dataset.tab;
            const targetTab = document.getElementById(`tab-${targetTabId}`);
            const currentActiveTab = document.querySelector('.tab-content.active');
            
            if (currentActiveTab === targetTab) return;
            
            const direction = index > currentTabIndex ? 'right' : 'left';
            
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const settingsBody = document.querySelector('.settings-body');
            if (settingsBody) settingsBody.classList.add('animating');
            
            if (currentActiveTab) {
                currentActiveTab.classList.add(direction === 'right' ? 'slide-out-to-left' : 'slide-out-to-right');
                
                setTimeout(() => {
                    currentActiveTab.classList.remove('active', 'slide-out-to-left', 'slide-out-to-right');
                }, 150);
            }
            
            setTimeout(() => {
                targetTab.classList.add('active');
                targetTab.classList.add(direction === 'right' ? 'slide-in-from-right' : 'slide-in-from-left');
            }, 75);
            
            if (config?.enableSnow !== false) {
                createDirectionalBurst(direction);
            }
            
            setTimeout(() => {
                targetTab.classList.remove('slide-in-from-right', 'slide-in-from-left');
                if (settingsBody) settingsBody.classList.remove('animating');
            }, 355);
            
            currentTabIndex = index;
        });
    });
}

/**
 * Инициализация кнопок выбора пути
 */
export function initPathSelectors() {
    const selectPathBtn = document.getElementById('btn-select-path');
    const openPathBtn = document.getElementById('btn-open-path');
    const selectJavaBtn = document.getElementById('btn-select-java');
    const resetJavaBtn = document.getElementById('btn-reset-java');
    
    if (selectPathBtn) {
        selectPathBtn.addEventListener('click', async () => {
            const path = await window.api.selectPath('dir');
            if (path) {
                document.getElementById('setting-path').value = path;
                updateSaveButtonVisibility();
            }
        });
    }
    
    if (openPathBtn) {
        openPathBtn.addEventListener('click', async () => {
            const path = document.getElementById('setting-path')?.value;
            if (path) {
                await window.api.openFolder(path);
            }
        });
    }
    
    if (selectJavaBtn) {
        selectJavaBtn.addEventListener('click', async () => {
            const path = await window.api.selectPath('file');
            if (path) {
                document.getElementById('setting-java').value = path;
                updateSaveButtonVisibility();
            }
        });
    }
    
    if (resetJavaBtn) {
        resetJavaBtn.addEventListener('click', () => {
            document.getElementById('setting-java').value = '';
            updateSaveButtonVisibility();
        });
    }
}

/**
 * Инициализация кнопки переустановки
 */
export function initReinstallButton() {
    const reinstallBtn = document.getElementById('btn-reinstall');
    if (reinstallBtn) {
        reinstallBtn.addEventListener('click', async () => {
            const confirmed = await customConfirm(
                'Это удалит все моды и настройки игры. Продолжить?',
                '⚠️ Переустановка клиента'
            );
            if (confirmed) {
                await window.api.reinstallClient();
                await customAlert('Файлы клиента удалены. Пожалуйста, перезапустите лаунчер или нажмите ИГРАТЬ для повторной загрузки.', '✅ Переустановка завершена');
                settingsScreen?.classList.add('hidden');
            }
        });
    }
}

/**
 * Инициализация кнопок выбора всех/сброса модов
 */
export function initModsButtons() {
    const selectAllBtn = document.getElementById('mods-select-all');
    const deselectAllBtn = document.getElementById('mods-deselect-all');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#mods-list input[type="checkbox"]:not([disabled])').forEach(cb => {
                cb.checked = true;
            });
            updateModsCounter();
            updateCategorySidebar();
            updateSaveButtonVisibility();
        });
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#mods-list input[type="checkbox"]:not([disabled])').forEach(cb => {
                cb.checked = false;
            });
            updateModsCounter();
            updateCategorySidebar();
            updateSaveButtonVisibility();
        });
    }
}

/**
 * Сохранить initial state после загрузки
 */
export function captureInitialSettingsState() {
    initialSettingsState = getCurrentSettingsState();
    hasUnsavedChanges = false;
    const saveBtn = dom.get('save-settings');
    if (saveBtn) saveBtn.classList.remove('visible');
}

/**
 * Проверка анимации
 */
export function isSettingsAnimating() {
    return settingsAnimating;
}

/**
 * Получить текущий конфиг
 */
export function getCurrentConfig() {
    return currentConfig;
}

/**
 * Установить текущий конфиг
 */
export function setCurrentConfig(config) {
    currentConfig = config;
}
