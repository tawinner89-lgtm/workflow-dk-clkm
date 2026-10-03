const { FLOWS } = require('./flows');

function planner(state, interp) {
    if (interp.urgency) {
        return { type: 'handoff', reason: 'urgency', slots: [] };
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

    const intent = state.intent;
    if (!intent || !FLOWS[intent]) {
        return { type: 'ask', reason: 'missing_intent', slots: ['intent'] };
    }

    const flow = FLOWS[intent];
    const missingRequired = flow.required.filter(s => !state.slots[s]);

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

    if (missingOther.length > 0) {
        return { type: 'ask', reason: 'collect_info', slots: [missingOther[0]] };
    }

    if (missingBooking.length >= 3) {
        return { type: 'ask', reason: 'collect_booking_group', slots: missingBooking };
    } else {
        return { type: 'ask', reason: 'collect_booking', slots: [missingBooking[0]] };
    }
}

module.exports = { planner };
