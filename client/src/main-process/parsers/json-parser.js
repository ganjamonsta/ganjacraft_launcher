const fsPromises = require('fs').promises;
const path = require('path');

class JsonParser {
    static async parse(filePath) {
        const content = await fsPromises.readFile(filePath, 'utf-8');

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            // Невалидный JSON — ничего не показываем
            return [];
        }

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return [];
        }

        const settings = [];
        const fileName = path.basename(filePath);

        /**
         * Рекурсивно обходим объект.
         * @param {object} obj - текущий объект
         * @param {string} category - имя категории (ключ верхнего уровня)
         * @param {string} keyPrefix - префикс для вложенных ключей
         */
        function walk(obj, category, keyPrefix) {
            for (const [key, value] of Object.entries(obj)) {
                const fullKey = keyPrefix ? `${keyPrefix}.${key}` : key;

                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    // Вложенный объект → уходим глубже, категория остаётся
                    walk(value, category, fullKey);
                } else if (Array.isArray(value)) {
                    // Массив → показываем как строку (read-only смысл)
                    settings.push({
                        key: fullKey,
                        value: JSON.stringify(value),
                        rawValue: JSON.stringify(value),
                        type: 'string',
                        comment: '',
                        category,
                        filePath,
                        fileName
                    });
                } else {
                    // Скалярное значение
                    let type = 'string';
                    let parsedValue = value;

                    if (typeof value === 'boolean') {
                        type = 'boolean';
                    } else if (typeof value === 'number') {
                        type = 'number';
                    } else {
                        type = 'string';
                        parsedValue = String(value);
                    }

                    settings.push({
                        key: fullKey,
                        value: parsedValue,
                        rawValue: String(value),
                        type,
                        comment: '',
                        category,
                        filePath,
                        fileName
                    });
                }
            }
        }

        // Проверяем: если первый уровень содержит объекты — это категоризированный JSON
        const topValues = Object.values(parsed);
        const hasNestedObjects = topValues.some(
            v => v !== null && typeof v === 'object' && !Array.isArray(v)
        );

        if (hasNestedObjects) {
            // Двухуровневый: { "minecraft": { ... }, "jade": { ... } }
            // Первый уровень = category
            for (const [cat, catValue] of Object.entries(parsed)) {
                if (catValue !== null && typeof catValue === 'object' && !Array.isArray(catValue)) {
                    walk(catValue, cat, '');
                } else {
                    // Смешанный: скаляр на верхнем уровне
                    settings.push({
                        key: cat,
                        value: catValue,
                        rawValue: String(catValue),
                        type: typeof catValue === 'boolean' ? 'boolean'
                             : typeof catValue === 'number' ? 'number' : 'string',
                        comment: '',
                        category: 'Общие',
                        filePath,
                        fileName
                    });
                }
            }
        } else {
            // Плоский JSON: { "key": value, ... }
            walk(parsed, 'Общие', '');
        }

        return settings;
    }

    static async save(filePath, key, newValue) {
        const content = await fsPromises.readFile(filePath, 'utf-8');
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            return { success: false, error: 'Invalid JSON file' };
        }

        // key может быть вложенным: "category.subkey" или просто "key"
        // Ищем значение по полному пути в дереве
        function setNested(obj, keyPath, value) {
            if (!keyPath) return false;

            // Пробуем сначала полный ключ как есть (для плоских JSON с dots в ключах)
            if (Object.prototype.hasOwnProperty.call(obj, keyPath)) {
                obj[keyPath] = value;
                return true;
            }

            // Пробуем разбить по первой точке
            const dotIdx = keyPath.indexOf('.');
            if (dotIdx === -1) return false;

            const head = keyPath.slice(0, dotIdx);
            const tail = keyPath.slice(dotIdx + 1);

            if (obj[head] !== null && typeof obj[head] === 'object') {
                return setNested(obj[head], tail, value);
            }
            return false;
        }

        // Если двухуровневый — ищем в каждой категории
        let replaced = false;
        const topValues = Object.values(parsed);
        const hasNestedObjects = topValues.some(
            v => v !== null && typeof v === 'object' && !Array.isArray(v)
        );

        if (hasNestedObjects) {
            for (const cat of Object.keys(parsed)) {
                if (parsed[cat] !== null && typeof parsed[cat] === 'object') {
                    if (setNested(parsed[cat], key, newValue)) {
                        replaced = true;
                        break;
                    }
                }
            }
        } else {
            replaced = setNested(parsed, key, newValue);
        }

        if (replaced) {
            await fsPromises.writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
            return { success: true };
        }
        return { success: false, error: `Key "${key}" not found in JSON file` };
    }
}

module.exports = JsonParser;
