"use strict";
const { render } = require('./templates');
async function writeReply(llmFn, state, nextAction, recentHistory, rulesText) {
    if (nextAction.type === 'silent') return { text: "", tokens: 0, deterministic: true };
    const isRetry = nextAction.reason && nextAction.reason.includes('Retry:');
    if (!isRetry) {
        const fixedReply = render(state, nextAction);
        if (fixedReply) return { text: fixedReply, tokens: 0, deterministic: true };
    }
    const historyText = recentHistory.slice(-12).map(m => `${m.role==='user'?'Client':'Bot'}: ${m.content}`).join('\n');
    let instruction = "";
    if (nextAction.type === 'answer_question') instruction = `Reponds a la question sur: ${nextAction.slots[0]}. Base UNIQUEMENT sur regles metier. Si marque hors catalogue a l'achat, dis que tu vas verifier et envoyer un devis. NE DEMANDE AUCUNE info perso.`;
    else if (nextAction.type === 'ask') {
        if (nextAction.reason === 'booking_group') instruction = "Demande en UNE SEULE question groupee: nom complet + adresse exacte + jour + heure souhaites. Chaleureux, concis, termine par ?";
        else if (nextAction.reason === 'missing_intent') instruction = "Demande quel service souhaite (reparation, entretien, installation, ou achat). Termine par ?";
        else instruction = "Pose une question simple pour demander: " + nextAction.slots[0] + ". Termine par ?";
    } else if (nextAction.type === 'recap') instruction = `Fais un recap clair: Service: ${state.intent}, Slots: ${JSON.stringify(state.slots)}. Conclus que demande ENREGISTREE et EN ATTENTE de confirmation technique. N'utilise pas confirme/programme.`;
    else if (nextAction.type === 'close') instruction = "Client a reporte. Remercie et reste a disposition, sans question.";
    const prompt = `
Tu es l'assistant DK Clim. Reponse WhatsApp.
LANGUE: Darija Marocaine en lettres latines TOUJOURS (Salam, Mrehba, kifach, bikhir). Meme si client parle francais, reponds Darija latine chaleureuse.
Style: chaleureux, concis max 4 phrases, Incha'Allah, marhaba.
ANTI-HALLUCINATION: N'invente jamais prix/services/marques.
REGLES METIER:
${rulesText}
CONTEXTE: Intent ${state.intent}, Slots ${JSON.stringify(state.slots)}
HISTORIQUE:
${historyText}
INSTRUCTION: ${instruction}
Genere UNIQUEMENT le texte reponse.
`;
    const res = await llmFn(prompt);
    let cleanText = res.text.replace(/^(Bot|Assistant|DK Clim|Agent):/i, "").trim();
    return { text: cleanText, tokens: res.tokens || 0, deterministic: false };
}
module.exports = { writeReply };
