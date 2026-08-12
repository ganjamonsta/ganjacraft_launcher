const fs = require('fs');
const path = require('path');
const srcDir = 'd:/GanjaCraft/git/ganja_launcher/client/src/renderer';

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

const allFiles = getAllFiles(srcDir);
const usedFiles = new Set();
// Entry point
usedFiles.add(path.join(srcDir, 'app.js').replace(/\\/g, '/'));

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
       let resolved = path.resolve(path.dirname(file), importPath).replace(/\\/g, '/');
       if (!resolved.endsWith('.js')) {
          if (fs.existsSync(resolved + '.js')) resolved += '.js';
          else if (fs.existsSync(path.join(resolved, 'index.js'))) resolved = path.join(resolved, 'index.js').replace(/\\/g, '/');
       }
       usedFiles.add(resolved);
    }
  }
});

const deadFiles = allFiles.filter(f => !usedFiles.has(f.replace(/\\/g, '/')));
console.log('Dead Renderer Files:', deadFiles);
