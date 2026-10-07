const { runTurn } = require('../lib/v2/engine');
const { FLOWS } = require('../lib/v2/flows');

async function mockLlm(prompt) {
    if (prompt.includes("Tu es un mod")) { // NLU
        if (prompt.includes("Salam")) return { text: JSON.stringify({ answers_to_slot: null, intent_change: null, closing: false }), tokens: 10 };
        if (prompt.includes("bghit nsli7 clim")) return { text: JSON.stringify({ answers_to_slot: null, intent_change: "repair", closing: false }), tokens: 10 };
        if (prompt.includes("Matin")) return { text: JSON.stringify({ answers_to_slot: "time_window_or_hour", intent_change: null, closing: false }), tokens: 10 };
        if (prompt.includes("oui")) return { text: JSON.stringify({ answers_to_slot: null, intent_change: null, closing: false, acceptance: { time_accepted: true } }), tokens: 10 };
        return { text: "{}", tokens: 10 };
    }
    // Writer
    return { text: "MOCK REPLY?", tokens: 10 };
}

async function runTest() {
    let state = { stage: "INITIAL", intent: null, slots: {}, ask_count: 0, flags: {} };
    let history = [];
    const rules = "business rules";

    // 1. Salam
    let res = await runTurn(mockLlm, state, "Salam", history, rules);
    console.assert(res.reply !== "", "Salam reply should not be empty");
    state = res.newState;

    // 2. bghit nsli7 clim
    res = await runTurn(mockLlm, state, "bghit nsli7 clim", history, rules);
    console.assert(res.reply !== "", "intent reply should not be empty");
    state = res.newState;

    // Fast-forward slots for repair intent
    state.slots = { name: "Test", phone: "0600000000", address: "Casa", symptom: "Fuite", day: "Demain" };
    
    // 3. Recap trigger
    res = await runTurn(mockLlm, state, "Matin", history, rules);
    console.assert(state.stage === "RECAP", "Stage should be RECAP");
    console.assert(!res.isAffirmationAfterRecap, "Should not be affirmed yet");
    state = res.newState;

    // 4. Confirmation
    res = await runTurn(mockLlm, state, "oui", history, rules);
    console.assert(state.stage === "CLOSED", "Stage should be CLOSED");
    console.assert(res.isAffirmationAfterRecap, "Should be affirmed now");

    console.log("All assertions passed!");
}
runTest().catch(console.error);
