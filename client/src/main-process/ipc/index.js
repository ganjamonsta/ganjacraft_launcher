/**
 * GanjaCraft Launcher - IPC Handlers Index
 * Регистрация всех IPC обработчиков
 */

const { registerWindowHandlers } = require('./window');
const { registerConfigHandlers } = require('./config');
const { registerDevToolsHandlers } = require('./dev-tools');
const { registerGameHandlers } = require('./game');
const { registerModConfigHandlers } = require('./mod-config-ipc');

/**
 * Зарегистрировать все IPC обработчики
 * @param {BrowserWindow} mainWindow - Главное окно
 */
function registerAllHandlers(mainWindow) {
    registerWindowHandlers(mainWindow);
    registerConfigHandlers(mainWindow);
    registerDevToolsHandlers(mainWindow);
    registerGameHandlers();
    registerModConfigHandlers();
}

module.exports = {
    registerAllHandlers,
    registerWindowHandlers,
    registerConfigHandlers,
    registerDevToolsHandlers,
    registerGameHandlers,
    registerModConfigHandlers,
};
