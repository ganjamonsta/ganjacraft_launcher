/**
 * GanjaCraft Launcher - Game Module Index
 * Экспорт всех игровых модулей
 */

const { launchGame, cancelLaunch, getIsGameRunning } = require('./launcher');
const { repairCriticalFiles } = require('./repair');
const { ensureVanillaVersionFiles, preflightNeoForgeLibraries, preflightForgeLibraries, rewriteKnownUrl, rewriteVersionJsonUrls } = require('./neoforge');
const { isZipIntact, cleanZeroByteFiles, assertDirectoryWritable, ensureWritableFilePath } = require('./integrity');

module.exports = {
    // Launcher
    launchGame,
    cancelLaunch,
    getIsGameRunning,
    
    // Repair
    repairCriticalFiles,
    
    // NeoForge
    ensureVanillaVersionFiles,
    preflightNeoForgeLibraries,
    preflightForgeLibraries,
    rewriteKnownUrl,
    rewriteVersionJsonUrls,
    
    // Integrity
    isZipIntact,
    cleanZeroByteFiles,
    assertDirectoryWritable,
    ensureWritableFilePath,
};
