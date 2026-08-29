/**
 * Ganj4Craft Launcher - Main Application Entry Point
 * Точка входа для renderer process
 */

// === Core Imports ===
import { dom } from './utils/dom.js';

// === UI Imports ===
import { customConfirm, customAlert, showError, showNotification } from './ui/modals.js';
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
    switchTab,
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
import { initChangelog, loadChangelogHistory, isChangelogOpen, closeChangelogScreen } from './features/changelog/index.js';

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

// === Auto-Updater ===
function initUpdaterHandlers() {
    if (window.api.onUpdateAvailable) {
        window.api.onUpdateAvailable(async (info) => {
            const version = info?.version || '';
            const msg = version ? `Доступна новая версия лаунчера (v${version}). Скачать сейчас?` : 'Доступна новая версия лаунчера. Скачать сейчас?';
            const shouldDownload = await customConfirm(msg, 'Доступно обновление');
            if (shouldDownload) {
                window.api.downloadUpdate();
                showNotification('Загрузка обновления началась...', 'info', 'Обновление', 4000);
            }
        });

        window.api.onUpdateDownloaded(async () => {
            const shouldInstall = await customConfirm('Обновление успешно загружено. Перезапустить лаунчер для установки?', 'Обновление готово');
            if (shouldInstall) {
                window.api.installUpdate();
            }
        });
    }
}

// === Console Toggle ===
function initConsoleToggle() {
    const consoleToggleBtn = dom.get('console-toggle-btn');
    
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
            } else {
                showConsole();
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

            // Если панель открыта на любой вкладке — сразу закрываем её
            if (settingsScreen && !settingsScreen.classList.contains('hidden') && !settingsScreen.classList.contains('closing')) {
                tryTriggerEasterEgg();
                closeSettings();
                cancelPendingConfigs();
                const saveBtn = dom.get('save-settings');
                if (saveBtn) saveBtn.classList.remove('visible');
                return;
            }
            
            // Открываем панель на вкладке 'general'
            openSettings('general');
            
            // Hide easter egg after animation if active
            if (isSettingsEasterEggActive()) {
                setTimeout(() => {
                    hideEasterEgg();
                }, 300);
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
    initUpdaterHandlers();
    initConsoleToggle();
    initSettingsButton();
    initChangelog();
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
    // 6. Load news, changelog and start status checker
    await Promise.allSettled([
        loadNews(),
        loadChangelogHistory(),
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
