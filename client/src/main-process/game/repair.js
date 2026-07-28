/**
 * GanjaCraft Launcher - Critical Files Repair
 * Восстановление критичных файлов игры
 */

const fs = require('fs');
const path = require('path');
const { downloadFile } = require('../../modules/updater');
const { isZipIntact } = require('./integrity');
const { 
    NEOFORGE_VERSION, 
    MC_VERSION, 
    REPAIR_FILES 
} = require('../constants');

/**
 * Восстановить критичные файлы игры
 * @param {string} rootPath - Корневой путь установки
 * @param {Function} sendLog - Функция логирования
 * @param {Function} sendDebug - Функция дебаг-логирования
 */
async function repairCriticalFiles(rootPath, sendLog, sendDebug) {
    const criticalChecks = [
        {
            name: 'Authlib Injector',
            path: path.join(rootPath, 'authlib-injector.jar'),
            url: REPAIR_FILES['authlib-injector.jar'],
        },
        {
            name: 'NeoForge Installer',
            path: path.join(rootPath, `neoforge-${NEOFORGE_VERSION}-installer.jar`),
            url: REPAIR_FILES['neoforge-installer.jar'],
        },
        {
            name: `Minecraft ${MC_VERSION}`,
            path: path.join(rootPath, 'versions', MC_VERSION, `${MC_VERSION}.jar`),
            url: REPAIR_FILES['vanilla-client.jar'],
        },
    ];

    for (const file of criticalChecks) {
        const isOk = fs.existsSync(file.path) && (await isZipIntact(file.path));
        
        if (!isOk) {
            sendLog(`⚠️ Восстанавливаю ${file.name}...`);
            sendDebug(`Repair: ${file.name} missing or corrupt, downloading from ${file.url}`);
            
            try {
                // Ensure dir exists
                const dir = path.dirname(file.path);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                // Delete old corrupt file if it exists
                try { fs.unlinkSync(file.path); } catch {}
                
                // Download with timeout
                await downloadFile(file.url, file.path, { timeoutMs: 120_000 });
                
                // Verify integrity
                if (!(await isZipIntact(file.path))) {
                    try { fs.unlinkSync(file.path); } catch {}
                    throw new Error(`Downloaded file is not a valid JAR/ZIP (truncated or corrupted)`);
                }
                
                sendLog(`✓ ${file.name} восстановлен`);
                sendDebug(`Repair: ${file.name} OK`);
            } catch (e) {
                sendDebug(`Repair failed for ${file.name}: ${e.message}`);
                throw new Error(
                    `Не удалось восстановить ${file.name}.\n` +
                    `Ошибка: ${e.message}\n\n` +
                    `Проверьте подключение к интернету и попробуйте снова.`
                );
            }
        } else {
            sendDebug(`Repair: ${file.name} OK (integrity verified)`);
        }
    }
}

module.exports = {
    repairCriticalFiles,
};
