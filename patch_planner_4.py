import os

code = """const { FLOWS } = require('./flows');
const { normalizeIntent } = require('./intent');

function planner(state, interp) {
    if (interp.urgency) return { type: 'handoff', reason: 'urgency', slots: [] };
    if (state.stage === 'HANDOFF') return { type: 'silent', reason: 'already_handoff', slots: [] };
    if (interp.human_requested || interp.complaint) return { type: 'handoff', reason: 'human_complaint', slots: [] };
    if (interp.question_asked) return { type: 'answer_question', reason: 'customer_question', slots: [interp.question_asked] };
    
    if (interp.is_media) return { type: 'media_fallback', reason: 'media_received', slots: [] };
    if (interp.out_of_scope) return { type: 'out_of_scope', reason: 'irrelevant', slots: [] };
    if (state.flags?.postponed) return { type: 'close', reason: 'postponed', slots: [] };
    if (interp.closing) return { type: 'silent', reason: 'closing', slots: [] };

    // Reset loop count if progress is made
    if (!state.ask_count) state.ask_count = 0;
    if (Object.keys(interp.slot_updates || {}).length > 0 || interp.intent_change) {
        state.ask_count = 0;
    }

    let intent = state.intent;
    if (interp.intent_change) {
        intent = normalizeIntent(interp.intent_change);
    } else {
        intent = normalizeIntent(intent);
    }
    state.intent = intent;

    if (!intent || !FLOWS[intent]) {
        state.ask_count++;
        if (state.ask_count >= 3) return { type: 'handoff', reason: 'loop_prevention', slots: [] };
        return { type: 'ask', reason: 'missing_intent', slots: ['intent'] };
    }

    const flow = FLOWS[intent];
    // Filter missing using strictly required
    const missingRequired = flow.required.filter(s => !state.slots[s]);
    
    if (missingRequired.length === 0) {
        if (state.stage === 'RECAP') {
            if (Object.keys(interp.slot_updates || {}).length > 0) {
                return { type: 'recap', reason: 'correction_after_recap', slots: [] };
            }
            return { type: 'silent', reason: 'already_recapped', slots: [] };
        }
        return { type: 'recap', reason: 'all_filled', slots: [] };
    }

    // Determine next slot based on Flow order
    let nextSlot = null;
    for (const s of flow.order) {
        if (missingRequired.includes(s)) {
            nextSlot = s;
            break;
        }
    }
    
    if (!nextSlot) nextSlot = missingRequired[0]; // fallback

    state.ask_count++;
    if (state.ask_count >= 3) return { type: 'handoff', reason: 'loop_prevention', slots: [] };

    if (interp.greeting) {
        return { type: 'ask', reason: 'resume_flow', slots: [nextSlot] };
    }

    return { type: 'ask', reason: 'collect_info', slots: [nextSlot] };
}

module.exports = { planner };
"""

with open("lib/v2/planner.js", "w", encoding="utf-8") as f:
    f.write(code)
