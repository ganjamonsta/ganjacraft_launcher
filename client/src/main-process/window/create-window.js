/**
 * Ganj4Craft Launcher - Window Creation
 * Создание и настройка главного окна
 */

const { BrowserWindow, app } = require('electron');
const path = require('path');
const { registerAllHandlers } = require('../ipc');

let mainWindow = null;

/**
 * Получить главное окно
 */
function getMainWindow() {
    return mainWindow;
}

/**
 * Создать главное окно приложения
 */
function createWindow() {
    // Путь к preload.js относительно корня приложения
    const preloadPath = path.join(app.getAppPath(), 'src', 'preload.js');
    
    mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        frame: false, // Custom title bar
        backgroundColor: '#121212',
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Загружаем файл ОТНОСИТЕЛЬНО рабочей директории - критично для localStorage!
    // Абсолютный путь = другой origin = потеря данных
    mainWindow.loadFile('src/index.html');
    
    // Block DevTools and fullscreen hotkeys
    mainWindow.webContents.on('before-input-event', (event, input) => {
        const key = input && input.key;
        
        // Block DevTools: F12, Ctrl+Shift+I
        if (key === 'F12' || (input.control && input.shift && key.toLowerCase() === 'i')) {
            event.preventDefault();
            return;
        }
        
        // Block fullscreen hotkeys (Chromium default)
        if (key === 'F11' || (input.alt && (key === 'Enter' || key === 'Return'))) {
            event.preventDefault();
        }
    });

    // Hard-block maximize/fullscreen
    mainWindow.on('maximize', () => {
        try { mainWindow.unmaximize(); } catch (_) {}
    });
    
    mainWindow.on('enter-full-screen', () => {
        try { mainWindow.setFullScreen(false); } catch (_) {}
    });

    // Flush session storage before close to ensure localStorage persists
    mainWindow.on('close', async (e) => {
        try {
            // Force Chromium to flush localStorage to disk
            await mainWindow.webContents.session.flushStorageData();
            console.log('[DEBUG] Session storage flushed');
        } catch (err) {
            console.error('[DEBUG] Failed to flush storage:', err);
        }
    });

    // Register all IPC handlers
    registerAllHandlers(mainWindow);
    
    return mainWindow;
}

module.exports = {
    createWindow,
    getMainWindow,
};
