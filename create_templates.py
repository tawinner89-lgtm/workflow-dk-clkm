import os

code = """const TEMPLATES = {
    ask: {
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
    
    if (action.type === 'silent') return "";
    
    if (action.type === 'handoff') return TEMPLATES.handoff[lang];
    if (action.type === 'urgency') return TEMPLATES.urgency[lang];
    if (action.type === 'media_fallback') return TEMPLATES.media_fallback[lang];
    if (action.type === 'out_of_scope') return TEMPLATES.out_of_scope[lang];
    
    if (action.type === 'ask' && action.slots && action.slots.length === 1) {
        const slot = action.slots[0];
        if (TEMPLATES.ask[slot]) {
            return TEMPLATES.ask[slot][lang];
        }
    }
    
    return null; // Signals fallback to LLM
}

module.exports = { render, TEMPLATES };
"""

with open("lib/v2/templates.js", "w", encoding="utf-8") as f:
    f.write(code)
