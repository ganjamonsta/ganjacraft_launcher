/**
 * Ganj4Craft Launcher - Updater Utilities
 * Утилиты безопасности и хеширования
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

/**
 * Безопасное разрешение пути внутри rootPath
 * Предотвращает path traversal атаки
 * @param {string} rootPath - Корневая директория
 * @param {string} relativePath - Относительный путь из манифеста
 * @returns {string} - Абсолютный путь
 * @throws {Error} - Если путь выходит за пределы root
 */
function resolveUnderRoot(rootPath, relativePath) {
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
        throw new Error('Invalid manifest path');
    }

    // Disallow absolute paths and obvious traversal
    if (path.isAbsolute(relativePath)) {
        throw new Error(`Absolute paths are not allowed in manifest: ${relativePath}`);
    }

    const rootResolved = path.resolve(rootPath);
    const destResolved = path.resolve(rootPath, relativePath);
    const rootWithSep = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;
    
    if (!destResolved.startsWith(rootWithSep) && destResolved !== rootResolved) {
        throw new Error(`Path traversal detected in manifest path: ${relativePath}`);
    }
    
    return destResolved;
}

/**
 * Вычислить SHA1 хеш файла
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<string>} - Hex хеш
 */
function getFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const stream = fs.createReadStream(filePath);
        
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

/**
 * Безопасное удаление файла (с проверкой существования)
 * @param {string} filePath - Путь к файлу
 */
function safeUnlink(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        // Ignore errors on cleanup
    }
}

/**
 * Создать директорию если не существует
 * @param {string} dirPath - Путь к директории
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Генерировать уникальный временный путь
 * @param {string} destPath - Целевой путь
 * @returns {string} - Временный путь
 */
function getTempPath(destPath) {
    return `${destPath}.tmp-${crypto.randomUUID()}`;
}

/**
 * Извлечь «стем» мода (имя без версий и расширения .jar)
 * @param {string} filePath
 * @returns {string}
 */
function getModStem(filePath) {
    if (!filePath || typeof filePath !== 'string') return '';
    const fileName = filePath.split('/').pop().split('\\').pop().toLowerCase();
    return fileName
        .replace(/\.jar$/i, '')
        .replace(/[-_](v?\d+\.[\d.]+.*)$/i, '')
        .replace(/[-_](neoforge|forge|fabric|mc\d+.*)$/i, '');
}

/**
 * Известные шаблоны файлов для групп модов (для выявления соответствия обновлённых файлов в манифесте)
 */
