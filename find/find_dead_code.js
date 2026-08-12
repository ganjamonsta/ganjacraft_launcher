const fs = require('fs');
const path = require('path');
const srcDir = 'd:/GanjaCraft/git/ganja_launcher/client/src';

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
const exportsMap = {}; // { exportName: sourceFile }

// 1. Find all exports
allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  
  // match module.exports.funcName = ...
  const regex1 = /module\.exports\.([a-zA-Z0-9_]+)\s*=/g;
  let match;
  while ((match = regex1.exec(content)) !== null) {
    exportsMap[match[1]] = { file, used: false };
  }
  
  // match module.exports = { func1, func2 }
  const regex2 = /module\.exports\s*=\s*{([^}]+)}/g;
  while ((match = regex2.exec(content)) !== null) {
    const exports = match[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);
    exports.forEach(e => exportsMap[e] = { file, used: false });
  }

  // match export function funcName
  const regex3 = /export\s+(async\s+)?function\s+([a-zA-Z0-9_]+)/g;
  while ((match = regex3.exec(content)) !== null) {
    exportsMap[match[2]] = { file, used: false };
  }
  
  // match export const/let/var varName
  const regex4 = /export\s+(const|let|var)\s+([a-zA-Z0-9_]+)/g;
  while ((match = regex4.exec(content)) !== null) {
    exportsMap[match[2]] = { file, used: false };
  }
});

// 2. Find usage
allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  Object.keys(exportsMap).forEach(exp => {
    // If we find the word in another file (or even same file), and it's not the export declaration itself
    // Simple heuristic: just check if the word appears in the file
    // To be slightly more accurate, count occurrences. If it's used elsewhere, mark it true.
    const regex = new RegExp('\\b' + exp + '\\b', 'g');
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      if (exportsMap[exp].file !== file) {
         exportsMap[exp].used = true;
      } else if (matches.length > 1) { // used inside the same file it's exported from
         // We might consider it used, but true dead code is not used anywhere else.
         // Let's only count if it's imported somewhere else for now, or used multiple times.
         // Actually, let's just do: if it's imported/used in another file.
      }
    }
  });
});

const dead = Object.entries(exportsMap).filter(([k, v]) => !v.used);
console.log('Potential Dead Code:');
dead.forEach(([k, v]) => console.log(k, 'in', path.relative(srcDir, v.file)));
