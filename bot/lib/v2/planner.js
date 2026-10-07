"use strict";
const { FLOWS } = require('./flows');
const { normalizeIntent } = require('./intent');
const { getOffer, getOffers } = require('./templates');

function planner(state, interp) {
    if (interp.urgency) return { type: 'handoff', reason: 'urgency', slots: [] };
    if (state.stage === 'HANDOFF') return { type: 'silent', reason: 'already_handoff', slots: [] };
    if (interp.human_requested || interp.complaint) return { type: 'handoff', reason: 'human_complaint', slots: [] };
    if (interp.intent_change) state.intent = normalizeIntent(interp.intent_change);
    if (interp.question_asked) {
        if (state.intent === 'purchase' && ['price', 'availability'].includes(interp.question_asked)) {
            if (state.slots.brand && state.slots.btu && (!state.flags?.stock_check || state.flags.stock_check.status === 'error')) {
                return { type: 'handoff', reason: 'inventory_check_failed', slots: [] };
            }
            if (state.slots.brand && state.slots.btu && getOffer(state.slots.brand, state.slots.btu)) {
                return { type: 'answer_question', reason: 'purchase_price_booking', slots: [interp.question_asked] };
            }
            return { type: 'answer_question', reason: 'purchase_product_question', slots: [interp.question_asked] };
        }
        return { type: 'answer_question', reason: 'customer_question', slots: [interp.question_asked] };
    }
    if (interp.is_media) return { type: 'media_fallback', reason: 'media_received', slots: [] };
    if (interp.out_of_scope) return { type: 'out_of_scope', reason: 'irrelevant', slots: [] };
    if (state.flags?.postponed) return { type: 'close', reason: 'postponed', slots: [] };
    if (interp.closing) return { type: 'silent', reason: 'closing', slots: [] };

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

    if (intent === 'purchase' && interp.is_lost && (!state.slots.brand || !state.slots.btu)) {
        return { type: 'ask', reason: 'recommendation_group', slots: ['recommendation_group'] };
    }

    if (intent === 'purchase' && state.slots.brand && state.slots.btu) {
        const stockCheck = state.flags?.stock_check;
        if (!stockCheck || stockCheck.status === 'error') return { type: 'handoff', reason: 'inventory_check_failed', slots: [] };
        if (stockCheck.available === false && !stockCheck.can_preorder) return { type: 'ask', reason: 'alternative_brand', slots: ['brand'] };
        if (getOffers(state.slots.brand, state.slots.btu).length > 1 && !state.slots.model_variant) {
            return { type: 'ask', reason: 'choose_model_variant', slots: ['model_variant'] };
        }
    }
    const missingRequired = flow.required.filter(s => !state.slots[s]);
    
    if (missingRequired.length === 0) {
        if (intent === 'job') return { type: 'handoff', reason: 'job_inquiry', slots: [] };
        if (intent === 'purchase' && !getOffer(state.slots.brand, state.slots.btu)) return { type: 'handoff', reason: 'price_not_configured', slots: [] };
        if (intent === 'price') return { type: 'answer_question', reason: 'price_inquiry', slots: ['prix_climatiseur'] };
        if (state.stage === 'RECAP') {
            if (Object.keys(interp.slot_updates || {}).length > 0) {
                return { type: 'recap', reason: 'correction_after_recap', slots: [] };
            }
            return { type: 'silent', reason: 'already_recapped', slots: [] };
        }
        return { type: 'recap', reason: 'all_filled', slots: [] };
    }

    // Booking group optimization: if remaining are only personal + scheduling, group them
    const bookingSlots = ["name", "address", "phone", "day", "time_window_or_hour"];
    const isOnlyBookingLeft = missingRequired.every(s => bookingSlots.includes(s));
    if (isOnlyBookingLeft && missingRequired.length >= 3) {
        return { type: 'ask', reason: 'booking_group', slots: ['booking_group'] };
    }

    let nextSlot = null;
    for (const s of flow.order) {
        if (missingRequired.includes(s)) { nextSlot = s; break; }
    }
    if (!nextSlot) nextSlot = missingRequired[0];

    state.ask_count++;
    if (state.ask_count >= 3) return { type: 'handoff', reason: 'loop_prevention', slots: [] };

    if (interp.greeting) {
        return { type: 'ask', reason: 'resume_flow', slots: [nextSlot] };
    }

    return { type: 'ask', reason: 'collect_info', slots: [nextSlot] };
}

module.exports = { planner };
