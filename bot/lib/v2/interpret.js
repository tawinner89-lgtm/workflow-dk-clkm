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
    const variantBrand = slots.brand || state.slots?.brand;
    const variantBtu = slots.btu || state.slots?.btu;
    if (variantBrand && variantBtu) {
        const matchingOffers = business.sales_catalog.promotions_completes.filter(offer => offer.brand.toLowerCase() === variantBrand.toLowerCase() && offer.btu === variantBtu);
        const explicitVariant = matchingOffers.find(offer => {
            const variant = offer.modele.toLowerCase();
            const markers = ['gris', 'blanc', 'noir', 'on/off', 'r32', 'wifi'];
            return markers.some(marker => variant.includes(marker) && new RegExp(`\\b${marker.replace('/', '\\\\/')}\\b`, 'i').test(message));
        });
        if (explicitVariant) slots.model_variant = explicitVariant.modele;
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

    // When we explicitly asked for the booking details together, accept the
    // common free-text pattern "Full Name 06xxxxxxxx City Neighborhood".
    // Keep the phone validator strict; a short number is never saved as valid.
    if (state.last_bot_question_slot === 'booking_group') {
        const contactMatch = message.match(/(?:\+212|00212|0)[\s().-]*[5-7](?:[\s().-]*\d){7,8}/i);
        if (contactMatch) {
            const validPhone = getMoroccanPhone(contactMatch[0]);
            if (validPhone) slots.phone = validPhone;
            else slots._invalidPhone = true;

            const beforePhone = message.slice(0, contactMatch.index)
                .replace(/^\s*(?:salam|slm|bonjour|salut)[,!.\s]*/i, '')
                .trim();
            const afterPhone = message.slice(contactMatch.index + contactMatch[0].length)
                .replace(/^\s*(?:f|fi|a|à|adresse\s*[:=]?)\s*/i, '')
                .trim();
            if (!state.slots?.name && !slots.name && beforePhone) {
                const name = beforePhone.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
                if (/^[\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){1,4}$/u.test(name)) slots.name = name;
            }
            if (!state.slots?.address && !slots.address && afterPhone && /[\p{L}]/u.test(afterPhone)) {
                slots.address = afterPhone.replace(/\s+/g, ' ');
            }
        }
    }
    if (normalizeIntent(message) === 'purchase' && /\b(?:m3a\s+(?:tarkib|installation)|avec\s+(?:installation|pose)|on?\s*r(?:a)?keb|installer|pose\s+comprise)\b/i.test(message)) {
        slots.install_mode = 'purchase_with_installation';
    }

    // Meta click-to-WhatsApp ads and website forms often prefill a labeled
    // message. Read only explicit label/value lines so this fallback remains
    // safer than guessing a name or address from free text.
    const formLabels = {
        name: /^(?:nom(?:\s+(?:et\s+pr[eé]nom|complet))?|name|client(?:\s+name)?|full\s+name)$/i,
        address: /^(?:adresse|address|adresse\s+compl[eè]te|lieu|location)$/i,
        phone: /^(?:t[eé]l[eé]phone|t[eé]l|tel|phone|num[eé]ro(?:\s+de\s+t[eé]l[eé]phone)?)$/i,
        brand: /^(?:marque|brand)$/i,
        btu: /^(?:btu|puissance)$/i,
        budget: /^(?:budget|budget\s+approximatif)$/i,
        room_area: /^(?:surface|surface\s+de\s+la\s+pi[eè]ce|room\s+area)$/i,
        symptom: /^(?:panne|probl[eè]me|sympt[oô]me|description\s+du\s+probl[eè]me)$/i,
        day: /^(?:jour|date|day)$/i,
        time_window_or_hour: /^(?:heure|horaire|time|cr[eé]neau)$/i,
        service_type: /^(?:service|type\s+de\s+(?:service|demande)|besoin|motif)$/i,
    };
    for (const line of message.split(/[\r\n;|]+/)) {
        const match = line.trim().match(/^([^:=]{2,40})\s*[:=]\s*(.+)$/);
        if (!match) continue;
        const label = match[1].trim();
        const value = match[2].trim();
        for (const [slot, pattern] of Object.entries(formLabels)) {
            if (!pattern.test(label) || !value) continue;
            if (slot === 'phone') {
                const parsedPhone = getMoroccanPhone(value);
                if (parsedPhone) slots.phone = parsedPhone;
            } else if (slot === 'brand') {
                const parsedBrand = business.sales_catalog.brands_in_stock.find(item => item.toLowerCase() === value.toLowerCase());
                if (parsedBrand) slots.brand = parsedBrand;
            } else if (slot === 'btu') {
                const digits = value.replace(/\D/g, '');
                const parsedBtu = `${digits}_BTU`;
                if (business.sales_catalog.btu_options.includes(parsedBtu)) slots.btu = parsedBtu;
            } else if (slot === 'budget' || slot === 'room_area') {
                const digits = value.replace(/[^\d.,]/g, '').replace(',', '.');
                if (digits) slots[slot] = Number(digits);
            } else if (slot === 'service_type') {
                const parsedIntent = normalizeIntent(value);
                if (parsedIntent) slots.service_type = parsedIntent;
            } else if (slot === 'day') {
                const parsedDay = resolveDate(value);
                if (parsedDay) slots.day = parsedDay;
            } else {
                slots[slot] = value;
            }
            break;
        }
    }
    if (slots.service_type && !state.intent) slots.intent = slots.service_type;
    if (!slots.btu && slots.room_area) {
        const area = Number(slots.room_area);
        slots.btu = area <= 12 ? '9000_BTU' : area <= 18 ? '12000_BTU' : area <= 25 ? '18000_BTU' : '24000_BTU';
    }
    return slots;
}

