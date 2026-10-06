const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// Fix the corrupted body string
const badBodyStr = "body = [SYSTEM: L'utilisateur a envoyé une image/vidéo avec ce texte. Tu ne peux pas voir l'image. Ignore l'image et réponds UNIQUEMENT au texte de l'utilisateur.] ;";
const badBodyStrRegex = /body = \[SYSTEM: L'utilisateur a envoy. une image\/vid.o avec ce texte\. Tu ne peux pas voir l'image\. Ignore l'image et r.ponds UNIQUEMENT au texte de l'utilisateur\.\] ;/g;

code = code.replace(badBodyStrRegex, "body = `[SYSTEM: L'utilisateur a envoyé une image/vidéo avec ce texte. Tu ne peux pas voir l'image. Ignore l'image et réponds UNIQUEMENT au texte de l'utilisateur.] ${body}`;");

fs.writeFileSync('index.js', code, 'utf8');
