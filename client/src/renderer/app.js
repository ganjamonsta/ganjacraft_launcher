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
                const saveBtn = dom.get('save-settings');
                if (saveBtn) saveBtn.classList.remove('visible');
                return;
            }
            
            toggleMainUIVisibility(false, currentConfig);
            
            // Hide easter egg after animation if active
            if (isSettingsEasterEggActive()) {
                setTimeout(() => {
                    hideEasterEgg();
                }, 300);
            }

            // Open settings screen immediately for 60fps instant response
            openSettings(currentConfig);
            
            // Asynchronously load config & populate fields in background
            window.api.loadConfig().then(async (config) => {
                currentConfig = config;
                setCurrentConfig(currentConfig);
                
                // Populate fields
                populateSettingsFields(currentConfig);
                
                // Load mods in background
                await loadModsList(currentConfig.disabledMods || [], currentConfig);
                
                // Show/hide dev tab
                const devTab = document.querySelector('.tab-dev');
                if (devTab) {
                    const isConsoleOpen = consoleOutput && !consoleOutput.classList.contains('hidden');
                    if (isConsoleOpen) {
                        devTab.classList.remove('hidden');
                        loadDevCategoryCounts();
                        
                        const skipSyncCheckbox = document.getElementById('dev-skip-sync-checkbox');
                        if (skipSyncCheckbox) {
                            skipSyncCheckbox.checked = currentConfig.skipSync === true;
                        }
                        
                        applyAdminClass();
                        initDevToolsListeners();
                    } else {
                        devTab.classList.add('hidden');
                        
                        const devTabContent = document.getElementById('tab-dev');
                        if (devTabContent?.classList.contains('active')) {
                            document.querySelector('.tab-btn[data-tab="general"]')?.click();
                        }
                    }
                }
                
                // Capture initial state after mods load
                captureInitialSettingsState();
            });
        });
    }
    
    // Close settings
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => {
            if (isSettingsAnimating()) return;
            
            tryTriggerEasterEgg();
            toggleMainUIVisibility(true, currentConfig);
            closeSettings();
            
            const saveBtn = dom.get('save-settings');
            if (saveBtn) saveBtn.classList.remove('visible');
        });
    }
    
    // Save settings
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', async () => {
            const success = await saveSettings();
            if (success) {
                currentConfig = getCurrentConfig();
                toggleMainUIVisibility(true, currentConfig);
                closeSettings();
            }
        });
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
    logToConsole('[LAUNCHER] Client initialized.');
    
    // Load config
    currentConfig = await window.api.loadConfig();
    setCurrentConfig(currentConfig);
    
    // Init visual effects
    await initAllEffects(currentConfig);
    initEasterEgg();
    
    // Init UI handlers
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
    
    // Display version
    await displayVersion();
    
    // Mock auth: seed localStorage before checking saved auth
    if (window.api.isMockAuth) {
        localStorage.setItem('auth_user', 'TestAdmin');
        localStorage.setItem('auth_token', 'mock-token');
        localStorage.setItem('is_admin', 'true');
        console.log('[MOCK_AUTH] Seeded localStorage as TestAdmin (admin)');
    }

    // Check saved auth
    await checkSavedAuth();
    
    // Delay news loading
    setTimeout(loadNews, 1500);
    
    // Start server status checker
    startStatusChecker();
    
    logToConsole('[LAUNCHER] Initialization complete.');
}

// === Start Application ===
init().catch(e => {
    console.error('[LAUNCHER] Initialization failed:', e);
    logToConsole(`[ERROR] Initialization failed: ${e.message}`);
});

// === Export for potential testing ===
export { init, currentConfig };
