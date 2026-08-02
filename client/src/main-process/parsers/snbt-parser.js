const fsPromises = require('fs').promises;
const path = require('path');

class SnbtParser {
    static async parse(filePath) {
        const content = await fsPromises.readFile(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        
        let settings = [];
        let currentComment = [];
        let categoryStack = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (!line) {
                currentComment = [];
                continue;
            }

            if (line.startsWith('//') || line.startsWith('#')) {
                const cleanComment = line.replace(/^[\/#]+\s*/, '').trim();
                if (cleanComment) currentComment.push(cleanComment);
                continue;
            }

            if (line === '{') {
                continue;
            }
            if (line.startsWith('}')) {
                categoryStack.pop();
                currentComment = [];
                continue;
            }

            const snbtMatch = line.match(/^([a-zA-Z0-9_]+)\s*:\s*(.*)$/);
            if (snbtMatch) {
                const key = snbtMatch[1];
                let value = snbtMatch[2].replace(/,$/, '').trim();
                
                if (value === '{') {
                    const categoryName = key.charAt(0).toUpperCase() + key.slice(1);
                    categoryStack.push(categoryName);
                    currentComment = [];
                    continue;
                }
                
                if (value === '[') {
                    // Skip array starts so they aren't parsed as simple string settings
                    currentComment = [];
                    continue;
                }

                let type = 'string';
                let parsedValue = value;

                if (value === 'true' || value === 'false' || value === '1b' || value === '0b') {
                    type = 'boolean';
                    parsedValue = value === 'true' || value === '1b';
                } else if (/^-?\d+(\.\d+)?[bdf]?$/.test(value)) {
                    type = 'number';
                    parsedValue = parseFloat(value);
                } else if (value.startsWith('"') && value.endsWith('"')) {
                    type = 'string';
                    parsedValue = value.slice(1, -1);
                }

                const category = categoryStack.length > 0 ? categoryStack[categoryStack.length - 1] : 'Общие';

                settings.push({
                    key, value: parsedValue, rawValue: value, type,
                    comment: currentComment.join('\n'),
                    category: category,
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
        
        // Very basic snbt conversion (some SNBT uses 1b/0b for boolean)
        if (typeof newValue === 'boolean') {
            strValue = newValue ? 'true' : 'false';
        } else if (typeof newValue === 'string') {
            if (!strValue.startsWith('"')) strValue = `"${strValue}"`;
        }

        const eKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^(\\s*${eKey}\\s*:\\s*)([^,\\r\\n]+)(,?)`, 'gm');
        let replaced = false;
        
        content = content.replace(regex, (match, p1, p2, p3) => {
            replaced = true;
            return `${p1}${strValue}${p3}`;
        });

        if (replaced) {
            await fsPromises.writeFile(filePath, content, 'utf-8');
            return { success: true };
        }
        return { success: false, error: 'Key not found in SNBT file' };
    }
}

module.exports = SnbtParser;
