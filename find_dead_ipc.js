const fs = require('fs');
const path = require('path');
const preloadPath = 'd:/GanjaCraft/git/ganja_launcher/client/src/preload.js';
const rendererDir = 'd:/GanjaCraft/git/ganja_launcher/client/src/renderer';

const preloadCode = fs.readFileSync(preloadPath, 'utf-8');
const contextBridgeMatch = /contextBridge\.exposeInMainWorld\('api',\s*\{([\s\S]*?)\}\);/.exec(preloadCode);
if (!contextBridgeMatch) {
   console.log('No contextBridge found');
   process.exit(1);
}

const apiBlock = contextBridgeMatch[1];
const apiRegex = /([a-zA-Z0-9_]+)\s*:/g;
const apis = [];
let match;
while ((match = apiRegex.exec(apiBlock)) !== null) {
   apis.push(match[1]);
}

console.log('Exposed APIs:', apis);

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.js') && !filePath.includes('renderer.bundle.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const rendererFiles = getAllFiles(rendererDir);
const usedApis = new Set();

rendererFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  apis.forEach(api => {
     if (content.includes('window.api.' + api) || content.includes('api.' + api)) {
        usedApis.add(api);
     }
  });
});

console.log('Dead APIs:', apis.filter(a => !usedApis.has(a)));
