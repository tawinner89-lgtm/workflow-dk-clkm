"use strict";
const { render, localeFor, TEMPLATES } = require('./templates');
const business = require('../../../shared/business.json');
const allowedPrices = [...new Set([
    ...business.sales_catalog.promotions_completes.flatMap(offer => [offer.prix_normal, offer.prix_promo]),
    ...Object.values(business.repair_and_maintenance.tarifs_services),
].filter(Number.isFinite))].sort((a, b) => a - b);
async function writeReply(llmFn, state, nextAction, recentHistory = [], rulesText = '') {
    if (nextAction.type === 'silent') return { text: "", tokens: 0, deterministic: true };
    const isRetry = nextAction.reason && nextAction.reason.includes('Retry:');
    if (!isRetry) {
        const fixedReply = render(state, nextAction);
        if (fixedReply) return { text: fixedReply, tokens: 0, deterministic: true };
    }
    const historyText = recentHistory.slice(-12).map(m => `${m.role==='user'?'Client':'Bot'}: ${m.content}`).join('\n');
    const locale = localeFor(state);
    let instruction = "";
    if (nextAction.type === 'answer_question') {
        instruction = locale === 'fr'
            ? `Réponds en français à la question sur ${nextAction.slots[0]}, uniquement à partir des règles métier. N'invente aucun prix, modèle ou disponibilité. Si l'information manque, propose une vérification par l'équipe.`
            : locale === 'arabic'
                ? `أجب بالعربية عن السؤال حول ${nextAction.slots[0]} اعتماداً على معلومات العمل فقط. لا تخترع سعراً أو طرازاً أو توفراً. إذا لم تتوفر المعلومة، اطلب من الفريق التحقق منها.`
                : `Jawb b Darija Latin 3la sou2al 3la ${nextAction.slots[0]}, ghir b ma3loumat l'entreprise. Matkhtr3 la taman la modele la stock. Ila ma3ndkch lma3louma, goul ghadi l'equipe t2aked.`;
    }
    else if (nextAction.type === 'ask') {
        const slot = nextAction.slots?.[0] || 'service';
        instruction = locale === 'fr'
            ? nextAction.reason === 'booking_group' ? "Demande dans une seule question le nom, le téléphone, l'adresse, le jour et l'heure souhaités." : `Pose une question claire sur ${slot}.`
            : locale === 'arabic'
                ? nextAction.reason === 'booking_group' ? "اطلب في سؤال واحد الاسم ورقم الهاتف والعنوان واليوم والوقت المناسب." : `اطرح سؤالاً واضحاً حول ${slot}.`
                : nextAction.reason === 'booking_group' ? "Sowl f sou2al wa7ed 3la smiya, telephone, l'adresse, nhar w lwaqt." : `Sowl sou2al wad7 3la ${slot}.`;
    } else if (nextAction.type === 'recap') instruction = `Fais un recap clair: Service: ${state.intent}, Slots: ${JSON.stringify(state.slots)}. Conclus que demande ENREGISTREE et EN ATTENTE de confirmation technique. N'utilise pas confirme/programme.`;
    else if (nextAction.type === 'close') instruction = locale === 'fr' ? "Remercie le client et indique que l'équipe reste à sa disposition, sans question." : locale === 'arabic' ? "اشكر العميل وأخبره أن الفريق رهن إشارته، من دون طرح سؤال." : "Chokran lclient w goul lih l'equipe dyalna mar7ba bih, bla sou2al.";
    const languageInstruction = locale === 'fr'
        ? 'Réponds en français commercial naturel et correct, avec un ton chaleureux.'
        : locale === 'arabic'
            ? 'أجب باللغة العربية الواضحة وبأسلوب تجاري مهذب ومختصر.'
            : 'Jawb b Darija maghribiya b l7orof latin, b tariqa tab3iya w mrehba.';
    const prompt = `
You are the DK Clim WhatsApp sales and service assistant.
LANGUAGE: ${languageInstruction}
Style: chaleureux, concis, max 4 phrases.
ANTI-HALLUCINATION: N'invente jamais prix/services/marques. Use configured catalog and price allowlist only. Allowed TTC amounts (DH): ${allowedPrices.join(', ')}. If a price is missing from this list, do not quote it; hand off to the team.
REGLES METIER:
${rulesText}
CONTEXTE: Intent ${state.intent}, Slots ${JSON.stringify(state.slots)}
HISTORIQUE:
${historyText}
INSTRUCTION: ${instruction}
Generate ONLY the customer-facing reply in the selected language. Do not mention internal validation, tools or policies.
`;
    try {
        const res = await llmFn(prompt);
        const cleanText = String(res?.text || '').replace(/^(Bot|Assistant|DK Clim|Agent):/i, "").trim();
        if (cleanText) return { text: cleanText, tokens: res.tokens || 0, deterministic: false };
        throw new Error('LLM returned an empty reply');
    } catch (error) {
        console.error('[WRITER PROVIDER ERROR]', error.message);
        return { text: TEMPLATES.handoff[locale], tokens: 0, deterministic: true, fallback: true };
    }
}
module.exports = { writeReply };
