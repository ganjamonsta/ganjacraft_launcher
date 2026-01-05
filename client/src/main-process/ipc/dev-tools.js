/**
 * GanjaCraft Launcher - Dev Tools IPC Handlers
 * Обработчики инструментов разработчика
 */

const { ipcMain } = require('electron');
const { loadConfig } = require('../../modules/config');
const { syncCategory, deleteCategory, getCategoryCounts, fetchServerScripts } = require('../../modules/updater');
const { MANIFEST_URL } = require('../constants');

// Track active operations for cancellation
const activeDevOperations = new Map();

/**
 * Зарегистрировать обработчики dev tools
 * @param {BrowserWindow} mainWindow - Главное окно
 */
function registerDevToolsHandlers(mainWindow) {
    // Cancel operation
    ipcMain.on('dev-cancel-operation', (event, category) => {
        const controller = activeDevOperations.get(category);
        if (controller) {
            controller.abort();
            activeDevOperations.delete(category);
        }
    });
    
    // Sync specific category
    ipcMain.handle('dev-sync-category', async (event, category, options = {}) => {
        const config = loadConfig();
        const rootPath = config.installPath;
        
        const abortController = new AbortController();
        activeDevOperations.set(category, abortController);
        
        const sendProgress = (msg) => {
            if (event.sender && !event.sender.isDestroyed()) {
                if (typeof msg === 'object' && msg.type === 'counter-update') {
                    event.sender.send('dev-progress', { 
                        category, 
                        message: msg.message,
                        localCount: msg.localCount,
                        manifestCount: msg.manifestCount
                    });
                } else {
                    event.sender.send('dev-progress', { category, message: msg });
                }
            }
        };
        
        try {
            const result = await syncCategory(rootPath, MANIFEST_URL, category, {
                force: options.force || false,
                kubejsFolders: options.kubejsFolders || ['client_scripts', 'startup_scripts', 'server_scripts'],
                sendLog: sendProgress,
                abortSignal: abortController.signal
            });
            return { success: true, ...result };
        } catch (e) {
            if (e.name === 'AbortError' || abortController.signal.aborted) {
                return { success: false, error: 'Операция отменена', cancelled: true };
            }
            return { success: false, error: e.message };
        } finally {
            activeDevOperations.delete(category);
        }
    });
    
    // Delete category files
    ipcMain.handle('dev-delete-category', async (event, category) => {
        const config = loadConfig();
        const rootPath = config.installPath;
        
        try {
            const result = await deleteCategory(rootPath, category);
            return { success: true, ...result };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
    
    // Get file counts for each category
    ipcMain.handle('dev-get-category-counts', async () => {
        const config = loadConfig();
        const rootPath = config.installPath;
        
        try {
            const counts = await getCategoryCounts(rootPath, MANIFEST_URL);
            return { success: true, counts };
        } catch (e) {
            return { success: false, error: e.message, counts: {} };
        }
    });
    
    // Fetch server_scripts (admin-only)
    ipcMain.handle('dev-fetch-server-scripts', async (event) => {
        const config = loadConfig();
        const rootPath = config.installPath;
        
        const sendProgress = (msg) => {
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('dev-progress', { category: 'server-scripts', message: msg });
            }
        };
        
        try {
            // Use player's auth token (if admin)
            const token = await mainWindow?.webContents.executeJavaScript(
                "localStorage.getItem('auth_token')"
            ).catch(() => null);
            
            if (!token) {
                sendProgress('Ошибка: Токен авторизации не найден');
                return { success: false, error: 'Токен авторизации не найден' };
            }
            
            sendProgress('Токен получен, запрос манифеста...');
            const result = await fetchServerScripts(rootPath, MANIFEST_URL, sendProgress, token);
            return result;
        } catch (e) {
            sendProgress(`Ошибка: ${e.message}`);
            return { success: false, error: e.message };
        }
    });
}

module.exports = {
    registerDevToolsHandlers,
};
