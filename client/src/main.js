const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Override userData path to keep everything in .ganjacraft
const appDataPath = app.getPath('appData');
const customUserDataPath = path.join(appDataPath, '.ganjacraft', 'launcher-data');
if (!fs.existsSync(customUserDataPath)) {
    fs.mkdirSync(customUserDataPath, { recursive: true });
}
app.setPath('userData', customUserDataPath);

// Enable overlay scrollbars in Chromium engine
app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');

const { createWindow, getMainWindow } = require('./main-process');
const { autoUpdater } = require('electron-updater');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const win = getMainWindow() || BrowserWindow.getAllWindows()[0];
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();

        // Check for updates
        autoUpdater.checkForUpdatesAndNotify();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
