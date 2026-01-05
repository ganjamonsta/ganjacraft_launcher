/**
 * GanjaCraft Launcher - Updater Module
 * Главный файл модуля обновления
 * 
 * Экспортирует все функции для обратной совместимости
 * с существующим кодом лаунчера
 */

// Утилиты
const { getFileHash, resolveUnderRoot, safeUnlink, ensureDir, getTempPath } = require('./utils');

// Загрузка файлов
const { downloadFile } = require('./download');

// Синхронизация
const { syncFiles, isServerControlled, isUserProtected, FILE_CATEGORIES } = require('./sync');

// Очистка
const { 
    cleanDirectory,
    cleanupMods,
    cleanupKubejs,
    cleanupThingpacks,
    cleanupResourcepacks,
    cleanupFancymenu,
    cleanupAll
} = require('./cleanup');

// Админские инструменты
const { syncCategory, deleteCategory, getCategoryCounts, fetchServerScripts } = require('./admin');

// Обратная совместимость: экспортируем то же API что и раньше
module.exports = {
    // Основные функции (были в оригинальном updater.js)
    downloadFile,
    getFileHash,
    syncFiles,
    syncCategory,
    deleteCategory,
    getCategoryCounts,
    fetchServerScripts,
    
    // Новые функции
    resolveUnderRoot,
    safeUnlink,
    ensureDir,
    getTempPath,
    isServerControlled,
    isUserProtected,
    FILE_CATEGORIES,
    
    // Cleanup функции
    cleanDirectory,
    cleanupMods,
    cleanupKubejs,
    cleanupThingpacks,
    cleanupResourcepacks,
    cleanupFancymenu,
    cleanupAll
};
