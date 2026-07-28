const fs = require('fs');
const path = require('path');
const fsPromises = fs.promises;

const TomlParser = require('./parsers/toml-parser');
const JsonParser = require('./parsers/json-parser');
const SnbtParser = require('./parsers/snbt-parser');
const PropertiesParser = require('./parsers/properties-parser');

/**
 * Парсер конфигов (Фасад для работы с различными форматами)
 */
class ConfigParser {
    
    static async scanConfigsDir(dirPath) {
        let results = [];
        if (!fs.existsSync(dirPath)) return results;
        
        try {
            const list = await fsPromises.readdir(dirPath, { withFileTypes: true });
            for (const dirent of list) {
                const fullPath = path.join(dirPath, dirent.name);
                if (dirent.isDirectory()) {
                    try {
                        const sublist = await fsPromises.readdir(fullPath, { withFileTypes: true });
                        for (const sub of sublist) {
                            if (sub.isFile() && this.isSupportedExtension(sub.name)) {
                                results.push(path.join(fullPath, sub.name));
                            }
                        }
                    } catch (e) {}
                } else if (dirent.isFile() && this.isSupportedExtension(dirent.name)) {
                    results.push(fullPath);
                }
            }
        } catch (e) {
            console.error('Error scanning configs dir:', e);
        }
        return results;
    }

    static isSupportedExtension(filename) {
        const ext = path.extname(filename).toLowerCase();
        return ['.toml', '.json', '.snbt', '.cfg', '.properties'].includes(ext);
    }

    static getParser(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.toml': return TomlParser;
            case '.json': return JsonParser;
            case '.snbt': return SnbtParser;
            case '.cfg':
            case '.properties': return PropertiesParser;
            default: return null;
        }
    }

    static async parseFile(filePath) {
        try {
            const parser = this.getParser(filePath);
            if (parser) {
                return await parser.parse(filePath);
            }
            return [];
        } catch (e) {
            console.error(`Error parsing config ${filePath}:`, e);
            return [];
        }
    }

    static async saveConfigValue(filePath, key, newValue) {
        try {
            const parser = this.getParser(filePath);
            if (parser) {
                return await parser.save(filePath, key, newValue);
            }
            return { success: false, error: 'Unsupported file extension' };
        } catch (e) {
            console.error(`Error saving config ${filePath}:`, e);
            return { success: false, error: e.message };
        }
    }
}

module.exports = ConfigParser;
