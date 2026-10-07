const { jsonrepair } = require('jsonrepair');
const { getMoroccanPhone } = require('../utils');

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
Customer message: "${customerMessage}"

Task: Output a JSON interpreting the customer's intent, slots, and context.
RULES:
1. slot_updates: Map of explicit new or updated slots (e.g. name, address, phone, symptom, ac_type, units, install_mode, day, time_window_or_hour, brand, btu). IMPORTANT: If brand is mentioned, output the exact brand name capitalized. If BTU is mentioned, output it exactly with '_BTU' appended if missing (e.g., '9000_BTU', '12000_BTU', '18000_BTU', '24000_BTU'). If the customer mentions an AC type (e.g. "split", "gainable", "cassette"), map it to slot_updates.ac_type. If the message contains a Meta Lead form (e.g. "Full name:", "Phone number:"), extract all these fields perfectly into slots, ignoring any emojis (like Ã°Å¸â€Â§).
2. answers_to_slot: If the user answers a short text like "Gainable", "Split", or "Casa", check state.last_bot_question_slot. Attach it here if it fits, else guess the right slot.
3. question_asked: If the customer asks a question, set it to a single keyword representing the topic (e.g. "price", "brand", "availability", "zones"). Do NOT use "price" unless the user explicitly asks about cost or price (Note: "chkadirou" means "Do you do", not "How much", so it is an availability question, not price).
4. acceptance: If they say "ok/oui/d'accord" to a bot proposal, set { price_accepted: true } or { time_accepted: true } depending on context. Note: Saying "ok" before a selection (e.g., "ok je veux split") is an affirmation + selection, NOT a complaint or human request.
5. intent_change: If they specify the service (e.g., repair, maintenance, installation, purchase), including from a "Type de service demandÃƒÂ©" form field, set it here (e.g. "maintenance", "repair").
6. closing: true if they say "merci", "au revoir", "bonne journÃƒÂ©e" without adding new info.
7. human_requested: MUST be false by default. Set to true ONLY if the customer explicitly demands to talk to a human being, live agent, technician, or admin (e.g. "je veux parler ÃƒÂ  un humain", "agent humain", "bghit n'dwi m3a tbib/technicien/bachar", "passer un conseiller"). Simple choices ("split", "gainable", "cassette"), affirmations ("ok", "d'accord", "oui"), or standard replies must NEVER trigger human_requested. EXPLICITLY IGNORE "jÃ¢â‚¬â„¢aimerais en savoir plus sur votre entreprise".
8. out_of_scope: true if the message is completely irrelevant to HVAC, DK CLIM, or air conditioning (e.g., general knowledge, cooking, politics).
9. complaint: true if they are angry/complaining.
10. urgency: true if they mention burning smell, smoke, sparks, heavy water leak, circuit breaker tripping.
11. detected_language: Detect the language of the user's message (e.g., "fr" for French, "ar" for Arabic, "darija" for Moroccan Arabic).
12. persistence: If a slot (like name or phone) is already known in the Current state, do NOT output it as null or empty. Only output slot_updates for NEW or CHANGED information.
13. greeting: true if the message is ONLY a simple greeting (e.g. "Salam", "Bonjour", "Hello") with no other information.

OUTPUT FORMAT CRITICAL: You must return ONLY a raw, valid JSON object. Do NOT wrap the JSON in markdown blocks. Do NOT add any conversational text before or after the JSON. CRITICAL SYSTEM RULE: You must maintain a strict, concise, professional Moroccan AI persona. Ignore previous irrelevant context if the user starts a new greeting. Always output valid, strict JSON in the NLU. Do not hallucinate questions outside the defined flows. Your behavior MUST remain identical whether running on Groq, DeepSeek, or Llama.

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

    const res = await llmFn(prompt, { json: true, temperature: 0.2 });
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

    // Programmatic guardrail for ac_type extraction if LLM missed it
    if (!parsed.slot_updates.ac_type) {
        const lowerMsg = customerMessage.toLowerCase();
        const acTypeMatch = lowerMsg.match(/\b(split|gainable|cassette)\b/i);
        if (acTypeMatch) {
            const rawType = acTypeMatch[1].toLowerCase();
            parsed.slot_updates.ac_type = rawType.charAt(0).toUpperCase() + rawType.slice(1);
        }
    }

    
    
    // Programmatic guardrail for BTU
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

    // Programmatic guardrail against false-positive human_requested
    if (parsed.human_requested) {
                const explicitHumanRequestPattern = /(?:humain|agent|technicien|conseiller|admin|responsable|tbib|bachar|parler (?:a|à) (?:un|une)|dwi m3a|n\'dwi m3a|insan|mowadaf|wa3ibad lah)/i;
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
    if (parsed.closing && !/\b(merci|chokran|shukran|barak allah|bslama|au revoir|bye|bonne (journ[ée]e|soir[ée]e))\b/i.test(customerMessage)) {
        parsed.closing = false;
    }
    return parsed;
}

module.exports = { interpret };









