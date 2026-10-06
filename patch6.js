const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');
const replacement = fs.readFileSync('clean_block.txt', 'utf8');

const regex = /\/\/ Media handler[\s\S]*?(?=if \(body\.length > 1000\))/;
code = code.replace(regex, replacement + '\n  ');
fs.writeFileSync('index.js', code, 'utf8');
