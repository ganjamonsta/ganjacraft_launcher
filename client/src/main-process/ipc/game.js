/**
 * GanjaCraft Launcher - Game IPC Handlers
 * Обработчики запуска игры
 */

const { ipcMain } = require('electron');
const { launchGame, cancelLaunch } = require('../game/launcher');

/**
 * Зарегистрировать обработчики игры
 */
function registerGameHandlers() {
    // Cancel launch
    ipcMain.handle('cancel-launch', () => {
        return cancelLaunch();
    });
    
    // Launch game
    ipcMain.handle('launch-game', async (event, options) => {
        return launchGame(event, options);
    });
}

module.exports = {
    registerGameHandlers,
};
