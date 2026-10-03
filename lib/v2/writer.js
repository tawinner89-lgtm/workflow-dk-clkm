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
        instruction = `Réponds de manière approfondie et naturelle à la question du client. Base-toi UNIQUEMENT sur les règles métier ci-dessous. IMPORTANT: Si le client demande à acheter une marque hors catalogue (ex: Samsung), dis que tu vas vérifier et envoyer un devis. NE DEMANDE AUCUNE information personnelle (comme le téléphone, l'adresse ou la taille exacte) dans le même message si le client est en phase de découverte ou de négociation. Laisse la conversation couler naturellement.`;
    } else if (nextAction.type === 'ask') {
        let outOfStockInjection = "";
        if (state.intent === 'purchase' && historyText.toLowerCase().includes("samsung")) {
            outOfStockInjection = "IMPORTANT: Le client veut ACHETER une marque hors catalogue (ex: Samsung). Tu DOIS ABSOLUMENT appliquer la out_of_stock_policy et dire que tu vas vérifier la disponibilité et proposer un devis, AVANT de poser la question suivante. ";
        }
        
        if (nextAction.reason === 'resume_flow') {
            instruction = outOfStockInjection + "Rends le salut poliment (ex: Salam), puis rappelle au client de manière fluide ce qu'il reste à fournir : " + nextAction.slots[0] + ". Termine par un point d'interrogation.";
        } else if (nextAction.reason === 'missing_intent') {
            instruction = outOfStockInjection + "Demande poliment au client quel service il souhaite (réparation, entretien, installation, ou achat). Termine par un point d'interrogation.";
        } else {
            instruction = outOfStockInjection + "Accuse réception en quelques mots, puis pose une question simple pour demander : " + nextAction.slots[0] + ". Termine par un point d'interrogation.";
        }

    } else if (nextAction.type === 'recap') {
        instruction = `Fais un récapitulatif clair et professionnel de la demande.
Informations à inclure :
- Service: ${state.intent}
- Slots: ${JSON.stringify(state.slots)}
Conclus en disant que la demande est ENREGISTRÉE et EN ATTENTE de confirmation par l'équipe. N'utilise pas les mots "confirmé" ou "programmé".`;
    } else if (nextAction.type === 'close') {
        instruction = "Le client a reporté ou annulé poliment. Remercie-le et dis que tu restes à sa disposition, sans poser de question.";
    } else if (nextAction.type === 'out_of_scope') {
        instruction = "Le client a posé une question ou fait une remarque hors sujet. Dis-lui poliment (dans sa langue) que tu es l'assistant de DK Clim et que tu ne gères que les requêtes liées à la climatisation.";
    } else if (nextAction.type === 'media_fallback') {
        instruction = "Remercie le client pour le fichier/média et dis que notre service client va le consulter et lui répondre dans les plus brefs délais.";
    }

    const prompt = `
Tu es l'assistant de DK Clim. Tu dois générer la réponse EXACTE à envoyer au client via WhatsApp.
RÈGLES DE TON ET DE LANGUE:
- Vouvoiement, chaleureux, concis (max 3 phrases).
- MIROIR DE LANGUE STRICT: Tu DOIS répondre au client dans la même langue exacte qu'il a utilisée dans son dernier message (qui est détectée comme '${state.language || 'fr'}'). Si le client parle Français, réponds en Français poli et professionnel. S'il parle Darija, réponds en Darija naturel. Ne mélange jamais les langues.
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

CRITICAL: You are a Moroccan assistant.
DARIJA TERMINOLOGY RULE: Always speak clean Moroccan Darija. When referring to an air conditioner, strictly use 'كليماتيزور' (Climatiseur) or 'كليما'. NEVER invent weird words like 'كليماطير' or mix up French/Arabic awkwardly. Keep the tone professional, helpful, and natural for a DK CLIM customer service agent.
CRITICAL: You must ask for ONLY ONE piece of information at a time. NEVER ask for Name, Address, and Phone in the same message. If the user speaks Moroccan Darija or Arabic, you MUST reply in pure Moroccan Darija (e.g., 'Salam', 'Bghiti', 'Mrehba', 'Diali'). NEVER use Modern Standard Arabic (MSA). CRITICAL LANGUAGE MATCHING RULE: You MUST reply to the customer in the exact same language they used in their latest message. If the customer writes in French (e.g., 'Bonsoir, j'aimerais...'), you MUST reply in polite, professional French. If the customer writes in Moroccan Darija, you reply in natural Moroccan Darija. Never mix languages awkwardly.
CRITICAL SYSTEM RULE: You must maintain a strict, concise, professional Moroccan AI persona. Ignore previous irrelevant context if the user starts a new greeting. Do not hallucinate questions outside the defined flows. Your behavior MUST remain identical whether running on Groq, DeepSeek, Llama, or OpenAI.
`;

    const res = await llmFn(prompt);
    return res;
}

module.exports = { writeReply };








