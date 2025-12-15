const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    launchGame: (options) => ipcRenderer.invoke('launch-game', options),
    // Функция для запроса к нашему API серверу (Python API)
    requestAuth: async (username) => {
        // Используем реальный адрес сервера вместо localhost
        try {
            const response = await fetch('https://ganjacraft.ru/api/launcher/auth/request', {
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
            const response = await fetch('https://ganjacraft.ru/api/launcher/auth/verify', {
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
            const response = await fetch('https://ganjacraft.ru/api/launcher/auth/check', {
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
        const response = await fetch('https://ganjacraft.ru/api/news?limit=5');
        return response.json();
    },
    onLog: (callback) => ipcRenderer.on('log-message', (event, text) => callback(text)),
    minimize: () => ipcRenderer.send('window-minimize'),
    close: () => ipcRenderer.send('window-close'),
    
    // Settings & Config
    loadConfig: () => ipcRenderer.invoke('load-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    selectPath: (type) => ipcRenderer.invoke('select-path', type), // type: 'dir' or 'file'
    
    // Advanced
    reinstallClient: () => ipcRenderer.invoke('reinstall-client'),
    getManifest: () => ipcRenderer.invoke('get-manifest'), // To list mods in UI
    
    // Events
    onGameClosed: (callback) => ipcRenderer.on('game-closed', () => callback())
});
