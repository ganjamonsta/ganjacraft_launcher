/**
 * GanjaCraft Launcher - Main Entry Point
 * Точка входа приложения (рефакторинг Stage 2)
 * 
 * Вся логика вынесена в модули:
 * - main-process/constants.js - константы
 * - main-process/window/ - создание окна
 * - main-process/ipc/ - IPC обработчики
 * - main-process/game/ - логика запуска игры
 */

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Override userData path to keep everything in .ganjacraft
const appDataPath = app.getPath('appData');
const customUserDataPath = path.join(appDataPath, '.ganjacraft', 'launcher-data');
if (!fs.existsSync(customUserDataPath)) {
    fs.mkdirSync(customUserDataPath, { recursive: true });
}
app.setPath('userData', customUserDataPath);

// Modules
const { loadConfig, saveConfig } = require('./modules/config');
const { createWindow } = require('./main-process/window');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            const win = windows[0];
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });
}

// App Ready
app.whenReady().then(async () => {
    // First Run / Setup Wizard
    let config = loadConfig();
    
    if (config.isDefault) {
        const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Выбрать папку установки (Рекомендуется)', 'По умолчанию (%AppData%)'],
            defaultId: 0,
            cancelId: 1,
            title: 'Настройка установки GanjaCraft',
            message: 'Выберите место для установки игры.',
            detail: 'Windows часто блокирует файлы в папке AppData. \nДля избежания ошибок "EPERM" и проблем с антивирусом, выберите папку на диске, например C:\\Games\\GanjaCraft.'
        });

        if (response === 0) {
            const result = await dialog.showOpenDialog({
                title: 'Выберите папку для установки GanjaCraft',
                defaultPath: 'C:\\Games',
                properties: ['openDirectory', 'createDirectory']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                config.installPath = result.filePaths[0];
                config.isDefault = false;
                config.modsDefaultsApplied = false;
                saveConfig(config);
            } else {
                config.isDefault = false;
                config.modsDefaultsApplied = false;
                saveConfig(config);
            }
        } else {
            config.isDefault = false;
            config.modsDefaultsApplied = false;
            saveConfig(config);
        }
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
