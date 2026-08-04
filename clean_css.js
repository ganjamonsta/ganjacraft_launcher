const fs = require('fs');

const cssPath = 'd:/GanjaCraft/git/ganja_launcher/client/src/styles.css';
let css = fs.readFileSync(cssPath, 'utf-8');

const deadClasses = fs.readFileSync('d:/GanjaCraft/git/ganja_launcher/dead_css_classes.txt', 'utf-8').split('\n').map(c => c.trim()).filter(Boolean);

let removedCount = 0;
let lines = css.split('\n');

for (const cls of deadClasses) {
    const regex = new RegExp('^[^\\{\\}]*\\.' + cls + '[^a-zA-Z0-9_-][^\\{\\}]*\\{', 'gm');
    
    let match;
    while ((match = regex.exec(css)) !== null) {
        let startIndex = match.index;
        
        // Let's find the closing brace by counting
        let braceCount = 0;
        let endIndex = -1;
        let started = false;
        
        for (let i = startIndex; i < css.length; i++) {
            if (css[i] === '{') {
                braceCount++;
                started = true;
            } else if (css[i] === '}') {
                braceCount--;
            }
            
            if (started && braceCount === 0) {
                endIndex = i;
                break;
            }
        }
        
        if (endIndex !== -1) {
            // Also remove preceding comment if it exists on the lines immediately before
            // We'll just remove the block for now
            let block = css.substring(startIndex, endIndex + 1);
            css = css.substring(0, startIndex) + css.substring(endIndex + 1);
            removedCount++;
            
            // Adjust regex index
            regex.lastIndex = startIndex;
        } else {
            regex.lastIndex = match.index + match[0].length;
        }
    }
}

// Clean up multiple newlines
css = css.replace(/\n\s*\n\s*\n/g, '\n\n');

fs.writeFileSync(cssPath, css, 'utf-8');
console.log('Removed ' + removedCount + ' dead CSS blocks.');
