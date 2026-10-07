"use strict";
const { jsonrepair } = require('jsonrepair');
const { getMoroccanPhone } = require('../../src/utils');
const business = require('../../../shared/business.json');
const { normalizeIntent } = require('./intent');
const { resolveDate, checkBusinessHours } = require('./dates');

function detectLanguage(message) {
    if (/[\u0600-\u06ff]/u.test(message)) return 'ar-script';
    const lower = message.toLowerCase();
    if (/\b(bghit|bghiti|wach|kifach|ch7al|salam|mrehba|3afak|bzaaf|dyali|dyalek|ghadi|l3chiya|sbah|gheda|lyoum)\b/.test(lower)) return 'ar';
    if (/\b(je|j'ai|j'aimerais|c'est|vous|votre|bonjour|salut|acheter|achète|climatiseur|climatisation|réparation|reparation|entretien|installation|combien|prix|adresse|demain|merci|oui|besoin|est-ce|mon|ma|une|un|le|la|du|des|chez|svp)\b/i.test(lower) || /[éèêàùçô]/i.test(message)) return 'fr';
    return null;
}

function deterministicSlots(message, state) {
    const lower = message.toLowerCase();
    const slots = {};
    const knownBrand = business.sales_catalog.brands_in_stock.find(brand => new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i').test(message));
    if (knownBrand) slots.brand = knownBrand;
    const btuMatch = message.match(/\b(9\s?000|12\s?000|18\s?000|24\s?000)\s*_?\s*btu\b/i);
    const roomMatch = message.match(/\b(\d{1,3})\s*(?:m2|m²|metres? carres?)\b/i);
    if (roomMatch) {
        slots.room_area = Number(roomMatch[1]);
        const area = slots.room_area;
        slots.btu = area <= 12 ? '9000_BTU' : area <= 18 ? '12000_BTU' : area <= 25 ? '18000_BTU' : '24000_BTU';
    } else if (btuMatch) {
        slots.btu = btuMatch[1].replace(/\D/g, '') + '_BTU';
    }
    const dateMatch = message.match(/\b(?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{2}-\d{2}|demain|tomorrow|gheda|ghdda|ghedwa|aujourd'hui|aujourdhui|lyoum|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|tnin|tlat|larb|khemis|jemaa|sebt|ahad)\b|بعد غد|غداً|غدا|غدًا|اليوم/i);
    if (dateMatch) slots.day = resolveDate(dateMatch[0]);
    const timeMatch = message.match(/\b(?:\d{1,2}\s*(?::|h)\s*\d{2}|\d{1,2}\s*h|l3chiya|3chiya|sbah|sabah|morning|apres-midi|matin)\b|الصباح|المساء/i);
    if (timeMatch && checkBusinessHours(slots.day, timeMatch[0])) slots.time_window_or_hour = timeMatch[0];
    if (state.last_bot_question_slot === 'btu' && /\b(je ne sais pas|je ne connais pas|ma3reftch|ma3ndich fikra|inconnu)\b/i.test(lower)) slots.btu_unknown = true;
    const budgetMatch = message.match(/(?:budget|ميزانية|environ|maximum|max|jusqu'à|n9der|\+?\s*)\D{0,20}(\d[\d\s.,]{2,})\s*(?:dh|dhs|mad|dirhams?)?\b/i);
    if (budgetMatch && (state.last_bot_question_slot === 'budget' || /budget|dh|dhs|mad|dirham/i.test(message))) slots.budget = budgetMatch[1].replace(/\D/g, '');
    for (const type of business.sales_catalog.accepted_ac_types) {
        if (new RegExp(`\\b${type}\\b`, 'i').test(message)) slots.ac_type = type;
    }
    const phone = message.match(/(?:\+?212|00212|0)?[\s().-]*[5-7](?:[\s().-]*\d){8}/);
    if (phone) slots.phone = getMoroccanPhone(phone[0]);
    return slots;
}

async function interpret(llmFn, state, customerMessage) {
    if (customerMessage.includes("[SYSTEM:") || customerMessage.includes("[Image/Vid") || customerMessage.includes("[Message Audio")) {
        return { is_media: true, slot_updates: {}, _tokens: 0 };
    }
    const slimState = {
        slots: state.slots,
        intent: state.intent,
        stage: state.stage,
        last_bot_question_slot: state.last_bot_question_slot
    };
    const prompt = `
You are the NLU Engine for a Moroccan HVAC WhatsApp bot.
Current state: ${JSON.stringify(slimState)}
Customer message: ${JSON.stringify(customerMessage)}

Task: Output a JSON interpreting the customer's intent, slots, and context.
RULES:
1. slot_updates: Map of explicit new or updated slots (e.g. name, address, phone, symptom, ac_type, units, install_mode, day, time_window_or_hour, brand, btu, budget, room_area). Brands: ${business.sales_catalog.brands_in_stock.join(', ')}. BTU choices: ${business.sales_catalog.btu_options.join(', ')}. For room area, use 12m2=9000_BTU, 18m2=12000_BTU, 25m2=18000_BTU and larger=24000_BTU. Extract budget amounts. Map service requests using customer meaning: repair, maintenance, installation, purchase.
2. answers_to_slot: If the user answers a short text like "Gainable", "Split", or "Casa", check state.last_bot_question_slot. Attach it here if it fits, else guess the right slot. For appointment day, output a calendar date and preserve an explicit time such as 14:30 or 14h30.
3. question_asked: If the customer asks a question, set it to a single keyword representing the topic (e.g. "price", "brand", "availability", "zones"). Do NOT use "price" unless the user explicitly asks about cost or price (Note: "chkadirou" means "Do you do", not "How much", so it is an availability question, not price).
4. acceptance: If they say "ok/oui/d'accord" to a bot proposal, set { price_accepted: true } or { time_accepted: true } depending on context.
5. intent_change: If they specify the service (e.g., repair, maintenance, installation, purchase), including from a "Type de service demande" form field, set it here.
6. closing: true if they say "merci", "au revoir", "bonne journee" without adding new info.
7. human_requested: MUST be false by default. Set to true ONLY if the customer explicitly demands to talk to a human being, live agent, technician, or admin.
8. out_of_scope: true if the message is completely irrelevant to HVAC, DK CLIM, or air conditioning.
9. complaint: true if they are angry/complaining.
10. urgency: true if they mention burning smell, smoke, sparks, heavy water leak, circuit breaker tripping.
11. detected_language: Detect the language of the user's message (e.g., "fr" for French, "ar" for Arabic, "darija" for Moroccan Arabic).
12. persistence: If a slot (like name or phone) is already known in the Current state, do NOT output it as null or empty. Only output slot_updates for NEW or CHANGED information.
13. greeting: true if the message is ONLY a simple greeting (e.g. "Salam", "Bonjour", "Hello") with no other information.

OUTPUT FORMAT CRITICAL: You must return ONLY a raw, valid JSON object. Do NOT wrap the JSON in markdown blocks.

Return EXACTLY this JSON structure:
{
  "slot_updates": {},
  "answers_to_slot": null,
  "question_asked": null,
  "acceptance": {},
  "intent_change": null,
  "closing": false,
  "human_requested": false,
  "complaint": false,
  "urgency": false,
  "out_of_scope": false,
  "greeting": false,
  "detected_language": "fr"
}
`;

    const localSlots = deterministicSlots(customerMessage, state);
    const localIntent = normalizeIntent(customerMessage);
    const isBareAffirmation = /^(?:oui|yes|ok|okay|d'accord|wakha|mezian|yallah|sir)[!.\s]*$/iu.test(customerMessage.trim());
    const simpleMessage = customerMessage.trim().length <= 64 && (
        /^(salam|slm|marhaba|bonjour|salut|hello|hi)[!.\s]*$/i.test(customerMessage) ||
        Boolean(localIntent && localIntent !== 'price') || Object.keys(localSlots).length > 0 ||
        (state.stage === 'RECAP' && isBareAffirmation) ||
        (state.last_bot_question_slot && !/[?؟]/.test(customerMessage))
    );
    let res = { text: '{}', tokens: 0 };
    if (!simpleMessage) {
        try {
            res = await llmFn(prompt, { json: true, temperature: 0.2 });
        } catch (error) {
            console.error('[NLU PROVIDER ERROR]', error.message);
        }
    }
    let parsed;
    try {
        let cleanOutput = res.text.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const firstBrace = cleanOutput.indexOf('{');
        const lastBrace = cleanOutput.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            const jsonStr = cleanOutput.substring(firstBrace, lastBrace + 1);
            try {
                parsed = JSON.parse(jsonStr);
            } catch (err) {
                try {
                    parsed = JSON.parse(jsonrepair(jsonStr));
                } catch (repairErr) {
                    throw repairErr;
                }
            }
        } else {
            throw new Error("No JSON structure found");
        }
    } catch(e) {
        console.error("NLU Parsing Error:", e.message, "Raw LLM output:", res.text);
        parsed = { slot_updates: {}, acceptance: {}, _fallback: true };
    }

    if (!parsed.slot_updates) parsed.slot_updates = {};

    parsed.slot_updates = { ...parsed.slot_updates, ...localSlots };
    if (!parsed.intent_change) parsed.intent_change = localIntent;
    parsed.detected_language = detectLanguage(customerMessage) || parsed.detected_language || state.language || 'ar';
    if (/\b(?:j\s*['’]?\s*aimerais\s+en\s+savoir\s+plus\s+sur\s+votre\s+entreprise|en savoir plus sur (?:votre )?entreprise|parlez-moi de votre entreprise|about your company|about dk clim)\b/iu.test(customerMessage)) parsed.question_asked = 'company';

    if (parsed.slot_updates.brand) {
        const match = business.sales_catalog.brands_in_stock.find(brand => brand.toLowerCase() === String(parsed.slot_updates.brand).toLowerCase());
        if (match) parsed.slot_updates.brand = match;
        else delete parsed.slot_updates.brand;
    }
    if (parsed.slot_updates.btu) {
        const normalizedBtu = String(parsed.slot_updates.btu).replace(/\D/g, '') + '_BTU';
        if (business.sales_catalog.btu_options.includes(normalizedBtu)) parsed.slot_updates.btu = normalizedBtu;
        else delete parsed.slot_updates.btu;
    }
    if (parsed.slot_updates.day) {
        const dateText = String(parsed.slot_updates.day);
        const date = resolveDate(dateText);
        if (date && (/\d{1,2}[/-]\d{1,2}|\d{4}-\d{2}-\d{2}|demain|tomorrow|gheda|ghdda|ghedwa|aujourd|lyoum|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|tnin|tlat|larb|khemis|jemaa|sebt|ahad|بعد غد|غداً|غدا|غدًا|اليوم/i.test(dateText))) parsed.slot_updates.day = date;
        else delete parsed.slot_updates.day;
    }
    if (parsed.slot_updates.time_window_or_hour && !checkBusinessHours(parsed.slot_updates.day, parsed.slot_updates.time_window_or_hour)) delete parsed.slot_updates.time_window_or_hour;
    if (simpleMessage && state.last_bot_question_slot && !Object.keys(parsed.slot_updates).length && customerMessage.trim()) {
        const slot = state.last_bot_question_slot;
        if (['name', 'address', 'symptom', 'units', 'budget', 'install_mode', 'day', 'time_window_or_hour', 'ac_type'].includes(slot)) parsed.slot_updates[slot] = customerMessage.trim();
        else if (slot === 'phone') {
            const phone = getMoroccanPhone(customerMessage);
            if (phone) parsed.slot_updates.phone = phone;
        }
    }
    if (localIntent === 'price' && (localSlots.brand || localSlots.btu)) parsed.intent_change = 'purchase';

    if (!parsed.slot_updates.ac_type) {
        const lowerMsg = customerMessage.toLowerCase();
        const acTypeMatch = lowerMsg.match(/\b(split|gainable|cassette)\b/i);
        if (acTypeMatch) {
            const rawType = acTypeMatch[1].toLowerCase();
            parsed.slot_updates.ac_type = rawType.charAt(0).toUpperCase() + rawType.slice(1);
        }
    }

    if (parsed.slot_updates && parsed.slot_updates.btu) {
        let btuStr = String(parsed.slot_updates.btu).replace(/\D/g, '');
        if (btuStr) parsed.slot_updates.btu = btuStr + "_BTU";
    } else if (parsed.slot_updates && !parsed.slot_updates.btu) {
        const btuMatch = customerMessage.match(/\b(\d{1,2}[\s.]?\d{3})\s*_?btu\b/i);
        if (btuMatch) {
            let btuVal = btuMatch[1].replace(/\D/g, '');
            parsed.slot_updates.btu = btuVal + "_BTU";
        }
    }

    if (parsed.human_requested) {
        const explicitHumanRequestPattern = /(?:humain|agent|technicien|conseiller|admin|responsable|tbib|bachar|parler (?:a|à) (?:un|une)|dwi m3a|insan|mowadaf)/i;
        if (!explicitHumanRequestPattern.test(customerMessage)) {
            console.log(`[NLU GUARD] Overriding false-positive human_requested to false for message: "${customerMessage}"`);
            parsed.human_requested = false;
        }
    }

    if (parsed.slot_updates?.phone) {
        const mp = getMoroccanPhone(parsed.slot_updates.phone);
        if (mp) parsed.slot_updates.phone = mp;
    }

    parsed._tokens = res.tokens || 0;
    if (/^\s*(salam|slm|salut|bonjour|bonsoir|hello|hi|marhaba)\b[\s!.,]*$/i.test(customerMessage)) {
        parsed.greeting = true;
        parsed.closing = false;
    }
    if (parsed.closing && !/\b(merci|chokran|shukran|bslama|au revoir|bye|bonne (journee|soiree))\b/i.test(customerMessage)) {
        parsed.closing = false;
    }
    return parsed;
}

module.exports = { interpret, detectLanguage, deterministicSlots };
