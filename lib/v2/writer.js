const { render } = require('./templates');

async function writeReply(llmFn, state, nextAction, recentHistory, rulesText) {
    if (nextAction.type === 'silent') return { text: "", tokens: 0, deterministic: true };
    
    // First, try to use a deterministic template to save LLM tokens and latency
    // Bypass template if it's a validator retry to avoid infinite exact-match loops
    const isRetry = nextAction.reason && nextAction.reason.includes('Retry:');
    if (!isRetry) {
        const fixedReply = render(state, nextAction);
        if (fixedReply) {
            return { text: fixedReply, tokens: 0, deterministic: true };
        }
    }

    const historyText = recentHistory.map(m => `${m.role === 'user' ? 'Client' : 'Bot'}: ${m.content}`).join('\n');

    let instruction = "";
    if (nextAction.type === 'answer_question') {
        const topic = nextAction.slots[0];
        instruction = `Réponds de manière approfondie et naturelle à la question du client. Base-toi UNIQUEMENT sur les règles métier ci-dessous. IMPORTANT: Si le client demande à acheter une marque hors catalogue (ex: Samsung), dis que tu vas vérifier et envoyer un devis. NE DEMANDE AUCUNE information personnelle (comme le téléphone, l'adresse ou la taille exacte) dans ce même message. Laisse la conversation couler naturellement.`;
    } else if (nextAction.type === 'ask') {
        // Fallback for complex asks like missing_intent or resume_flow
        if (nextAction.reason === 'resume_flow') {
            instruction = "Rends le salut poliment, puis rappelle au client de manière fluide ce qu'il reste à fournir : " + nextAction.slots[0] + ". Termine par un point d'interrogation.";
        } else if (nextAction.reason === 'missing_intent') {
            instruction = "Demande poliment au client quel service il souhaite (réparation, entretien, installation, ou achat). Termine par un point d'interrogation.";
        } else {
            instruction = "Pose une question simple pour demander : " + nextAction.slots[0] + ". Termine par un point d'interrogation.";
        }
    } else if (nextAction.type === 'recap') {
        instruction = `Fais un récapitulatif clair et professionnel de la demande.
Informations à inclure :
- Service: ${state.intent}
- Slots: ${JSON.stringify(state.slots)}
Conclus en disant que la demande est ENREGISTRÉE et EN ATTENTE de confirmation par l'équipe technique. N'utilise pas les mots "confirmé" ou "programmé".`;
    } else if (nextAction.type === 'close') {
        instruction = "Le client a reporté ou annulé poliment. Remercie-le et dis que tu restes à sa disposition, sans poser de question.";
    }

    const prompt = `
Tu es l'assistant de DK Clim. Tu dois générer la réponse EXACTE à envoyer au client via WhatsApp.
RÈGLES DE TON ET DE LANGUE:
- Vouvoiement, chaleureux, concis (maximum 4 phrases).
- MIROIR DE LANGUE STRICT: Répète la langue du client ('${state.language || 'fr'}'). Si Darija, utilise des mots marocains purs (Salam, Mrehba).
- ANTI-HALLUCINATION: N'invente jamais de prix, de services ou de marques. Si non précisé dans les règles métier, dis que l'équipe commerciale va vérifier.
- Pose UNE SEULE question à la fois.

RÈGLES MÉTIER:
${rulesText}

CONTEXTE:
Intent: ${state.intent || 'Inconnu'}
Slots: ${JSON.stringify(state.slots)}

HISTORIQUE:
${historyText}

INSTRUCTION:
${instruction}

Génère UNIQUEMENT le texte de la réponse. Ne mets pas "Bot:" ou "Assistant:" au début.
`;

    const res = await llmFn(prompt);
    
    // Clean up typical LLM prefixes
    let cleanText = res.text.replace(/^(Bot|Assistant|DK Clim|Agent):/i, "").trim();
    
    return { text: cleanText, tokens: res.tokens || 0, deterministic: false };
}

module.exports = { writeReply };
