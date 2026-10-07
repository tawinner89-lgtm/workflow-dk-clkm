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
        instruction = `RÃ©ponds de maniÃ¨re approfondie et naturelle Ã  la question du client. Base-toi UNIQUEMENT sur les rÃ¨gles mÃ©tier ci-dessous. IMPORTANT: Si le client demande Ã  acheter une marque hors catalogue (ex: Samsung), dis que tu vas vÃ©rifier et envoyer un devis. NE DEMANDE AUCUNE information personnelle (comme le tÃ©lÃ©phone, l'adresse ou la taille exacte) dans ce mÃªme message. Laisse la conversation couler naturellement.`;
    } else if (nextAction.type === 'ask') {
        // Fallback for complex asks like missing_intent or resume_flow
        if (nextAction.reason === 'resume_flow') {
            instruction = "Rends le salut poliment, puis rappelle au client de maniÃ¨re fluide ce qu'il reste Ã  fournir : " + nextAction.slots[0] + ". Termine par un point d'interrogation.";
        } else if (nextAction.reason === 'missing_intent') {
            instruction = "Demande poliment au client quel service il souhaite (rÃ©paration, entretien, installation, ou achat). Termine par un point d'interrogation.";
        } else {
            instruction = "Pose une question simple pour demander : " + nextAction.slots[0] + ". Termine par un point d'interrogation.";
        }
    } else if (nextAction.type === 'recap') {
        instruction = `Fais un rÃ©capitulatif clair et professionnel de la demande.
Informations Ã  inclure :
- Service: ${state.intent}
- Slots: ${JSON.stringify(state.slots)}
Conclus en disant que la demande est ENREGISTRÃ‰E et EN ATTENTE de confirmation par l'Ã©quipe technique. N'utilise pas les mots "confirmÃ©" ou "programmÃ©".`;
    } else if (nextAction.type === 'close') {
        instruction = "Le client a reportÃ© ou annulÃ© poliment. Remercie-le et dis que tu restes Ã  sa disposition, sans poser de question.";
    }

    const prompt = `
Tu es l'assistant de DK Clim. Tu dois gnrer la rponse EXACTE  envoyer au client via WhatsApp.
RGLES DE TON ET DE LANGUE:
- CRITICAL: Tu DOIS IMPRATIVEMENT rpondre en Arabe Marocain (Darija) crit en lettres latines (Darija), MME SI l'utilisateur parle en franais.
- Vouvoiement (si applicable), chaleureux, concis (maximum 4 phrases).
- Parle avec des expressions locales marocaines (ex: Incha'Allah, bikhir, marhaba).
- MIROIR DE LANGUE STRICT: RÃ©pÃ¨te la langue du client ('${state.language || 'fr'}'). Si Darija, utilise des mots marocains purs (Salam, Mrehba).
- ANTI-HALLUCINATION: N'invente jamais de prix, de services ou de marques. Si non prÃ©cisÃ© dans les rÃ¨gles mÃ©tier, dis que l'Ã©quipe commerciale va vÃ©rifier.
- Pose UNE SEULE question Ã  la fois.

RÃˆGLES MÃ‰TIER:
${rulesText}

CONTEXTE:
Intent: ${state.intent || 'Inconnu'}
Slots: ${JSON.stringify(state.slots)}

HISTORIQUE:
${historyText}

INSTRUCTION:
${instruction}

GÃ©nÃ¨re UNIQUEMENT le texte de la rÃ©ponse. Ne mets pas "Bot:" ou "Assistant:" au dÃ©but.
`;

    const res = await llmFn(prompt);
    
    // Clean up typical LLM prefixes
    let cleanText = res.text.replace(/^(Bot|Assistant|DK Clim|Agent):/i, "").trim();
    
    return { text: cleanText, tokens: res.tokens || 0, deterministic: false };
}

module.exports = { writeReply };

