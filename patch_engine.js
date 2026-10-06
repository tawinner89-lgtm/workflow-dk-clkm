const fs = require('fs');
let code = fs.readFileSync('lib/v2/engine.js', 'utf8');

const regex = /let finalBtu = String\(state\.slots\.btu\)\.replace\(\/\\D\/g, ""\);`n                if \(finalBtu\) \{ finalBtu = `\$\{finalBtu\}_BTU`; \}/;
const replacement = `let finalBtu = String(state.slots.btu).replace(/\\D/g, "");\n                if (finalBtu) { finalBtu = \`\${finalBtu}_BTU\`; }`;

code = code.replace(regex, replacement);
fs.writeFileSync('lib/v2/engine.js', code, 'utf8');
