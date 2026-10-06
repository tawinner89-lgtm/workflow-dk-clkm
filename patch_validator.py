import os

code = """const fs = require('fs');
const path = require('path');

let allowedPriceStrs = ["0"];
try {
    const businessConfigPath = path.join(__dirname, '../../src/config/business.json');
    const configText = fs.readFileSync(businessConfigPath, 'utf8');
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

async function validate(llmFn, reply, state, nextAction) {
    if (!reply || reply.trim() === '') return { valid: true, tokens: 0 };

    let tokens = 0;
    const lower = reply.toLowerCase();

    // 1. Sentence length constraint
    const sentences = reply.split(/[.?!]+[\\s\\n]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 6) {
        return { valid: false, reason: "Message trop long. Maximum 6 phrases.", tokens };
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
    const priceRegex = /(?:^|[\\s\\W])(\\d[\\d\\s,.]*)\\s*(?:dh|dhs|mad|dirham|dirhams)(?:[\\s\\W]|$)/gi;
    let rm;
    while ((rm = priceRegex.exec(lower)) !== null) {
        const rawNum = rm[1];
        const numStr = rawNum.replace(/\\D/g, "");
        if (numStr && !allowedPriceStrs.includes(numStr)) {
            return { valid: false, reason: `Prix inventé ou non autorisé: ${numStr}`, tokens };
        }
    }

    // 5. Programmatic Validation (Replaces LLM)
    if (nextAction.type === 'ask') {
        // A question must contain a question mark
        if (!reply.includes('?') && !reply.includes('؟')) {
            return { valid: false, reason: "Le message ne contient pas de question explicite (?).", tokens };
        }
    }

    return { valid: true, tokens };
}

module.exports = { validate };
"""

with open("lib/v2/validator.js", "w", encoding="utf-8") as f:
    f.write(code)
