const { getMoroccanPhone } = require('../utils');

async function interpret(llmFn, state, customerMessage) {
    const prompt = `
You are the NLU Engine for a Moroccan HVAC WhatsApp bot.
Current state: ${JSON.stringify(state)}
Customer message: "${customerMessage}"

Task: Output a JSON interpreting the customer's intent, slots, and context.
RULES:
1. slot_updates: Map of explicit new or updated slots (e.g. name, address, phone, symptom, ac_type, units, install_mode, day, time_window_or_hour).
2. answers_to_slot: If the user answers a short text like "Gainable" or "Casa", check state.last_bot_question_slot. Attach it here if it fits, else guess the right slot.
3. question_asked: If the customer asks a question (e.g. "Quel est le prix?", "Vous intervenez à Rabat?"), set to the topic (e.g. "price", "zone", "hours").
4. acceptance: If they say "ok/oui/d'accord" to a bot proposal, set { price_accepted: true } or { time_accepted: true } depending on context.
5. intent_change: If they switch from repair to maintenance, set "maintenance", etc. (Latest statement wins).
6. closing: true if they say "merci", "au revoir", "bonne journée" without adding new info.
7. human_requested: true if they want to speak to a human, admin, or are angry.
8. complaint: true if they are angry/complaining.
9. urgency: true if they mention burning smell, smoke, sparks, heavy water leak, circuit breaker tripping.

Return EXACTLY this JSON structure, nothing else:
{
  "slot_updates": {},
  "answers_to_slot": "slot_name_or_null",
  "question_asked": "topic_or_null",
  "acceptance": {},
  "intent_change": "new_intent_or_null",
  "closing": false,
  "human_requested": false,
  "complaint": false,
  "urgency": false
}
`;

    const res = await llmFn(prompt);
    let parsed;
    try {
        let text = res.text.trim();
        // Remove markdown blocks if present
        if (text.startsWith("```json")) text = text.substring(7);
        else if (text.startsWith("```")) text = text.substring(3);
        if (text.endsWith("```")) text = text.substring(0, text.length - 3);
        
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            const jsonStr = text.substring(firstBrace, lastBrace + 1);
            parsed = JSON.parse(jsonStr);
        } else {
            throw new Error("No JSON structure found");
        }
    } catch(e) {
        console.error("NLU Parsing Error:", e.message, "Raw LLM output:", res.text);
        parsed = { slot_updates: {}, acceptance: {}, _fallback: true };
    }

    if (parsed.slot_updates?.phone) {
        const mp = getMoroccanPhone(parsed.slot_updates.phone);
        if (mp) parsed.slot_updates.phone = mp;
    }

    parsed._tokens = res.tokens || 0;
    return parsed;
}

module.exports = { interpret };
