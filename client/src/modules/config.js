const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_FILE = path.join(app.getPath('appData'), '.ganjacraft', 'launcher_config.json');

function getDefaultConfig() {
    return {
        // Setup flags
        isDefault: true,
        // Separate flag: whether we already applied default mod toggles at least once.
        // This must NOT be coupled to isDefault, because the install-path wizard sets isDefault=false.
        modsDefaultsApplied: false,

        // General
        installPath: path.join(app.getPath('appData'), '.ganjacraft'),
        javaPath: '', // Empty = auto-detect
        memoryMin: '2G',
        memoryMax: '6G',
        hideOnPlay: true,
        enableSnow: true, // Default snow effect
        debugMode: false, // Default debug mode off

        // Mods
        disabledMods: [] // List of paths to skip
    };
}

function normalizeLoadedConfig(config) {
    const defaults = getDefaultConfig();
    const hasObj = config && typeof config === 'object';
    const merged = { ...defaults, ...(hasObj ? config : {}) };

    // IMPORTANT: isDefault is only for the very first run when the config file doesn't exist.
    // If a persisted config is missing isDefault (e.g. older versions or UI save), treat it as false.
    if (hasObj && !Object.prototype.hasOwnProperty.call(config, 'isDefault')) {
        merged.isDefault = false;
    } else {
        merged.isDefault = merged.isDefault === true;
    }

    if (!Array.isArray(merged.disabledMods)) {
        merged.disabledMods = [];
    }

    // Migration for older configs (before modsDefaultsApplied existed).
    // We assume existing users already chose their mod state, so don't suddenly disable anything.
    if (!Object.prototype.hasOwnProperty.call(merged, 'modsDefaultsApplied')) {
        merged.modsDefaultsApplied = true;
    }

    return merged;
}

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            return normalizeLoadedConfig(parsed);
        }
    } catch (e) { console.error("Config load error:", e); }
    
    return getDefaultConfig();
}

function saveConfig(config) {
    try {
        const normalized = normalizeLoadedConfig(config);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(normalized, null, 4));
        return true;
    } catch (e) {
        console.error("Config save error:", e);
        return false;
    }
}

module.exports = { loadConfig, saveConfig };
