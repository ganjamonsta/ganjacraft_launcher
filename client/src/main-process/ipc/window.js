/**
 * Ganj4Craft Launcher - Window IPC Handlers
 * Обработчики управления окном
 */

const { ipcMain, Menu, BrowserWindow } = require('electron');

/**
 * Зарегистрировать обработчики управления окном
 * @param {BrowserWindow} mainWindow - Главное окно
 */
function registerWindowHandlers(mainWindow) {
    // Minimize window
    ipcMain.on('window-minimize', () => {
        mainWindow.minimize();
    });
    
    // Window restore event
    mainWindow.on('restore', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('window-restore');
        }
    });

    // Window focus event
    mainWindow.on('focus', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('window-focus');
        }
    });
    
    // Close window
    ipcMain.on('window-close', () => {
        mainWindow.close();
    });
    
    // Context menu (copy)
    ipcMain.on('show-context-menu', (event) => {
        const template = [
            {
                label: 'Копировать',
                role: 'copy',
            }
        ];
        const menu = Menu.buildFromTemplate(template);
        menu.popup(BrowserWindow.fromWebContents(event.sender));
    });
}

module.exports = {
    registerWindowHandlers,
};