function detectQuestionAsked(message) {
    const clean = String(message || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/(?:\bwhere\s+(?:are\s+you|is\s+dk\s+clim|are\s+you\s+based|are\s+you\s+located)|\bheadquarters\b|\b(?:votre|dk\s+clim|l'entreprise)\s+(?:siege|adresse)\b|\bsiege\b|\bou\s+(?:se\s+trouve|etes-vous|est\s+situe)|\bvous\s+etes\s+(?:situe|base)|\bquelle\s+ville\b|\bfin\s+(?:kayn|kayna)\b|\bsiege\s+dyalkom\b|\bl\s*['’]?adresse\s+dyal(?:kom|dk\s+clim)\b|\b(?:wach|wash)\b.{0,35}\b(?:katkhadmo|katkhdmo|katdirou|kat3amlo)\b.{0,30}\b(?:f|fi|a)\s+[\p{L}]+|\bintervenez-vous\b.{0,30}\b(?:a|dans|sur)\b|\bservices?\s+(?:a|dans|sur)\b|فين|أين|مقر|عنوانكم|واش.{0,35}(?:كتخدمو|تخدمون|كتديرو|تدخلوا).{0,30}(?:ف|في))/iu.test(clean)) return 'company';
    if (/(?:bch7al|ch7al|taman|prix|price|combien|combien coute|quel est le prix|a combien|how much)/i.test(clean)) return 'price';
    if (/(?:disponibil|en stock|stock|kayn|kayna|mawjoud|available|availability)/i.test(clean)) return 'availability';
    return null;
}

function detectLost(message) {
    return /(?:ma\s*3reftch|ma3reftch|talef|ach\s+(?:tnse7ni|nakhod|nakhed)|a7sen\s+haja|conseil|meilleur|je\s+ne\s+sais\s+pas|je\s+h[eé]site|je\s+ne\s+connais\s+pas)/iu.test(String(message || ''));
}

