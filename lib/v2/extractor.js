const { getMoroccanPhone } = require('../utils');

// Using the same askAI from index.js (we will pass it in or require it if possible)
// But since this is a unit-testable module, we dependency-inject the LLM function
async function extractSlots(llmFn, state, customerMessage) {
    const prompt = `
You are an intent and slot extractor for an HVAC (climatisation) bot.
Current State: ${JSON.stringify(state)}
Last Bot Question Slot: ${state.last_bot_question_slot || "None"}
Customer Message: "${customerMessage}"

RULES:
1. Extract or update slots based on the customer message.
2. If the customer gives a short answer (e.g. "Gainable"), map it to the Last Bot Question Slot if it fits.
3. Validate phones. Format to standard.
4. If day is given but no hour ("Lundi"), day is "Lundi" but time_window_or_hour remains missing.
5. If intent is not set, guess it from: repair, maintenance, installation, price, job, postponed, urgent.
6. Return ONLY valid JSON: { "intent": "string", "slots": { "key": "value" }, "flags": { "urgent": true/false } }
`;
    const raw = await llmFn(prompt);
    
    let parsed;
    try {
        const match = raw.replace(/\r?\n/g, " ").match(/\{[^{}]*\}/);
        parsed = JSON.parse(match[0]);
    } catch(e) {
        return state; // fallback
    }

    const newState = JSON.parse(JSON.stringify(state)); // deep clone
    
    if (parsed.intent && !newState.intent) {
        newState.intent = parsed.intent;
    }
    
    if (parsed.slots) {
        for (const [k, v] of Object.entries(parsed.slots)) {
            if (k === 'phone') {
                const mp = getMoroccanPhone(v);
                if (mp) newState.slots[k] = mp;
            } else {
                newState.slots[k] = v;
            }
        }
    }
    
    if (parsed.flags) {
        newState.flags = { ...newState.flags, ...parsed.flags };
    }
    
    return newState;
}

module.exports = { extractSlots };
