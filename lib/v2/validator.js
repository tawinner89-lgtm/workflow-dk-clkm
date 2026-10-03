async function validate(llmFn, reply, state, nextAction) {
    if (!reply || reply.trim() === '') return { valid: true, tokens: 0 };

    let tokens = 0;
    const lower = reply.toLowerCase();

    // 1. Max 3 sentences unless it's a recap
    if (nextAction.type !== 'recap') {
        const sentences = reply.split(/[.?!]+[\s\n]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 4) { // allow 4 just in case
            return { valid: false, reason: "Message trop long. Maximum 3 phrases.", tokens };
        }
    }

    // 2. Banned words for booking
    if (nextAction.type === 'recap') {
        if (lower.includes('confirmé') || lower.includes('programmé') || lower.includes('technicien passera') || lower.includes('garantie')) {
            return { valid: false, reason: "Interdit d'utiliser 'confirmé', 'programmé', 'garantie' ou de promettre qu'un technicien passera. Utilise 'enregistré, en attente de confirmation'.", tokens };
        }
    }

    // 3. Identical to last text?
    if (state.last_bot_text && state.last_bot_text.toLowerCase().trim() === lower.trim()) {
        return { valid: false, reason: "Répétition exacte du dernier message.", tokens };
    }

    // 4. Currency check
    const priceRegex = /(?:^|[\s\W])(\d[\d\s,.]*)\s*(?:dh|dhs|mad|dirham|dirhams|d\.m|درهم|د\.م\.?)(?:[\s\W]|$)/gi;
    let rm;
    const businessConfigPath = require('path').join(__dirname, '../../src/config/business.json');
    let allowedPriceStrs = ["0"];
    try {
        const configText = require('fs').readFileSync(businessConfigPath, 'utf8');
        const config = JSON.parse(configText);
        if (config.prices) {
            if (config.prices.diagnostic?.amount) allowedPriceStrs.push(String(config.prices.diagnostic.amount));
            if (config.prices.installation_seule?.starts_at) allowedPriceStrs.push(String(config.prices.installation_seule.starts_at));
            if (config.prices.entretien_preventif?.starts_at) allowedPriceStrs.push(String(config.prices.entretien_preventif.starts_at));
        }
        if (config.sales_catalog?.promotions_completes) {
            Object.values(config.sales_catalog.promotions_completes).forEach(brandPromos => {
                brandPromos.forEach(t => {
                    if (t.prix_promo) allowedPriceStrs.push(String(t.prix_promo));
                    if (t.ancien_prix) allowedPriceStrs.push(String(t.ancien_prix));
                });
            });
        }
        if (config.repair_and_maintenance?.tarifs_services) {
            Object.values(config.repair_and_maintenance.tarifs_services).forEach(v => {
                const numMatches = String(v).match(/\d+/g);
                if (numMatches) allowedPriceStrs.push(...numMatches);
            });
        }
        const numMatches = configText.match(/\d+/g);
        if (numMatches) allowedPriceStrs.push(...numMatches);
    } catch(e) {}

    while ((rm = priceRegex.exec(lower)) !== null) {
        const rawNum = rm[1];
        const numStr = rawNum.replace(/\D/g, "");
        if (numStr && !allowedPriceStrs.includes(numStr)) {
            return { valid: false, reason: `Prix inventé ou non autorisé: ${numStr}`, tokens };
        }
    }

    // 5. LLM Validation of action execution
    const vPrompt = `
You are a Validator.
Action required: ${nextAction.type}
Action slots: ${JSON.stringify(nextAction.slots)}
Generated reply: "${reply}"

Did the reply actually carry out the exact action required?
If it's an "ask", did it explicitly ask for the slots: ${JSON.stringify(nextAction.slots)} and only those?
If it's an "answer_question", did it address the underlying customer question (e.g. confirming brand availability, pricing) AND ask a follow-up question? (DO NOT reject it for asking a follow-up question, this is required).
If it's a "media_fallback", did it tell the customer that the file will be reviewed?
If it's a "recap", did it recap the slots?

Reply EXACTLY with JSON:
{"valid": true_or_false, "reason": "why if false"}
`;

    try {
        const vRes = await llmFn(vPrompt);
        tokens += vRes.tokens || 0;
        let text = vRes.text.trim();
        if (text.startsWith("```json")) text = text.substring(7);
        else if (text.startsWith("```")) text = text.substring(3);
        if (text.endsWith("```")) text = text.substring(0, text.length - 3);
        
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
            if (parsed.valid === false) {
                return { valid: false, reason: parsed.reason, tokens };
            }
        }
    } catch(e) {
        // Fallback valid if LLM fails parsing
    }

    return { valid: true, tokens };
}

module.exports = { validate };




