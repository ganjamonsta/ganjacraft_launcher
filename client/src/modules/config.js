const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Store config under userData so it follows app.setPath('userData', ...) in the main process.
// This prevents config loss when the launcher relocates its data directory and improves write reliability on Windows.
const CONFIG_FILE = path.join(app.getPath('userData'), 'launcher_config.json');

// Legacy location (older builds stored config next to .ganjacraft root).
const LEGACY_CONFIG_FILE = path.join(app.getPath('appData'), '.ganjacraft', 'launcher_config.json');

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
        enableSnow: true, // Default snow effect (legacy compatibility)
        effectsPreset: 'auto', // 'auto' | 'snow' | 'leaves' | 'sakura' | 'fireflies' | 'ganja' | 'off'
        effectsDensity: 'medium', // 'low' | 'medium' | 'high'
        enableSmoke: true, // Default smoke effect
        enableParallax: true, // Default parallax background
        debugMode: false, // Default debug mode off
        skipSync: false, // Skip file sync on launch (debug feature)

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
    // IMPORTANT: check the original loaded object, not `merged` (defaults always include the key).
    if (hasObj && !Object.prototype.hasOwnProperty.call(config, 'modsDefaultsApplied')) {
        merged.modsDefaultsApplied = true;
    }

    // Migration: Split effects settings
    if (!Object.prototype.hasOwnProperty.call(merged, 'enableSmoke')) {
        merged.enableSmoke = merged.enableSnow;
    }
    if (!Object.prototype.hasOwnProperty.call(merged, 'enableParallax')) {
        merged.enableParallax = true;
    }
    if (!Object.prototype.hasOwnProperty.call(merged, 'effectsPreset')) {
        merged.effectsPreset = merged.enableSnow === false ? 'off' : 'auto';
    }
    if (!Object.prototype.hasOwnProperty.call(merged, 'effectsDensity')) {
        merged.effectsDensity = 'medium';
    }

    return merged;
}

function loadConfig() {
    try {
        // Prefer new location.
        if (fs.existsSync(CONFIG_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            return normalizeLoadedConfig(parsed);
        }

        // Migrate from legacy location once.
        if (fs.existsSync(LEGACY_CONFIG_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(LEGACY_CONFIG_FILE, 'utf-8'));
            const normalized = normalizeLoadedConfig(parsed);
            // Best-effort write into the new location.
            try {
                const dir = path.dirname(CONFIG_FILE);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(normalized, null, 4));
            } catch (_) {
                // ignore migration write errors; we can still return the parsed config
            }
            return normalized;
        }
    } catch (e) { console.error("Config load error:", e); }
    
    return getDefaultConfig();
}

function saveConfig(config) {
    try {
        const normalized = normalizeLoadedConfig(config);
        const dir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Atomic-ish write to avoid partially-written JSON (which would cause settings to reset on next load).
        const tmpPath = `${CONFIG_FILE}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        fs.writeFileSync(tmpPath, JSON.stringify(normalized, null, 4));
        fs.renameSync(tmpPath, CONFIG_FILE);
        return true;
    } catch (e) {
        console.error("Config save error:", e);
        return false;
    }
}

module.exports = { loadConfig, saveConfig };
