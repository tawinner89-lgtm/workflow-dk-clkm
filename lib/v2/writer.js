async function writeReply(llmFn, state, nextAction, recentHistory, rulesText) {
    if (nextAction.type === 'silent') return { text: "", tokens: 0 };
    
    const historyText = recentHistory.map(m => `${m.role === 'user' ? 'Client' : 'Bot'}: ${m.content}`).join('\n');

    let instruction = "";
    if (nextAction.type === 'handoff') {
        if (nextAction.reason === 'urgency') {
            instruction = "Le client a une urgence (étincelles, fuite, odeur de brûlé). Dis-lui poliment de couper le disjoncteur par sécurité, demande son adresse/téléphone (si non fournis), et dis que l'équipe technique va le rappeler en priorité.";
        } else {
            instruction = "Le client veut parler à un humain, se plaint ou l'action a échoué. Dis-lui poliment que tu transfères sa demande à un agent humain qui va le recontacter rapidement.";
        }
    } else if (nextAction.type === 'answer_question') {
        const topic = nextAction.slots[0];
        instruction = `Réponds brièvement à la question du client concernant le sujet "${topic}". S'il s'agit du prix, donne UNIQUEMENT les prix autorisés dans ce bloc de règles: [${rulesText}]. Si tu n'as pas le prix exact, dis que l'équipe l'appellera pour le devis. Ensuite, continue naturellement pour demander les informations manquantes du flux.`;
    } else if (nextAction.type === 'ask') {
        if (nextAction.reason === 'missing_intent') {
            instruction = "Demande poliment au client quel service il souhaite (réparation, entretien, installation, ou achat). Termine par un point d'interrogation.";
        } else if (nextAction.reason === 'collect_booking_group') {
            instruction = "Accuse réception des informations précédentes (ex: 'Noté.'), puis demande dans UNE SEULE question les informations suivantes qui manquent : " + nextAction.slots.join(', ') + " (nom, adresse, téléphone, jour/heure). N'invente pas d'heure. Termine par un point d'interrogation.";
        } else {
            instruction = "Accuse réception en quelques mots, puis pose une question simple pour demander : " + nextAction.slots[0] + ". Termine par un point d'interrogation.";
        }
    } else if (nextAction.type === 'recap') {
        instruction = `Fais un récapitulatif clair et professionnel de la demande.
Informations à inclure :
- Service: ${state.intent}
- Slots: ${JSON.stringify(state.slots)}
Conclus en disant que la demande est ENREGISTRÉE et EN ATTENTE de confirmation par l'équipe. N'utilise pas les mots "confirmé" ou "programmé".`;
    } else if (nextAction.type === 'close') {
        instruction = "Le client a reporté ou annulé poliment. Remercie-le et dis que tu restes à sa disposition, sans poser de question.";
    }

    const prompt = `
Tu es l'assistant de DK Clim. Tu dois générer la réponse EXACTE à envoyer au client via WhatsApp.
RÈGLES DE TON:
- Vouvoiement, chaleureux, concis (max 3 phrases).
- Réponds dans la langue du client (Arabe/Darija ou Français).
- ANTI-HALLUCINATION CRITIQUE: Tu ne dois JAMAIS inventer de prix, de services, de marques, de délais, ou de zones géographiques. Si l'information n'est pas explicitement fournie dans les règles métier ci-dessous, dis que tu ne sais pas et que l'équipe commerciale va le contacter.
- Si on te demande de poser une question, termine bien par un point d'interrogation.

RÈGLES MÉTIER OFFICIELLES (Business Rules):
${rulesText}

CONTEXTE CLIENT:
Intent: ${state.intent || 'Inconnu'}
Slots actuels: ${JSON.stringify(state.slots)}

HISTORIQUE RÉCENT:
${historyText}

INSTRUCTION POUR CE MESSAGE:
${instruction}

Génère UNIQUEMENT le texte de la réponse (sans guillemets, sans méta-commentaires).
`;

    const res = await llmFn(prompt);
    return res; // { text: string, tokens: number }
}

module.exports = { writeReply };
