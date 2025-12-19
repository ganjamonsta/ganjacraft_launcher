const { contextBridge, ipcRenderer } = require('electron');

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 5000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

contextBridge.exposeInMainWorld('api', {
    launchGame: (options) => ipcRenderer.invoke('launch-game', options),
    // Функция для запроса к нашему API серверу (Python API)
    requestAuth: async (username) => {
        // Используем реальный адрес сервера вместо localhost
        try {
            const response = await fetchWithTimeout('https://ganjacraft.ru/api/launcher/auth/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API Error: ${response.status} - ${text}`);
            }
            return response.json();
        } catch (e) {
            throw new Error(e.message);
        }
    },
    verifyAuth: async (username, code) => {
        try {
            const response = await fetchWithTimeout('https://ganjacraft.ru/api/launcher/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, code })
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API Error: ${response.status} - ${text}`);
            }
            return response.json();
        } catch (e) {
            throw new Error(e.message);
        }
    },
    checkAuth: async (username, token) => {
        try {
            const response = await fetchWithTimeout('https://ganjacraft.ru/api/launcher/auth/check', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Auth-Token': token
                },
                body: JSON.stringify({ username })
            });
            if (!response.ok) {
                // Don't throw here, just return success: false, as this is a background check
                return { success: false, message: `API Error: ${response.status}` };
            }
            return response.json();
        } catch (e) {
            return { success: false, message: e.message };
        }
    },
    getNews: async () => {
        try {
            const response = await fetchWithTimeout('https://ganjacraft.ru/api/news?limit=5');
            return response.json();
        } catch (e) {
            return { success: false, error: e.message, news: [] };
        }
    },
    onLog: (callback) => ipcRenderer.on('log-message', (event, text) => callback(text)),
    onProgress: (callback) => ipcRenderer.on('progress', (event, e) => callback(e)),
    minimize: () => ipcRenderer.send('window-minimize'),
    close: () => ipcRenderer.send('window-close'),
    
    // Settings & Config
    loadConfig: () => ipcRenderer.invoke('load-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    selectPath: (type) => ipcRenderer.invoke('select-path', type), // type: 'dir' or 'file'
    openFolder: (path) => ipcRenderer.invoke('open-folder', path),
    openUrl: (url) => ipcRenderer.invoke('open-url', url),
    
    // Advanced
    reinstallClient: () => ipcRenderer.invoke('reinstall-client'),
    getManifest: () => ipcRenderer.invoke('get-manifest'), // To list mods in UI
    
    // Events
    onGameClosed: (callback) => ipcRenderer.on('game-closed', () => callback()),
    
    cancelLaunch: () => ipcRenderer.invoke('cancel-launch'),
    showContextMenu: () => ipcRenderer.send('show-context-menu')
});
