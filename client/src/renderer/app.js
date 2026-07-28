/**
 * GanjaCraft Launcher - Main Application Entry Point
 * Точка входа для renderer process
 */

// === Core Imports ===
import { dom } from './utils/dom.js';

// === UI Imports ===
import { customConfirm, customAlert, showError } from './ui/modals.js';
import { 
    initAllEffects,
    createSnowBurst, 
    createDirectionalBurst, 
    createSideBurst
} from './ui/effects/index.js';
import { initEasterEgg } from './ui/effects/easter-egg.js';

// === Feature Imports ===
import { 
    checkSavedAuth, 
    initAuthHandlers, 
    getCurrentUsername 
} from './features/auth/index.js';

import { 
    loadModsList, 
    initModsListeners 
} from './features/mods/index.js';

import {
    loadConfigsList,
    savePendingConfigs,
    cancelPendingConfigs
} from './features/configs/configs-manager.js';

import {
    setupSettingsChangeListeners,
    toggleMainUIVisibility,
    openSettings,
    closeSettings,
    populateSettingsFields,
    saveSettings,
    initSettingsTabs,
    initPathSelectors,
    initReinstallButton,
    initModsButtons,
    captureInitialSettingsState,
    isSettingsAnimating,
    getCurrentConfig,
    setCurrentConfig,
    tryTriggerEasterEgg,
    triggerEasterEggStage2,
    hideEasterEgg,
    isSettingsEasterEggActive,
    getEasterEggStage
} from './features/settings/index.js';

import { 
    initProgressHandlers, 
    initGameButtons 
} from './features/game/index.js';

import { 
    logToConsole, 
    isConsoleVisible, 
    showConsole, 
    hideConsole 
} from './features/console/index.js';

import { loadNews } from './features/news/index.js';
import { startStatusChecker } from './features/server-status/index.js';
import { 
    loadDevCategoryCounts, 
    initDevToolsListeners, 
    applyAdminClass 
} from './features/dev-tools/index.js';

// === Application State ===
let currentConfig = {};

// === Window Controls ===
function initWindowControls() {
    const btnMinimize = dom.get('btn-minimize');
    const btnClose = dom.get('btn-close');
    
    if (btnMinimize) {
        btnMinimize.addEventListener('click', () => {
            window.api.minimize();
        });
    }
    
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            window.api.close();
        });
    }
}

// === Console Toggle ===
function initConsoleToggle() {
    const consoleToggleBtn = dom.get('console-toggle-btn');
    const settingsScreen = dom.get('step-settings');
    
    if (consoleToggleBtn) {
        consoleToggleBtn.addEventListener('click', () => {
            // Easter egg handling
            if (isSettingsEasterEggActive() && getEasterEggStage() === 1) {
                triggerEasterEggStage2();
                return;
            }
            
            if (isSettingsEasterEggActive() && getEasterEggStage() === 2) {
                hideEasterEgg();
                return;
            }
            
            const consoleVisible = isConsoleVisible();
            
            if (consoleVisible) {
                hideConsole();
                document.body.classList.remove('is-admin');
                
                // Hide dev tab if settings open
                const devTab = document.querySelector('.tab-dev');
                if (devTab && settingsScreen && !settingsScreen.classList.contains('hidden')) {
                    devTab.classList.add('hidden');
                    const devTabContent = document.getElementById('tab-dev');
                    if (devTabContent?.classList.contains('active')) {
                        document.querySelector('.tab-btn[data-tab="general"]')?.click();
                    }
                }
            } else {
                showConsole();
                
                // Show dev tab if settings open
                const devTab = document.querySelector('.tab-dev');
                if (devTab && settingsScreen && !settingsScreen.classList.contains('hidden')) {
                    devTab.classList.remove('hidden');
                    loadDevCategoryCounts();
                    
                    const skipSyncCheckbox = document.getElementById('dev-skip-sync-checkbox');
                    if (skipSyncCheckbox && currentConfig) {
                        skipSyncCheckbox.checked = currentConfig.skipSync === true;
                    }
                    
                    applyAdminClass();
                    initDevToolsListeners();
                }
            }
        });
    }
}

