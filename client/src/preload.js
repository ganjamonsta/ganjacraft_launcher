const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    launchGame: (options) => ipcRenderer.invoke('launch-game', options),
    // Функция для запроса к нашему API серверу (Python API)
    requestAuth: async (username) => {
        // Используем реальный адрес сервера вместо localhost
        const response = await fetch('https://ganjacraft.ru/api/launcher/auth/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        return response.json();
    },
    verifyAuth: async (username, code) => {
        const response = await fetch('https://ganjacraft.ru/api/launcher/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, code })
        });
        return response.json();
    },
    onLog: (callback) => ipcRenderer.on('log-message', (event, text) => callback(text))
});
