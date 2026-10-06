const fs = require('fs');
let code = fs.readFileSync('lib/v2/validator.js', 'utf8');

// 1. Relax the LLM Prompt
const oldPromptRegex = /If it's an "ask", did it explicitly ask for the slots: \$\{JSON\.stringify\(nextAction\.slots\)\} and only those\?/g;
const newPrompt = "If it's an \"ask\", did it explicitly ask for the slots: ${JSON.stringify(nextAction.slots)}? (It is perfectly fine and encouraged to include conversational filler, empathy, or natural conversational context along with the question).";
code = code.replace(oldPromptRegex, newPrompt);

// 2. Fix JSON Parsing
const oldParseBlockRegex = /let text = vRes\.text\.trim\(\);[\s\S]*?if \(firstBrace !== -1/g;
const newParseBlock = "let cleanOutput = vRes.text.replace(/```json/gi, '').replace(/```/gi, '').trim();\n        const firstBrace = cleanOutput.indexOf('{');\n        const lastBrace = cleanOutput.lastIndexOf('}');\n        if (firstBrace !== -1";
code = code.replace(oldParseBlockRegex, newParseBlock);

code = code.replace(/text\.substring\(firstBrace, lastBrace \+ 1\)/g, "cleanOutput.substring(firstBrace, lastBrace + 1)");

fs.writeFileSync('lib/v2/validator.js', code, 'utf8');
