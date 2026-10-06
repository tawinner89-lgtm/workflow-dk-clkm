const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const regex = /BOT_WATERMARK \+ "[^"]*?"\n\n[^"]*?"/s;
const replacement = "BOT_WATERMARK + \"مرحبا بك، سيقوم أحد أعضاء الفريق التقني بمراجعة الملفات والرد عليك في أقرب وقت.\\n\\nBonjour, notre équipe technique examinera ceci et vous répondra dans les plus brefs délais.\"";

code = code.replace(regex, replacement);
fs.writeFileSync('index.js', code, 'utf8');