function isCorrection(message) {
    return /^(?:\s*(?:la|non|no)\s+)|(?:^|\s)(?:machi|not\s+that|en\s+fait|plut[oô]t|ghalat|erreur|pardon)(?:\s|$)/iu.test(String(message || ''));
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
    const systemPrompt = `You are DK Clim NLU. Extract from ANY Moroccan message (Darija Latin, French, Arabic) in ANY order:
{"intent":"purchase|panne|entretien|installation|devis|price|availability|null","intent_change":"purchase|repair|maintenance|installation|price|availability|null","slot_updates":{"brand":null,"btu":null,"budget":null,"name":null,"address":null,"phone":null,"room_area":null,"symptom":null,"day":null,"time_window_or_hour":null},"question_asked":"price|availability|company|null","detected_language":"ar|fr","is_correction":false,"is_lost":false}
Rules:
- Extract every slot explicitly present, regardless of order. Example: bghit Carrier 12000 Casa 06... => brand Carrier, btu 12000_BTU, address Casa, phone.
- If is_correction, overwrite the previous slot with the corrected value; preserve unrelated known slots.
- If question_asked=price and brand+btu are known, answer from the configured price allowlist; never ask budget.
- If is_lost and brand or BTU is unknown, ask for room_area and budget for a recommendation.
- Never ask again for a slot already present in state.slots, except when explicitly corrected.
- Return only valid JSON. Do not invent any slot values.`;
    const prompt = `
You are the NLU Engine for a Moroccan HVAC WhatsApp bot.
Current state: ${JSON.stringify(slimState)}
Customer message: ${JSON.stringify(customerMessage)}

Task: Output a JSON interpreting the customer's intent, slots, and context.
RULES:
1. slot_updates: Map of explicit new or updated slots (e.g. name, address, phone, symptom, ac_type, units, install_mode, day, time_window_or_hour, brand, btu, model_variant, budget, room_area). Brands: ${business.sales_catalog.brands_in_stock.join(', ')}. BTU choices: ${business.sales_catalog.btu_options.join(', ')}. For room area, use 12m2=9000_BTU, 18m2=12000_BTU, 25m2=18000_BTU and larger=24000_BTU. Extract budget amounts. Map service requests using customer meaning: repair, maintenance, installation, purchase.
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
    const localLost = detectLost(customerMessage);
    const localCorrection = isCorrection(customerMessage);
    if (localCorrection && state.intent === 'purchase' && !localSlots.btu) {
        const correctedBtu = customerMessage.match(/\b(9000|12000|18000|24000)(?:\s*_?\s*btu)?\b/i);
        if (correctedBtu) localSlots.btu = `${correctedBtu[1]}_BTU`;
    }
    const isBareAffirmation = /^(?:oui|yes|ok|okay|d'accord|wakha|mezian|yallah|sir)[!.\s]*$/iu.test(customerMessage.trim());
    const isDeterministicAnswer = Boolean(state.last_bot_question_slot && Object.keys(localSlots).length > 0);
    const simpleMessage = isDeterministicAnswer || (customerMessage.trim().length <= 64 && (
        /^(salam|slm|marhaba|bonjour|salut|hello|hi)[!.\s]*$/i.test(customerMessage) ||
        (/^(?:salam\s+)?(?:bghit\s+(?:nchri\s+)?clim|bghit\s+nchri)$/i.test(customerMessage.trim())) ||
        localLost ||
        (state.stage === 'RECAP' && isBareAffirmation) ||
        (state.last_bot_question_slot && !/[?؟]/.test(customerMessage) && !localCorrection && Object.keys(localSlots).length === 0)
    ));
    let res = { text: '{}', tokens: 0 };
    if (!simpleMessage) {
        try {
            res = await llmFn(prompt, { json: true, temperature: 0, system: systemPrompt });
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

    parsed.phone_invalid = Boolean(localSlots._invalidPhone);
    delete localSlots._invalidPhone;
    parsed.slot_updates = { ...parsed.slot_updates, ...localSlots };
    if (localSlots.install_mode === 'purchase_with_installation') parsed.intent_change = 'purchase';
    if (parsed.slot_updates.phone) parsed.phone_invalid = false;
    if (localSlots.intent) {
        parsed.intent_change = localSlots.intent;
        delete parsed.slot_updates.intent;
    }
    parsed.is_lost = Boolean(parsed.is_lost || localLost);
    parsed.is_correction = Boolean(parsed.is_correction || localCorrection);
    if (localCorrection && state.slots.brand) {
        const rejectedBrand = business.sales_catalog.brands_in_stock.find(brand => new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i').test(customerMessage));
        if (rejectedBrand && rejectedBrand.toLowerCase() === String(state.slots.brand).toLowerCase() && (!localSlots.brand || localSlots.brand.toLowerCase() === rejectedBrand.toLowerCase())) {
            delete parsed.slot_updates.brand;
            parsed.clear_slots = [...new Set([...(parsed.clear_slots || []), 'brand'])];
        }
    }
    if (!parsed.intent_change) parsed.intent_change = localIntent === 'price' && state.intent ? null : (localIntent || (localLost && !state.intent ? 'purchase' : null));
    parsed.detected_language = detectLanguage(customerMessage) || parsed.detected_language || state.language || 'ar';
    if (/\b(?:j\s*['’]?\s*aimerais\s+en\s+savoir\s+plus\s+sur\s+votre\s+entreprise|en savoir plus sur (?:votre )?entreprise|parlez-moi de votre entreprise|about your company|about dk clim)\b/iu.test(customerMessage)) parsed.question_asked = 'company';
    const localQuestion = detectQuestionAsked(customerMessage);
    if (localQuestion === 'company') {
        parsed.question_asked = 'company';
        if (!localSlots.brand && !localSlots.btu) parsed.intent_change = null;
    } else if (!parsed.question_asked) {
        parsed.question_asked = localQuestion || parsed.question_asked;
    }

    if (parsed.slot_updates.brand) {
        const match = business.sales_catalog.brands_in_stock.find(brand => brand.toLowerCase() === String(parsed.slot_updates.brand).toLowerCase());
        if (match) parsed.slot_updates.brand = match;
        else delete parsed.slot_updates.brand;
    }
    if (parsed.slot_updates.model_variant) {
        const brand = parsed.slot_updates.brand || state.slots.brand;
        const btu = parsed.slot_updates.btu || state.slots.btu;
        const validVariant = business.sales_catalog.promotions_completes.find(offer => offer.brand.toLowerCase() === String(brand || '').toLowerCase() && offer.btu.toUpperCase() === String(btu || '').toUpperCase() && offer.modele.toLowerCase() === String(parsed.slot_updates.model_variant).toLowerCase());
        if (validVariant) parsed.slot_updates.model_variant = validVariant.modele;
        else delete parsed.slot_updates.model_variant;
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
    if (localIntent === 'price' && state.intent === 'purchase') parsed.intent_change = null;
    else if (localIntent === 'price' && (localSlots.brand || localSlots.btu)) parsed.intent_change = 'purchase';

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

module.exports = { interpret, detectLanguage, deterministicSlots, detectQuestionAsked, detectLost, isCorrection };
