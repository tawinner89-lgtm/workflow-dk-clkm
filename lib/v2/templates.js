const TEMPLATES = {
    ask: {
        intent: {
            fr: "Bienvenue chez DK Clim ! Comment puis-je vous aider aujourd'hui ? (Rǟparation, Entretien, Installation, Achat)",
            ar: "Salam, marhaba bik f DK Clim ! Kifach n9der n3awnek lyouma? (Réparation, Entretien, Installation, Achat)"
        },
        name: {
            fr: "Pourriez-vous me donner votre nom et prÃ©nom s'il vous plaÃ®t ?",
            ar: "Momkin l'ism dyalek l'kamel 3afak?"
        },
        phone: {
            fr: "Quel est le numÃ©ro de tÃ©lÃ©phone pour vous joindre ?",
            ar: "Chno howa raqm tlf dyalek 3afak?"
        },
        address: {
            fr: "Quelle est votre adresse complÃ¨te (quartier, ville) ?",
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
            fr: "Pouvez-vous me dÃ©crire le problÃ¨me exact de votre climatiseur ?",
            ar: "Wsf lina l'mochkil li 3ndek f l'clim 3afak?"
        },
        units: {
            fr: "Combien d'unitÃ©s sont concernÃ©es ?",
            ar: "Ch7al mn unitÃ© 3ndek?"
        },
        day: {
            fr: "Quel jour vous conviendrait le mieux ?",
            ar: "Ina nhar ynasbek njiw 3ndek?"
        },
        time_window_or_hour: {
            fr: "Avez-vous une prÃ©fÃ©rence pour l'heure (matin ou aprÃ¨s-midi) ?",
            ar: "M3ach ynasbek l'waqt? (Sbah ola l3chiya?)"
        }
    },
    handoff: {
        fr: "Je transfÃ¨re votre demande Ã  un membre de notre Ã©quipe technique. Il vous rÃ©pondra dans un instant.",
        ar: "Rani sayft talab dyalek l'Ã©quipe technique, ghadi yjawbok db shwiya."
    },
    urgency: {
        fr: "Ceci semble Ãªtre une urgence. Je demande Ã  un technicien de vous contacter immÃ©diatement.",
        ar: "Hadchi kayban urgent. Rani 3lamt technicien ytasl bik f l'hin."
    },
    media_fallback: {
        fr: "Notre Ã©quipe va consulter ce fichier et vous rÃ©pondre au plus vite.",
        ar: "L'Ã©quipe technique ghadi tchouf had l'fichier w tjawbek f'aqrab waqt."
    },
    out_of_scope: {
        fr: "DÃ©solÃ©, je ne peux vous aider que pour des services de climatisation (DK CLIM).",
        ar: "Smahli, ana hna ghir bach n3awnek f kol ma kaykhass l'climatisation (DK CLIM)."
    }
};

function render(state, action) {
    const lang = state.language === 'fr' ? 'fr' : 'ar';
    
        if (action.type === 'close' && action.reason === 'confirmed') {
        return lang === 'fr' ? "Votre demande est bien enregistrée. Notre équipe vous contactera très bientôt. Merci !" : "Talab dyalek tsjjel, l'equipe ghadi t3awd t9ollek 9rib. Chokran!";
    }
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



