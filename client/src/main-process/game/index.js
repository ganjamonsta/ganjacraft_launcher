/**
 * GanjaCraft Launcher - Game Module Index
 * Экспорт всех игровых модулей
 */

const { launchGame, cancelLaunch, getIsGameRunning } = require('./launcher');

module.exports = {
    // Launcher
    launchGame,
    cancelLaunch,
    getIsGameRunning,
};
