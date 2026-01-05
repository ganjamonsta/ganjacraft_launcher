/**
 * GanjaCraft Launcher - Main Process Index
 * Экспорт всех модулей main process
 */

const constants = require('./constants');
const { createWindow, getMainWindow } = require('./window');
const { registerAllHandlers } = require('./ipc');
const game = require('./game');

module.exports = {
    constants,
    createWindow,
    getMainWindow,
    registerAllHandlers,
    game,
};
