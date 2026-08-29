/**
 * GanjaCraft Launcher - Settings Feature Index
 */

export {
    getCurrentSettingsState,
    settingsChanged,
    updateSaveButtonVisibility,
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
    switchTab,
    updateHeaderControlsForTab
} from './settings.js';

export {
    triggerSettingsEasterEgg,
    triggerEasterEggStage2,
    hideEasterEgg,
    isSettingsEasterEggActive,
    getEasterEggStage,
    tryTriggerEasterEgg
} from './easter-egg.js';

export {
    initRamSlider
} from './ram-slider.js';
