"use strict";
const TEMPLATES = {
    ask: {
        intent: {
            fr: "Bienvenue chez DK Clim ! Comment puis-je vous aider aujourd'hui ? (Reparation, Entretien, Installation, Achat)",
            ar: "Salam, marhaba bik f DK Clim ! Kifach n9der n3awnek lyouma? (Reparation, Entretien, Installation, Achat)"
        },
        name: { fr: "Pourriez-vous me donner votre nom et prenom s'il vous plait ?", ar: "Momkin l'ism dyalek l'kamel 3afak?" },
        phone: { fr: "Quel est le numero de telephone pour vous joindre ?", ar: "Chno howa raqm tlf dyalek 3afak?" },
        address: { fr: "Quelle est votre adresse complete (quartier, ville) ?", ar: "Fina blassa bedabt? (l'hay w l'mdina 3afak)" },
        ac_type: { fr: "Quel est le type de votre climatiseur (Split mural, Gainable, Cassette...) ?", ar: "Chno no3 dyal l'climatiseur li 3ndek? (Split, Gainable, ola Cassette?)" },
        brand: { fr: "Quelle marque de climatiseur souhaitez-vous ?", ar: "Ina marka dyal l'clim bghiti?" },
        btu: { fr: "Quelle puissance (BTU) recherchez-vous ? (ex: 9000, 12000, 18000...)", ar: "Ch7al mn BTU bghiti? (matalan: 9000, 12000, 18000...)" },
        symptom: { fr: "Pouvez-vous me decrire le probleme exact de votre climatiseur ?", ar: "Wsf lina l'mochkil li 3ndek f l'clim 3afak?" },
        units: { fr: "Combien d'unites sont concernees ?", ar: "Ch7al mn unite 3ndek?" },
        day: { fr: "Quel jour vous conviendrait le mieux ?", ar: "Ina nhar ynasbek njiw 3ndek?" },
        time_window_or_hour: { fr: "Avez-vous une preference pour l'heure (matin ou apres-midi) ?", ar: "M3ach ynasbek l'waqt? (Sbah ola l3chiya?)" },
        install_mode: { fr: "Avez-vous deja achete le climatiseur ou souhaitez-vous l'acheter chez nous ?", ar: "Wach chriti clim wla bghiti tchri men 3andna?" },
        booking_group: {
            fr: "Pour finaliser, j'aurais besoin de votre nom complet, votre adresse exacte, ainsi que le jour et l'heure qui vous arrangent.",
            ar: "Bach nakdo talab, khasni ghir smitk kamla, l'adresse b dabt, w fo9ach ynasbek (nhar w lw9ita)."
        }
    },
    handoff: {
        fr: "Je transfere votre demande a un membre de notre equipe technique. Il vous repondra dans un instant.",
        ar: "Rani sayft talab dyalek l'equipe technique, ghadi yjawbok db shwiya."
    },
    urgency: {
        fr: "Ceci semble etre une urgence. Je demande a un technicien de vous contacter immediatement.",
        ar: "Hadchi kayban urgent. Rani 3lamt technicien ytasl bik f l'hin."
    },
    media_fallback: {
        fr: "Notre equipe va consulter ce fichier et vous repondre au plus vite.",
        ar: "L'equipe technique ghadi tchouf had l'fichier w tjawbek f'aqrab waqt."
    },
    out_of_scope: {
        fr: "Desole, je ne peux vous aider que pour des services de climatisation (DK CLIM).",
        ar: "Smahli, ana hna ghir bach n3awnek f kol ma kaykhass l'climatisation (DK CLIM)."
    }
};

function render(state, action) {
    const lang = state.language === 'fr' ? 'fr' : 'ar';
    if (action.type === 'close' && action.reason === 'confirmed') return lang === 'fr' ? "Votre demande est bien enregistree. Notre equipe vous contactera tres bientot. Merci !" : "Talab dyalek tsjjel, l'equipe ghadi t3awd t9ollek 9rib. Chokran!";
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
module.exports = { render, TEMPLATES };