const MOD_GROUP_FILE_PATTERNS = [
    { id: 'sodium', files: ['client-sodium-neoforge', 'client-sodium-fabric', 'client-sodium-0.', 'client-embeddium', 'client-chloride'] },
    { id: 'sodium_extra', files: ['client-sodium-extra'] },
    { id: 'reeses_options', files: ['client-reeses-sodium-options'] },
    { id: 'entity_culling', files: ['client-entityculling'] },
    { id: 'cull_leaves', files: ['client-cullleaves', 'client-midnightlib'] },
    { id: 'oculus', files: ['client-oculus', 'client-iris', 'iris', 'oculus'] },
    { id: 'borderless', files: ['client-borderless', 'borderless'] },
    { id: 'athena', files: ['client-athena', 'athena'] },
    { id: 'cit_resewn', files: ['client-entity_texture_features', 'client-entity_model_features', 'client-citreforged'] },
    { id: 'etf', files: ['client-entity_texture_features', 'client-entity_model_features', 'client-citreforged'] },
    { id: 'emf', files: ['client-entity_texture_features', 'client-entity_model_features', 'client-citreforged'] },
    { id: 'etf_emf', files: ['client-entity_texture_features', 'client-entity_model_features', 'client-citreforged'] },
    { id: 'etf_emf_cit', files: ['client-entity_texture_features', 'client-entity_model_features', 'client-citreforged', 'entity_texture_features', 'entity_model_features'] },
    { id: 'mouse_tweaks', files: ['client-mousetweaks', 'client-MouseTweaks', 'mousetweaks', 'MouseTweaks'] },
    { id: 'simply_tooltips', files: ['client-simplytooltips', 'client-SimplyTooltips', 'simplytooltips', 'SimplyTooltips'] },
    { id: 'oracle_index', files: ['client-oracle_index', 'client-oracle-index', 'oracle_index', 'oracle-index'] },
    { id: 'watermedia', files: ['client-watermedia', 'watermedia'] },
    { id: 'xaero_minimap', files: ['client-xaeros-minimap'] },
    { id: 'xaero_worldmap', files: ['client-xaeros-worldmap'] },
    { id: 'controlling', files: ['client-controlling', 'client-Controlling', 'client-searchables', 'client-Searchables', 'controlling', 'searchables'] },
    { id: 'emi', files: ['client-emi', 'client-createjeicompat', 'emi'] },
    { id: 'better_advancements', files: ['client-betteradvancements', 'client-BetterAdvancements', 'betteradvancements'] },
    { id: 'more_overlays', files: ['client-moreoverlays'] },
    { id: 'lan_properties', files: ['client-lanserverproperties', 'client_lanserverproperties', 'lanserverproperties'] },
    { id: 'discord_rpc', files: ['client-simplerpc'] },
    { id: 'fancymenu', files: ['client-fancymenu', 'client-konkrete', 'client-melody'] },
    { id: 'forgematica', files: ['client-forgematica', 'client-Forgematica', 'client-mafglib', 'client-badpackets', 'client-neoforgematicaprinter', 'client-NeoForgematicaPrinter', 'forgematica', 'neoforgematicaprinter'] },
    { id: 'forgematica_printer', files: ['client-forgematica', 'client-Forgematica', 'client-mafglib', 'client-badpackets', 'client-neoforgematicaprinter', 'client-NeoForgematicaPrinter'] },
    { id: 'third_person', files: ['client-leawind_third_person', 'client-BetterThirdPerson', 'BetterThirdPerson', 'betterthirdperson'] },
    { id: 'first_person', files: ['client-firstperson', 'client-FirstPerson', 'firstperson'] },
    { id: 'controllable', files: ['client-motorassistance', 'client-controllable', 'client-framework'] },
    { id: 'epic_tweaks', files: ['client-epictweaks'] }
];

/**
 * Проверить, является ли мод отключённым (сохраняя статус отключения при изменении версии/имени файла в манифесте)
 * @param {string} filePath - Путь к файлу мода из манифеста
 * @param {string[]} disabledMods - Список отключённых модов из конфига
 * @returns {boolean}
 */
function isModDisabled(filePath, disabledMods = []) {
    if (!filePath || !Array.isArray(disabledMods) || disabledMods.length === 0) {
        return false;
    }

    const normPath = String(filePath).replace(/\\/g, '/');
    if (disabledMods.includes(normPath)) {
        return true;
    }

    const targetFileName = normPath.split('/').pop().toLowerCase();
    const targetStem = getModStem(normPath);

    for (const disabledEntry of disabledMods) {
        if (!disabledEntry) continue;
        const normDisabled = String(disabledEntry).replace(/\\/g, '/');
        if (normDisabled === normPath) return true;

        // 1. Совпадение по ID группы
        const groupById = MOD_GROUP_FILE_PATTERNS.find(g => g.id === normDisabled);
        if (groupById) {
            if (groupById.files.some(p => targetFileName.includes(p.toLowerCase()))) {
                return true;
            }
        }

        // 2. Совпадение по паттерну группы (если в disabledMods лежит старый путь к моду)
        const entryFileName = normDisabled.split('/').pop().toLowerCase();
        const matchingGroup = MOD_GROUP_FILE_PATTERNS.find(g => 
            g.files.some(p => entryFileName.includes(p.toLowerCase()))
        );
        if (matchingGroup) {
            if (matchingGroup.files.some(p => targetFileName.includes(p.toLowerCase()))) {
                return true;
            }
        }

        // 3. Совпадение по стему имени мода
        const entryStem = getModStem(normDisabled);
        if (targetStem && entryStem && targetStem === entryStem) {
            return true;
        }
    }

    return false;
}

module.exports = {
    resolveUnderRoot,
    getFileHash,
    safeUnlink,
    ensureDir,
    getTempPath,
    getModStem,
    isModDisabled
};
