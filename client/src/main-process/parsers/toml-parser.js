const fsPromises = require('fs').promises;
const path = require('path');

class TomlParser {
    static async parse(filePath) {
        const content = await fsPromises.readFile(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        
        let settings = [];
        let currentComment = [];
        let currentCategory = 'Общие';

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (!line) {
                currentComment = [];
                continue;
            }

            if (line.startsWith('#')) {
                const cleanComment = line.replace(/^[#]+\s*/, '').trim();
                if (cleanComment) currentComment.push(cleanComment);
                continue;
            }

            if (line.startsWith('[') && line.endsWith(']')) {
                currentCategory = line.slice(1, -1);
                currentComment = [];
                continue;
            }

            const kvMatch = line.match(/^([a-zA-Z0-9_.\-]+)\s*=\s*(.*)$/);
            if (kvMatch) {
                const key = kvMatch[1].trim();
                const value = kvMatch[2].trim();
                
                let type = 'string';
                let parsedValue = value;

                if (value === 'true' || value === 'false') {
                    type = 'boolean';
                    parsedValue = value === 'true';
                } else if (/^-?\d+(\.\d+)?$/.test(value)) {
                    type = 'number';
                    parsedValue = Number(value);
                } else if (value.startsWith('"') && value.endsWith('"')) {
                    type = 'string';
                    parsedValue = value.slice(1, -1);
                }

                settings.push({
                    key, value: parsedValue, rawValue: value, type,
                    comment: currentComment.join('\n'),
                    category: currentCategory,
                    filePath, fileName: path.basename(filePath)
                });
                currentComment = [];
            } else {
                currentComment = [];
            }
        }
        return settings;
    }

    static async save(filePath, key, newValue) {
        let content = await fsPromises.readFile(filePath, 'utf-8');
        let strValue = newValue;
        if (typeof newValue === 'boolean') {
            strValue = newValue ? 'true' : 'false';
        } else if (typeof newValue === 'string') {
            if (!strValue.startsWith('"')) strValue = `"${strValue}"`;
        }

        const eKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^(\\s*${eKey}\\s*=\\s*)(.*)$`, 'gm');
        let replaced = false;
        
        content = content.replace(regex, (match, p1) => {
            replaced = true;
            return `${p1}${strValue}`;
        });

        if (replaced) {
            await fsPromises.writeFile(filePath, content, 'utf-8');
            return { success: true };
        }
        return { success: false, error: 'Key not found in TOML file' };
    }
}

module.exports = TomlParser;
