const fs = require('fs');
const html = fs.readFileSync('d:/GanjaCraft/git/ganja_launcher/client/src/index.html', 'utf-8');

// find all id="" attributes and see if they are referenced anywhere in JS
const idRegex = /id="([^"]+)"/g;
const ids = new Set();
let match;
while ((match = idRegex.exec(html)) !== null) {
    ids.add(match[1]);
}

const jsFiles = fs.readdirSync('d:/GanjaCraft/git/ganja_launcher/client/src/renderer', {recursive: true})
    .filter(f => f.endsWith('.js') && !f.includes('renderer.bundle.js'))
    .map(f => 'd:/GanjaCraft/git/ganja_launcher/client/src/renderer/' + f);

const usedIds = new Set();
for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const id of ids) {
        if (content.includes(id)) {
            usedIds.add(id);
        }
    }
}

const deadIds = Array.from(ids).filter(id => !usedIds.has(id));
console.log('Total IDs:', ids.size);
console.log('Dead IDs:', deadIds.length);
console.log('Sample:', deadIds.slice(0, 30));
