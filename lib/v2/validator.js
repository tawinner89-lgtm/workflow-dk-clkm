const fs = require('fs');
const path = require('path');

const allowedPriceStrs = new Set();
allowedPriceStrs.add("0");

(function cacheBusinessConfig() {
    try {
        const possiblePaths = [
            path.join(__dirname, '../../src/config/business.json'),
            path.join(process.cwd(), 'src/config/business.json')
        ];
        const businessConfigPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
        const configText = fs.readFileSync(businessConfigPath, 'utf8');
        const config = JSON.parse(configText);
        
        if (config.prices) {
            if (config.prices.diagnostic?.amount) allowedPriceStrs.add(String(config.prices.diagnostic.amount));
            if (config.prices.installation_seule?.starts_at) allowedPriceStrs.add(String(config.prices.installation_seule.starts_at));
            if (config.prices.entretien_preventif?.starts_at) allowedPriceStrs.add(String(config.prices.entretien_preventif.starts_at));
        }
        if (config.sales_catalog?.promotions_completes) {
            Object.values(config.sales_catalog.promotions_completes).forEach(brandPromos => {
                brandPromos.forEach(t => {
                    if (t.prix_promo) allowedPriceStrs.add(String(t.prix_promo));
                    if (t.ancien_prix) allowedPriceStrs.add(String(t.ancien_prix));
                });
            });
        }
        if (config.repair_and_maintenance?.tarifs_services) {
            Object.values(config.repair_and_maintenance.tarifs_services).forEach(v => {
                const numMatches = String(v).match(/\d+/g);
                if (numMatches) numMatches.forEach(m => allowedPriceStrs.add(m));
            });
        }
        const numMatches = configText.match(/\d+/g);
        if (numMatches) numMatches.forEach(m => allowedPriceStrs.add(m));
    } catch(e) {
        console.error("Failed to load business.json for validator:", e.message);
    }
})();

async function validate(llmFn, reply, state, nextAction) {
    if (!reply || reply.trim() === '') return { valid: true, tokens: 0 };

    let tokens = 0;
    const lower = reply.toLowerCase();

    // SOFT FAIL: Sentence length constraint
    const sentences = reply.split(/[.?!]+[\s\n]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 6) {
        return { valid: false, reason: "Message trop long. Maximum 6 phrases.", type: 'soft', tokens };
    }

    // HARD FAIL: Banned words for booking
    if (nextAction.type === 'recap') {
        if (lower.includes('confirmé') || lower.includes('programmé') || lower.includes('technicien passera') || lower.includes('garantie')) {
            return { valid: false, reason: "Banned words for recap.", type: 'hard', tokens };
        }
    }

    // SOFT FAIL: Identical to last text?
    if (state.last_bot_text && state.last_bot_text.toLowerCase().trim() === lower.trim()) {
        return { valid: false, reason: "Répétition exacte du dernier message.", type: 'soft', tokens };
    }

    // HARD FAIL: Currency check
    const priceRegex = /(?:^|[\s\W])(\d[\d\s,.]*)\s*(?:dh|dhs|mad|dirham|dirhams)(?:[\s\W]|$)/gi;
    let rm;
    while ((rm = priceRegex.exec(lower)) !== null) {
        const rawNum = rm[1];
        const numStr = rawNum.replace(/\D/g, "");
        if (numStr && !allowedPriceStrs.has(numStr)) {
            return { valid: false, reason: `Prix inventé ou non autorisé: ${numStr}`, type: 'hard', tokens };
        }
    }

    // SOFT FAIL: Missing question mark on ask
    if (nextAction.type === 'ask') {
        if (!reply.includes('?') && !reply.includes('؟')) {
            return { valid: false, reason: "Le message ne contient pas de question explicite (?).", type: 'soft', tokens };
        }
    }

    return { valid: true, tokens };
}

module.exports = { validate };
