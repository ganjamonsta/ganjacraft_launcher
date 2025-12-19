const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_FILE = path.join(app.getPath('appData'), '.ganjacraft', 'launcher_config.json');

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    } catch (e) { console.error("Config load error:", e); }
    
    // Defaults
    return {
        isDefault: true,
        installPath: path.join(app.getPath('appData'), '.ganjacraft'),
        javaPath: '', // Empty = auto-detect
        memoryMin: '2G',
        memoryMax: '6G',
        hideOnPlay: true,
        enableSnow: true, // Default snow effect
        disabledMods: [] // List of paths to skip
    };
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4));
        return true;
    } catch (e) {
        console.error("Config save error:", e);
        return false;
    }
}

module.exports = { loadConfig, saveConfig };
