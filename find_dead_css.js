const fs = require('fs');
const path = require('path');

const cssPath = 'd:/GanjaCraft/git/ganja_launcher/client/src/styles.css';
const cssContent = fs.readFileSync(cssPath, 'utf-8');

const classRegex = /\.([a-zA-Z_][a-zA-Z0-9_-]+)(?=[ {:,])/g;
const classes = new Set();
let match;
while ((match = classRegex.exec(cssContent)) !== null) {
    classes.add(match[1]);
}

const ignore = new Set(['hover', 'active', 'focus', 'before', 'after', 'checked', 'disabled', 'webkit-scrollbar', 'webkit-slider-thumb', 'webkit-slider-runnable-track', 'placeholder']);
const validClasses = Array.from(classes).filter(c => !ignore.has(c));

const srcDir = 'd:/GanjaCraft/git/ganja_launcher/client/src';
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.html') || (filePath.endsWith('.js') && !filePath.includes('renderer.bundle.js'))) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = getAllFiles(srcDir);
const usedClasses = new Set();

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  validClasses.forEach(cls => {
      const regex = new RegExp('[\'"\\s=]' + cls + '[\'"\\s>]', 'g');
      if (regex.test(content) || content.includes(cls)) {
          usedClasses.add(cls);
      }
  });
});

const deadClasses = validClasses.filter(c => !usedClasses.has(c));
fs.writeFileSync('d:/GanjaCraft/git/ganja_launcher/dead_css_classes.txt', deadClasses.join('\n'), 'utf-8');
console.log('Saved dead classes list');