// === Settings Button ===
function initSettingsButton() {
    const btnSettings = dom.get('btn-settings');
    const btnCloseSettings = dom.get('btn-close-settings');
    const btnSaveSettings = dom.get('save-settings');
    const settingsScreen = dom.get('step-settings');
    const consoleOutput = dom.get('console-output');
    const titleMainTab = dom.get('title-bar-title');
    
    // Title bar main tab click -> switch to main launcher screen
    if (titleMainTab) {
        titleMainTab.addEventListener('click', () => {
            if (isSettingsAnimating()) return;
            if (settingsScreen && !settingsScreen.classList.contains('hidden') && !settingsScreen.classList.contains('closing')) {
                tryTriggerEasterEgg();
                toggleMainUIVisibility(true, currentConfig);
                closeSettings();
                cancelPendingConfigs();
                const saveBtn = dom.get('save-settings');
                if (saveBtn) saveBtn.classList.remove('visible');
            }
        });
    }
    
    // Open/Toggle settings
    if (btnSettings) {
        btnSettings.addEventListener('click', async () => {
            if (isSettingsAnimating()) return;
            
            // Toggle behavior
            if (settingsScreen && !settingsScreen.classList.contains('hidden') && !settingsScreen.classList.contains('closing')) {
                tryTriggerEasterEgg();
                toggleMainUIVisibility(true, currentConfig);
                closeSettings();
                cancelPendingConfigs();
                const saveBtn = dom.get('save-settings');
                if (saveBtn) saveBtn.classList.remove('visible');
                return;
            }
            
            // Phase 1: Smooth exit of main UI elements & Instant Settings Drop
            toggleMainUIVisibility(false, currentConfig);
            openSettings(currentConfig);
            
            // Hide easter egg after animation if active
            if (isSettingsEasterEggActive()) {
                setTimeout(() => {
                    hideEasterEgg();
                }, 300);
            }
            
            // Update dev tab visibility
            const devTab = document.querySelector('.tab-dev');
            if (devTab) {
                const isConsoleOpen = consoleOutput && !consoleOutput.classList.contains('hidden');
                if (isConsoleOpen) {
                    devTab.classList.remove('hidden');
                    loadDevCategoryCounts();
                } else {
                    devTab.classList.add('hidden');
                    const devTabContent = document.getElementById('tab-dev');
                    if (devTabContent?.classList.contains('active')) {
                        document.querySelector('.tab-btn[data-tab="general"]')?.click();
                    }
                }
            }
        });
    }
    
    // Close settings
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => {
            if (isSettingsAnimating()) return;
            
            tryTriggerEasterEgg();
            toggleMainUIVisibility(true, currentConfig);
            closeSettings();
            cancelPendingConfigs();
            
            const saveBtn = dom.get('save-settings');
            if (saveBtn) saveBtn.classList.remove('visible');
        });
    }
    
    // Save settings
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', async () => {
            const settingsSuccess = await saveSettings();
            const configsSuccess = await savePendingConfigs();
            
            if (settingsSuccess && configsSuccess) {
                currentConfig = getCurrentConfig();
                toggleMainUIVisibility(true, currentConfig);
                closeSettings();
            }
        });
    }
}

// === Loading Progress Helper ===
function updateLoaderStatus(percent, text) {
    const fill = dom.get('loader-progress-fill');
    const statusText = dom.get('loader-status-text');
    const percentText = dom.get('loader-percent-text');
    
    if (fill) fill.style.width = `${percent}%`;
    if (statusText) statusText.innerText = text;
    if (percentText) percentText.innerText = `${percent}%`;
}

function hideLoaderScreen() {
    const loader = dom.get('launcher-loader-screen');
    if (loader) {
        loader.classList.add('loaded');
    }
}

// === Display Version ===
async function displayVersion() {
    try {
        const ver = await window.api.getAppVersion();
        const vDiv = dom.get('app-version');
        if (vDiv) vDiv.innerText = `v${ver}`;
    } catch (e) { 
        console.error('Failed to get version', e); 
    }
}

// === Main Initialization ===
async function init() {
    logToConsole('[LAUNCHER] Client initializing...');
    updateLoaderStatus(10, 'Загрузка конфигурации...');
    
    // 1. Load config
    currentConfig = await window.api.loadConfig();
    setCurrentConfig(currentConfig);
    
    updateLoaderStatus(25, 'Инициализация графических эффектов...');
    // 2. Init visual effects
    await initAllEffects(currentConfig);
    initEasterEgg();
    
    updateLoaderStatus(45, 'Подготовка интерфейса и настроек...');
    // 3. Init UI handlers & Pre-populate settings fields
    initWindowControls();
    initConsoleToggle();
    initSettingsButton();
    initAuthHandlers();
    initProgressHandlers();
    initGameButtons();
    initSettingsTabs(currentConfig);
    initPathSelectors();
    initReinstallButton();
    initModsButtons();
    setupSettingsChangeListeners();
    
    // Предзаполнение всех полей настроек и RAM слайдера в DOM
    populateSettingsFields(currentConfig);
    
    // Display version
    await displayVersion();
    
    updateLoaderStatus(65, 'Проверка авторизации...');
    // Mock auth: seed localStorage before checking saved auth
    if (window.api.isMockAuth) {
        localStorage.setItem('auth_user', 'TestAdmin');
        localStorage.setItem('auth_token', 'mock-token');
        localStorage.setItem('is_admin', 'true');
        console.log('[MOCK_AUTH] Seeded localStorage as TestAdmin (admin)');
    }

    // 4. Check saved auth
    await checkSavedAuth();
    
    updateLoaderStatus(80, 'Загрузка манифеста модов...');
    // 5. Предзагрузка модов в память для мгновенного открытия в настройках
    await loadModsList(currentConfig.disabledMods || [], currentConfig);
    
    // Предзагрузка конфигураций
    await loadConfigsList();

    captureInitialSettingsState();

    updateLoaderStatus(90, 'Загрузка новостей и сервера...');
    // 6. Load news and start status checker
    await Promise.allSettled([
        loadNews(),
        new Promise(resolve => {
            startStatusChecker();
            setTimeout(resolve, 150);
        })
    ]);
    
    updateLoaderStatus(98, 'Прогрев графического движка...');
    // 7. Прогрев GPU-слоев и макета настроек в фоновом режиме
    const settingsScreen = dom.get('step-settings');
    if (settingsScreen) {
        settingsScreen.style.visibility = 'hidden';
        settingsScreen.classList.remove('hidden');
        void settingsScreen.offsetWidth; // Принудительный расчет макета Chromium
        settingsScreen.classList.add('hidden');
        settingsScreen.style.visibility = '';
    }

    updateLoaderStatus(100, 'Готово!');
    logToConsole('[LAUNCHER] Initialization complete. All modules pre-loaded.');
    
    // Smoothly fade out splash loading screen
    setTimeout(hideLoaderScreen, 300);
}

// === Start Application ===
init().catch(e => {
    console.error('[LAUNCHER] Initialization failed:', e);
    logToConsole(`[ERROR] Initialization failed: ${e.message}`);
});

// === Export for potential testing ===
export { init, currentConfig };
