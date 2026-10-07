const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');
const bomIndex = content.indexOf('\uFEFF');
console.log(`BOM found at index: ${bomIndex}`);
if (bomIndex > -1) {
    console.log(content.slice(Math.max(0, bomIndex - 10), bomIndex + 20));
}
