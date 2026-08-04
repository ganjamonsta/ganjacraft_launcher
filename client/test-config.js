const ConfigParser = require('./src/main-process/config-parser');
const path = require('path');

async function test() {
    const dir = 's:\\Games\\LegacyLauncher_portable\\game\\home\\neoforge-21.1.247\\config';
    console.log('Scanning:', dir);
    const files = await ConfigParser.scanConfigsDir(dir);
    console.log('Found files:', files.length);
    
    if (files.length > 0) {
        // Parse the first few files
        for (let i = 0; i < Math.min(files.length, 3); i++) {
            const settings = await ConfigParser.parseFile(files[i]);
            console.log(`Parsed ${files[i]}: ${settings.length} settings`);
            if (settings.length > 0) {
                console.log('Sample setting:', settings[0]);
            }
        }
    }
}

test().catch(console.error);
