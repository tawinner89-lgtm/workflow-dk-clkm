const { FLOWS } = require('./flows');

function planner(state, interp) {
    // Reset loop count if slots were updated
    if (Object.keys(interp.slot_updates || {}).length > 0) {
        state.ask_count = 0;
    }


    // Loop prevention
    if (!state.ask_count) state.ask_count = 0;
    
    if (interp.is_media) {
        return { type: 'media_fallback', reason: 'media_received', slots: [] };
    }
    if (interp.out_of_scope) {
        return { type: 'out_of_scope', reason: 'irrelevant', slots: [] };
    }

    if (interp.human_requested || interp.complaint) {
        return { type: 'handoff', reason: 'human_complaint', slots: [] };
    }

    if (interp.question_asked) {
        // e.g. 'price'
        return { type: 'answer_question', reason: 'customer_question', slots: [interp.question_asked] };
    }

    if (state.flags?.postponed) {
        return { type: 'close', reason: 'postponed', slots: [] };
    }
    
    if (interp.closing) {
        return { type: 'silent', reason: 'closing', slots: [] };
    }

    let intent = state.intent ? state.intent.trim().toLowerCase() : null;
    // Map common French/Darija words to intents
    if (intent === 'reparation' || intent === 'rparation' || intent === 'islah') intent = 'repair';
    if (intent === 'achat' || intent === 'chra' || intent === 'buy') intent = 'purchase';
    if (intent === 'entretien' || intent === 'nettoyage') intent = 'maintenance';
    
    state.intent = intent; // update state with normalized

    if (!intent || !FLOWS[intent]) {
        state.ask_count++;
        if (state.ask_count >= 3) return { type: 'handoff', reason: 'loop_prevention', slots: [] };
        return { type: 'ask', reason: 'missing_intent', slots: ['intent'] };
    }

    const flow = FLOWS[intent];
    const missingRequired = flow.required.filter(s => {
        const val = state.slots[s];
        if (!val) return true;
        const strVal = String(val).trim().toLowerCase();
        if (strVal === 'null' || strVal === 'n/a' || strVal === 'none' || strVal === 'inconnu') return true;
        return false;
    });

    if (missingRequired.length === 0) {
        if (state.stage === 'RECAP') {
            // After recap: correction -> new recap
            if (Object.keys(interp.slot_updates || {}).length > 0) {
                return { type: 'recap', reason: 'correction_after_recap', slots: [] };
            }
            return { type: 'silent', reason: 'already_recapped', slots: [] };
        }
        return { type: 'recap', reason: 'all_filled', slots: [] };
    }

    // Missing slots
    const bookingSlots = ['name', 'address', 'phone', 'day', 'time_window_or_hour'];
    const missingBooking = missingRequired.filter(s => bookingSlots.includes(s));
    const missingOther = missingRequired.filter(s => !bookingSlots.includes(s));

    if (interp.greeting) {
        const nextSlot = missingOther.length > 0 ? missingOther[0] : missingBooking[0];
        state.ask_count++;
        if (state.ask_count >= 3) return { type: 'handoff', reason: 'loop_prevention', slots: [] };
        return { type: 'ask', reason: 'resume_flow', slots: [nextSlot] };
    }

    if (missingOther.length > 0) {
        state.ask_count++;
        if (state.ask_count >= 3) return { type: 'handoff', reason: 'loop_prevention', slots: [] };
        return { type: 'ask', reason: 'collect_info', slots: [missingOther[0]] };
    }

    if (missingBooking.length >= 3) {
        state.ask_count++;
        if (state.ask_count >= 3) return { type: 'handoff', reason: 'loop_prevention', slots: [] };
        return { type: 'ask', reason: 'collect_booking', slots: [missingBooking[0]] };
    } else {
        state.ask_count++;
        if (state.ask_count >= 3) return { type: 'handoff', reason: 'loop_prevention', slots: [] };
        return { type: 'ask', reason: 'collect_booking', slots: [missingBooking[0]] };
    }
}

module.exports = { planner };



