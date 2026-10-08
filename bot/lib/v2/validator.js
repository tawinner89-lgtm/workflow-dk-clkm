"use strict";
const business = require('../../../shared/business.json');

const allowedPriceStrs = new Set();
function addNumbers(value) {
    if (value && typeof value === 'object') return Object.values(value).forEach(addNumbers);
    const found = String(value ?? '').match(/\d+(?:[\s,.]\d+)*/g) || [];
    found.forEach(n => allowedPriceStrs.add(n.replace(/\D/g, '')));
}
for (const offer of business.sales_catalog?.promotions_completes || []) {
    addNumbers(offer.prix_promo);
    addNumbers(offer.prix_normal);
}
addNumbers(business.repair_and_maintenance?.tarifs_services || {});
const allowedBrands = new Set(business.sales_catalog.brands_in_stock.map(v => v.toLowerCase()));
const allowedBtus = new Set(business.sales_catalog.btu_options.map(v => v.toUpperCase()));
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const brandMentionRegex = new RegExp(`\\b(${[...allowedBrands].map(escapeRegex).join('|')})\\b`, 'gi');

async function validate(llmFn, reply, state, nextAction) {
    if (!reply || reply.trim() === '') return { valid: true, tokens: 0 };
    let tokens = 0;
    const lower = reply.toLowerCase();


    if (state.intent === 'purchase') {
        if (/\b\d+\s*(?:en stock|f\s+stock|في\s+المخزون|units?\s+available|unit[eé]s?\s+en\s+stock)\b/iu.test(reply)) {
            return { valid: false, reason: 'La quantité exacte en stock est réservée à l’équipe interne.', type: 'hard', tokens };
        }
        const btuMentions = [...reply.matchAll(/\b(\d[\d\s,.]*)\s*_?\s*btu\b/gi)];
        for (const match of btuMentions) {
            const btu = match[1].replace(/\D/g, '') + '_BTU';
            if (!allowedBtus.has(btu)) return { valid: false, reason: `BTU invente ou non autorise: ${btu}`, type: 'hard', tokens };
        }
        const brandMentions = [...reply.matchAll(brandMentionRegex)];
        for (const match of brandMentions) {
            if (!allowedBrands.has(match[1].toLowerCase())) return { valid: false, reason: `Marque non autorisee: ${match[1]}`, type: 'hard', tokens };
        }
        if (state.slots.brand && !allowedBrands.has(String(state.slots.brand).toLowerCase())) {
            return { valid: false, reason: `Marque non autorisee: ${state.slots.brand}`, type: 'hard', tokens };
        }
        if (state.slots.btu && !allowedBtus.has(String(state.slots.btu).toUpperCase())) {
            return { valid: false, reason: `BTU non autorise: ${state.slots.btu}`, type: 'hard', tokens };
        }
    }

    const sentences = reply.split(/[.?!؟]+[\s\n]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 6) {
        return { valid: false, reason: "Message trop long. Maximum 6 phrases.", type: 'soft', tokens };
    }

    if (nextAction.type === 'recap') {
        const prematureBookingClaim = /\b(?:rendez-vous|commande|intervention|visite)\s+(?:est\s+)?(?:confirm[ée]e?|programm[ée]e?)\b|\b(?:votre\s+)?technicien\s+passera\b|\bgarantie\b/iu;
        if (prematureBookingClaim.test(reply)) {
            return { valid: false, reason: "Le message annonce une confirmation ou une garantie avant validation.", type: 'soft', tokens };
        }
    }

    if (state.last_bot_text && state.last_bot_text.toLowerCase().trim() === lower.trim()) {
        return { valid: false, reason: "Repetition exacte du dernier message.", type: 'soft', tokens };
    }

    const priceRegex = /(?:^|[\s\W])(\d+)\s*(?:dh|dhs|mad|dirham|dirhams)(?:[\s\W]|$)/gi;
    let rm;
    const normalizePrice = value => value.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/\D/g, '');
    while ((rm = priceRegex.exec(lower)) !== null) {
        const rawNum = rm[1];
        const numStr = normalizePrice(rawNum);
        if (numStr && !allowedPriceStrs.has(numStr)) {
            return { valid: false, reason: `Prix invente ou non autorise: ${numStr}`, type: 'hard', tokens };
        }
    }

    const arabicPriceRegex = /(?:^|[\s\W])([\d٠-٩]+)\s*(?:درهم|دراهم|د\.م\.?)(?:[\s\W]|$)/giu;
    while ((rm = arabicPriceRegex.exec(reply)) !== null) {
        const numStr = normalizePrice(rm[1]);
        if (numStr && !allowedPriceStrs.has(numStr)) return { valid: false, reason: `Prix invente ou non autorise: ${numStr}`, type: 'hard', tokens };
    }
    // A price without currency still needs a realistic multi-digit amount;
    // this avoids treating Darija words such as "d9i9" as a quoted price.
    const barePriceRegex = /(?:prix|price|taman|الثمن|السعر)[^0-9٠-٩]{0,16}([\d٠-٩]{3,})/giu;
    while ((rm = barePriceRegex.exec(reply)) !== null) {
        const numStr = normalizePrice(rm[1]);
        if (numStr && !allowedPriceStrs.has(numStr)) return { valid: false, reason: `Prix invente ou non autorise: ${numStr}`, type: 'hard', tokens };
    }

    if (nextAction.type === 'ask') {
        if (!reply.includes('?') && !reply.includes('؟')) {
            return { valid: false, reason: "Le message ne contient pas de question explicite (?).", type: 'soft', tokens };
        }
    }

    return { valid: true, tokens };
}

module.exports = { validate };
