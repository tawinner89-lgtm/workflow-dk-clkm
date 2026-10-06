const fs = require('fs');
let code = fs.readFileSync('lib/v2/interpret.js', 'utf8');

const oldParseBlockRegex = /try \{[\s\S]*?let text = res\.text\.trim\(\);[\s\S]*?parsed = JSON\.parse\(jsonStr\);[\s\S]*?\} else \{[\s\S]*?throw new Error\("No JSON structure found"\);[\s\S]*?\}[\s\S]*?\} catch\(e\) \{/;

const newParseBlock = `try {
        let cleanOutput = res.text.replace(/\`\`\`json/gi, '').replace(/\`\`\`/gi, '').trim();
        const firstBrace = cleanOutput.indexOf('{');
        const lastBrace = cleanOutput.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            const jsonStr = cleanOutput.substring(firstBrace, lastBrace + 1);
            parsed = JSON.parse(jsonStr);
        } else {
            throw new Error("No JSON structure found");
        }
    } catch(e) {`;

if (code.match(oldParseBlockRegex)) {
    code = code.replace(oldParseBlockRegex, newParseBlock);
    fs.writeFileSync('lib/v2/interpret.js', code, 'utf8');
    console.log("JSON parsing logic updated.");
} else {
    console.log("Could not find parsing block to replace.");
}
