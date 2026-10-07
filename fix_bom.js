const fs = require('fs');
const files = ['index.js', 'src/services/llm.js', 'lib/v2/writer.js', 'lib/v2/engine.js'];

files.forEach(file => {
    try {
        if (fs.existsSync(file)) {
            let content = fs.readFileSync(file, 'utf8');
            if (content.charCodeAt(0) === 0xFEFF) {
                content = content.slice(1);
                fs.writeFileSync(file, content, 'utf8');
                console.log(`? Removed BOM from ${file}`);
            } else if (content.includes('\uFEFF')) {
                content = content.replace(/\uFEFF/g, '');
                fs.writeFileSync(file, content, 'utf8');
                console.log(`? Removed inline BOM from ${file}`);
            } else {
                console.log(`?? No BOM found in ${file}`);
            }
        }
    } catch (err) {
        console.error(`Error processing ${file}:`, err.message);
    }
});
