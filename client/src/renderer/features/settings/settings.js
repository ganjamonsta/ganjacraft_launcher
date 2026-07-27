/**
 * GanjaCraft Launcher - Settings Feature
 * Управление настройками лаунчера
 */

import { dom } from '../../utils/dom.js';
import { customAlert, customConfirm } from '../../ui/modals.js';
import { toggleSnow, createSnowBurst, createDirectionalBurst, createSideBurst, applyEffectsConfig } from '../../ui/effects/index.js';
import { appState } from '../../state/app-state.js';
import { startSmokeEffect, stopSmokeEffect } from '../../ui/effects/smoke.js';
import { startParallax, stopParallax } from '../../ui/effects/parallax.js';
import { loadModsList, getDisabledMods, setAllModsState, updateModsCounter, updateCategorySidebar } from '../mods/index.js';
import { logToConsole } from '../console/console.js';
import { initRamSlider } from './ram-slider.js';
import { debounce, triggerInertiaCascade } from '../../utils/performance.js';

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
        memoryMin: document.getElementById('setting-ram-min')?.value.trim().toUpperCase() || '1G',
        memoryMax: document.getElementById('setting-ram-max')?.value.trim().toUpperCase() || '3G',
        hideOnPlay: document.getElementById('setting-hide-on-play')?.checked ?? true,
        effectsPreset: document.getElementById('setting-effects-preset')?.value || 'auto',
        effectsDensity: document.getElementById('setting-effects-density')?.value || 'low',
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
    
    // Controls (Checkboxes & Selects)
    const formControls = [
        'setting-hide-on-play',
        'setting-effects-preset',
        'setting-effects-density',
        'setting-enable-smoke',
        'setting-enable-parallax',
        'dev-skip-sync-checkbox'
    ];
    
    formControls.forEach(id => {
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
    
    // Mods list - event delegation (grid container)
    const modsGrid = document.getElementById('mods-grid');
    if (modsGrid) {
        modsGrid.addEventListener('change', (e) => {
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
                
                if (side && appState.get('effects.snowEnabled')) {
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
    
    // Сбросить горизонтальные направления каскадов от предыдущих переключений вкладок
    document.querySelectorAll('.inertia-cascade, [data-dir]').forEach(el => {
        delete el.dataset.dir;
        el.classList.remove('inertia-cascade');
    });

    settingsScreen.classList.remove('hidden', 'closing');
    settingsScreen.classList.add('opening');
    
    // Деактивировать главную вкладку и запустить выпадение вкладок настроек
    const titleMainTab = document.getElementById('title-bar-title');
    if (titleMainTab) titleMainTab.classList.remove('active');

    const titleBarTabs = document.querySelector('#title-bar .settings-tabs');
    if (titleBarTabs) {
        titleBarTabs.classList.remove('hidden', 'closing');
        titleBarTabs.classList.add('opening');
    }
    
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.classList.add('settings-active');
        btnSettings.textContent = '✕';
        btnSettings.title = 'Закрыть настройки';
    }
    
    // Reset tab index
    const tabButtons = Array.from(document.querySelectorAll('.settings-tabs .tab-btn'));
    const activeTabBtn = document.querySelector('.settings-tabs .tab-btn.active');
    if (activeTabBtn) {
        currentTabIndex = tabButtons.indexOf(activeTabBtn);
    } else {
        currentTabIndex = 0;
    }
    
    // Snow burst (мгновенный вызов в тайминг клика)
    if (appState.get('effects.snowEnabled')) {
        createSnowBurst();
    }
    
    setTimeout(() => {
        settingsScreen.classList.remove('opening');
        settingsAnimating = false;
    }, 580);
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
    
    // Активировать главную вкладку и спрятать вкладки настроек с анимацией
    const titleMainTab = document.getElementById('title-bar-title');
    if (titleMainTab) titleMainTab.classList.add('active');

    const titleBarTabs = document.querySelector('#title-bar .settings-tabs');
    if (titleBarTabs) {
        titleBarTabs.classList.remove('opening');
        titleBarTabs.classList.add('closing');
        setTimeout(() => {
            titleBarTabs.classList.remove('closing');
            titleBarTabs.classList.add('hidden');
        }, 250);
    }
    
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.classList.remove('settings-active');
        btnSettings.textContent = '⚙';
        btnSettings.title = 'Настройки';
    }
    
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
    const presetSelect = document.getElementById('setting-effects-preset');
    const densitySelect = document.getElementById('setting-effects-density');
    const smokeCheckbox = document.getElementById('setting-enable-smoke');
    const parallaxCheckbox = document.getElementById('setting-enable-parallax');
    
    if (pathInput) pathInput.value = config.installPath || '';
    if (javaInput) javaInput.value = config.javaPath || '';
    if (ramMinInput) ramMinInput.value = config.memoryMin || '1G';
    if (ramMaxInput) ramMaxInput.value = config.memoryMax || '3G';
    if (hideOnPlayCheckbox) hideOnPlayCheckbox.checked = config.hideOnPlay !== false;
    
    let preset = config.effectsPreset || 'auto';
    if (config.enableSnow === false && (!config.effectsPreset || config.effectsPreset === 'snow')) {
        preset = 'off';
    }
    if (presetSelect) presetSelect.value = preset;
    if (densitySelect) densitySelect.value = config.effectsDensity || 'low';
    
    if (smokeCheckbox) smokeCheckbox.checked = config.enableSmoke !== false;
    if (parallaxCheckbox) parallaxCheckbox.checked = config.enableParallax !== false;
    
    // Инициализация RAM slider (новый UI)
    initRamSlider(config);
}

/**
 * Сохранить настройки
 */
export async function saveSettings() {
    let memMin = document.getElementById('setting-ram-min')?.value.trim().toUpperCase() || '1G';
    let memMax = document.getElementById('setting-ram-max')?.value.trim().toUpperCase() || '3G';

    // Append 'G' if just number
    if (memMin && /^\d+$/.test(memMin)) memMin += 'G';
    if (memMax && /^\d+$/.test(memMax)) memMax += 'G';

    // Validate format
    if (!/^\d+[MG]$/.test(memMin)) memMin = '1G';
    if (!/^\d+[MG]$/.test(memMax)) memMax = '3G';

    const selectedPreset = document.getElementById('setting-effects-preset')?.value || 'auto';

    const newConfig = {
        ...currentConfig,
        installPath: document.getElementById('setting-path')?.value || '',
        javaPath: document.getElementById('setting-java')?.value || '',
        memoryMin: memMin,
        memoryMax: memMax,
        hideOnPlay: document.getElementById('setting-hide-on-play')?.checked ?? true,
        effectsPreset: selectedPreset,
        effectsDensity: document.getElementById('setting-effects-density')?.value || 'low',
        enableSnow: selectedPreset !== 'off',
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
    applyEffectsConfig(newConfig);

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
let mainTabTimer = null;

export function initSettingsTabs(config) {
    const tabButtons = Array.from(document.querySelectorAll('.settings-tabs .tab-btn'));
    
    tabButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const targetTabId = btn.dataset.tab;
            const targetTab = document.getElementById(`tab-${targetTabId}`);
            const allTabs = document.querySelectorAll('.tab-content');
            const currentActiveTab = document.querySelector('.tab-content.active');
            
            if (!targetTab || currentActiveTab === targetTab) return;
            
            const direction = index > currentTabIndex ? 'right' : 'left';
            currentTabIndex = index;

            if (mainTabTimer) {
                clearTimeout(mainTabTimer);
                mainTabTimer = null;
            }

            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const settingsBody = document.querySelector('.settings-body');
            if (settingsBody) settingsBody.classList.add('animating');

            allTabs.forEach(t => {
                t.classList.remove('slide-in-from-right', 'slide-in-from-left', 'slide-out-to-left', 'slide-out-to-right');
            });
            
            if (currentActiveTab && currentActiveTab !== targetTab) {
                currentActiveTab.classList.add(direction === 'right' ? 'slide-out-to-left' : 'slide-out-to-right');
            }
            
            targetTab.classList.add('active');
            targetTab.classList.add(direction === 'right' ? 'slide-in-from-right' : 'slide-in-from-left');
            
            const cascadeTarget = targetTab.querySelector('.inertia-cascade, .settings-categories, .unified-dev-grid, #mods-grid');
            if (cascadeTarget) {
                triggerInertiaCascade(cascadeTarget, direction);
            }
            
            if (appState.get('effects.snowEnabled')) {
                createDirectionalBurst(direction);
            }
            
            mainTabTimer = setTimeout(() => {
                const activeBtn = document.querySelector('.settings-tabs .tab-btn.active');
                const activeId = activeBtn ? activeBtn.dataset.tab : null;
                const activeTab = activeId ? document.getElementById(`tab-${activeId}`) : targetTab;

                allTabs.forEach(t => {
                    t.classList.remove('slide-in-from-right', 'slide-in-from-left', 'slide-out-to-left', 'slide-out-to-right');
                    if (t === activeTab) {
                        t.classList.add('active');
                    } else {
                        t.classList.remove('active');
                    }
                });

                if (cascadeTarget) {
                    delete cascadeTarget.dataset.dir;
                    cascadeTarget.classList.remove('inertia-cascade');
                }
                if (settingsBody) settingsBody.classList.remove('animating');
                mainTabTimer = null;
            }, 300);
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
            const path = await window.api.selectPath('java');
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
            setAllModsState(true);
            updateModsCounter();
            updateCategorySidebar();
            updateSaveButtonVisibility();
        });
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            setAllModsState(false);
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
