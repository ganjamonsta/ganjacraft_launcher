/**
 * GanjaCraft Launcher - Updater IPC Handlers
 * Обработчики IPC для нативных обновлений лаунчера
 */
const { ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

/**
 * Регистрация обработчиков для обновления
 */
function registerUpdaterHandlers() {
    ipcMain.handle('download-update', async () => {
        try {
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch (error) {
            console.error('Error downloading update:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('install-update', () => {
        try {
            autoUpdater.quitAndInstall();
        } catch (error) {
            console.error('Error installing update:', error);
        }
    });
}

module.exports = {
    registerUpdaterHandlers
};
