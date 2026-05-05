
import fs from 'fs';

const content = fs.readFileSync('c:/Users/rcapa/Desktop/oblivion-guild-manager/src/context/GuildContext.jsx', 'utf8');
const lines = content.split('\n');

let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;
    }
    if (i >= 1727 && i <= 2829) {
        console.log(`Line ${i + 1}: Brace: ${braceCount}, Paren: ${parenCount}, Bracket: ${bracketCount}`);
    }
    if (braceCount < 0 || parenCount < 0 || bracketCount < 0) {
        console.log(`Error at line ${i + 1}: Nesting dropped below zero! Brace: ${braceCount}, Paren: ${parenCount}, Bracket: ${bracketCount}`);
        break;
    }
}









console.log(`Final counts - Brace: ${braceCount}, Paren: ${parenCount}, Bracket: ${bracketCount}`);
