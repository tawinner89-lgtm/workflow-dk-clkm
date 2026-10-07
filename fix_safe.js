const fs = require('fs');

// 1. Réécrire templates.js proprement
const templatesJS = `const TEMPLATES = {
    ask: {
        intent: {
            fr: "Bienvenue chez DK Clim ! Comment puis-je vous aider aujourd'hui ? (Réparation, Entretien, Installation, Achat)",
            ar: "Salam, marhaba bik f DK Clim ! Kifach n9der n3awnek lyouma? (Réparation, Entretien, Installation, Achat)"
        },
        name: {
            fr: "Pourriez-vous me donner votre nom et prénom s'il vous plaît ?",
            ar: "Momkin l'ism dyalek l'kamel 3afak?"
        },
        phone: {
            fr: "Quel est le numéro de téléphone pour vous joindre ?",
            ar: "Chno howa raqm tlf dyalek 3afak?"
        },
        address: {
            fr: "Quelle est votre adresse complète (quartier, ville) ?",
            ar: "Fina blassa bedabt? (l'hay w l'mdina 3afak)"
        },
        ac_type: {
            fr: "Quel est le type de votre climatiseur (Split mural, Gainable, Cassette...) ?",
            ar: "Chno no3 dyal l'climatiseur li 3ndek? (Split, Gainable, ola Cassette?)"
        },
        brand: {
            fr: "Quelle marque de climatiseur souhaitez-vous ?",
            ar: "Ina marka dyal l'clim bghiti?"
        },
        btu: {
            fr: "Quelle puissance (BTU) recherchez-vous ? (ex: 9000, 12000, 18000...)",
            ar: "Ch7al mn BTU bghiti? (matalan: 9000, 12000, 18000...)"
        },
        symptom: {
            fr: "Pouvez-vous me décrire le problème exact de votre climatiseur ?",
            ar: "Wsf lina l'mochkil li 3ndek f l'clim 3afak?"
        },
        units: {
            fr: "Combien d'unités sont concernées ?",
            ar: "Ch7al mn unité 3ndek?"
        },
        day: {
            fr: "Quel jour vous conviendrait le mieux ?",
            ar: "Ina nhar ynasbek njiw 3ndek?"
        },
        time_window_or_hour: {
            fr: "Avez-vous une préférence pour l'heure (matin ou après-midi) ?",
            ar: "M3ach ynasbek l'waqt? (Sbah ola l3chiya?)"
        }
    },
    handoff: {
        fr: "Je transfère votre demande à un membre de notre équipe technique. Il vous répondra dans un instant.",
        ar: "Rani sayft talab dyalek l'équipe technique, ghadi yjawbok db shwiya."
    },
    urgency: {
        fr: "Ceci semble être une urgence. Je demande à un technicien de vous contacter immédiatement.",
        ar: "Hadchi kayban urgent. Rani 3lamt technicien ytasl bik f l'hin."
    },
    media_fallback: {
        fr: "Notre équipe va consulter ce fichier et vous répondre au plus vite.",
        ar: "L'équipe technique ghadi tchouf had l'fichier w tjawbek f'aqrab waqt."
    },
    out_of_scope: {
        fr: "Désolé, je ne peux vous aider que pour des services de climatisation (DK CLIM).",
        ar: "Smahli, ana hna ghir bach n3awnek f kol ma kaykhass l'climatisation (DK CLIM)."
    }
};

function render(state, action) {
    const lang = state.language === 'fr' ? 'fr' : 'ar';
    if (action.type === 'close' && action.reason === 'confirmed') return lang === 'fr' ? "Votre demande est bien enregistrée. Notre équipe vous contactera très bientôt. Merci !" : "Talab dyalek tsjjel, l'equipe ghadi t3awd t9ollek 9rib. Chokran!";
    if (action.type === 'silent') return "";
    if (action.type === 'handoff') return TEMPLATES.handoff[lang];
    if (action.type === 'urgency') return TEMPLATES.urgency[lang];
    if (action.type === 'media_fallback') return TEMPLATES.media_fallback[lang];
    if (action.type === 'out_of_scope') return TEMPLATES.out_of_scope[lang];
    if (action.type === 'ask' && action.slots && action.slots.length === 1) {
        const slot = action.slots[0];
        if (TEMPLATES.ask[slot]) return TEMPLATES.ask[slot][lang];
    }
    return null;
}
module.exports = { render, TEMPLATES };`;
fs.writeFileSync('lib/v2/templates.js', templatesJS, 'utf8');

// 2. Nettoyer index.js prudemment
let code = fs.readFileSync('index.js', 'utf8');

// Remplacement sécurisé des longs commentaires corrompus
code = code.replace(/\/\/ Ãƒ.*/g, '// ---------------------------------------------------------');

// Remplacement du message client corrompu
code = code.replace(/const message = \[[^]*?\.join\("\\n"\);/m, `const message = [
      "🚨 *NOUVELLE INTERVENTION* 🚨",
      "",
      "👤 *Client* : " + (clientName || "Inconnu"),
      "🔖 *Référence* : " + reference,
      "🔧 *Type* : " + (type || "-"),
      "👨‍🔧 *Technicien* : " + (technicianName || "-"),
      horaires ? "⏰ *Horaires* : " + horaires : "",
      workList ? "\\n🛠️ *Travaux effectués :*\\n" + workList : "",
      materialsUsed ? "\\n📦 *Matériaux* : " + materialsUsed : "",
      observations ? "\\n📝 *Observations* : " + observations : "",
      "\\n📌 *Statut final* : " + conformite,
      "",
      "-----------------------------------",
      "📞 Contact DK Clim: 0612540085"
    ].filter(Boolean).join("\\n");`);

// Remplacement des notifications techniciens corrompues
code = code.replace(/const notifMsg =[\s\S]*?timeSuffix;/g, `const notifMsg =
  "🚨 *NOUVELLE INTERVENTION ASSIGNÉE* 🚨\\n\\n" +
  "👤 *Client:* " + payload.clientName + "\\n" +
  "📍 *Adresse:* " + payload.clientAddress + "\\n" +
  "📞 *Téléphone:* " + payload.clientContactPhone + "\\n" +
  "🔧 *Problème/Type:* " + payload.problemReported + " (" + payload.type + ")\\n\\n" +
  timeSuffix;`);

// Restauration des icônes simples
code = code.replace(/ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦/g, '✅')
           .replace(/ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚Â Ãƒâ€¦Ã¢â‚¬â„¢/g, '❌')
           .replace(/ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“/g, '🔑')
           .replace(/ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã¢â‚¬â„¢Ãƒâ€šÃ‚Â /g, '🌐')
           .replace(/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©/g, 'é')
           .replace(/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨/g, 'è')
           .replace(/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â®/g, 'î')
           .replace(/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§/g, 'ç')
           .replace(/ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°/g, 'É')
           .replace(/ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬/g, 'À');

fs.writeFileSync('index.js', code, 'utf8');
console.log("✅ index.js nettoyé avec succès !");