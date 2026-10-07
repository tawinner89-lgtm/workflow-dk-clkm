const { interpret } = require('./interpret');
const { planner } = require('./planner');
const { writeReply } = require('./writer');
const { validate } = require('./validator');
const { recordSale } = require('../../src/services/inventory');

function clean(val) {
    if (val === null || val === undefined || val === "") return null;
    const strVal = String(val).trim().toLowerCase();
    if (strVal === 'null' || strVal === 'n/a' || strVal === 'none' || strVal === 'inconnu' || strVal === 'slot_name_or_null') {
        return null;
    }
    return val;
}

async function runTurn(llmFn, state, customerMessage, history, rulesText = "") {
    let turnTokens = 0;
    
    // 0. Deterministic string sanitization
    let sanitizedMessage = customerMessage;
    if (typeof sanitizedMessage === 'string') {
        sanitizedMessage = sanitizedMessage.replace(/j[\'’]aimerais en savoir plus sur votre entreprise\.?/gi, "").trim();
    }
    
    // 1. Interpret
    const interp = await interpret(llmFn, state, sanitizedMessage);
    turnTokens += interp._tokens || 0;
    
    // 2. Update state
    if (interp.detected_language) {
        state.language = interp.detected_language;
    }
    if (interp.intent_change) {
        state.intent = interp.intent_change;
    }
    if (interp.slot_updates && typeof interp.slot_updates === 'object') {
        for (const [key, rawVal] of Object.entries(interp.slot_updates)) {
            const val = clean(rawVal);
            if (val === null) continue;
            
            // Strict persistence for critical pre-filled slots
            if (['name', 'phone', 'brand', 'btu', 'service_type', 'ac_type'].includes(key) && state.slots[key]) {
                const isCorrection = /\b(non|en fait|plutôt|pardon|erreur|ghalat|machi)\b/i.test(sanitizedMessage);
                if (!isCorrection) continue;
            }
            
            state.slots[key] = val;
        }
    }
    
    const ans = clean(interp.answers_to_slot);
    if (ans && !state.slots[ans]) {
        state.slots[ans] = sanitizedMessage;
    }
    
    if (interp.acceptance?.price_accepted) state.flags.price_accepted = true;
    if (interp.acceptance?.time_accepted) state.flags.time_accepted = true;
    if (interp.human_requested) state.flags.human_requested = true;
    if (interp.complaint) state.flags.complaint = true;
    if (interp.urgency) state.flags.urgency = true;
    if (interp.closing) state.flags.closing = true;

    // 3. Plan
    const action = planner(state, interp);

    // 4. Write
    let reply = "";
    let validatorResult = { valid: true };
    
    if (action.type !== 'silent') {
        const wRes = await writeReply(llmFn, state, action, history, rulesText);
        reply = wRes.text;
        turnTokens += wRes.tokens || 0;
        
        // 5. Validate
        validatorResult = await validate(llmFn, reply, state, action);
        turnTokens += validatorResult.tokens || 0;
        
        if (!validatorResult.valid) {
            if (validatorResult.type === 'hard') {
                console.error("[V2 VALIDATOR HARD FAIL]", validatorResult.reason);
                reply = "Veuillez patienter, je transfère votre demande à un membre de notre équipe technique.";
                action.type = "handoff";
                action.reason = "validation_failure_hard";
            } else {
                console.warn("[V2 VALIDATOR RETRY]", validatorResult.reason);
                const retryAction = { ...action, reason: action.reason + " (Retry: " + validatorResult.reason + ")" };
                const rRes = await writeReply(llmFn, state, retryAction, history, rulesText);
                reply = rRes.text;
                turnTokens += rRes.tokens || 0;
                
                validatorResult = await validate(llmFn, reply, state, action);
                turnTokens += validatorResult.tokens || 0;
                
                if (!validatorResult.valid) {
                    console.error("[V2 VALIDATOR FAILED TWICE]", validatorResult.reason);
                    reply = "Veuillez patienter, je transfère votre demande à un membre de notre équipe technique.";
                    action.type = "handoff";
                    action.reason = "validation_failure";
                }
            }
        }
    }
    
    // Stage Transitions
    if (action.type === 'recap') {
        state.stage = 'RECAP';
    } else if (action.type === 'handoff') {
        state.stage = 'HANDOFF';
    } else if (action.type === 'close' || action.reason === 'closing') {
        state.stage = 'CLOSED';
    } else {
        if (state.stage === 'INITIAL' && state.intent) {
            state.stage = 'COLLECT';
        }
    }

    // --- INVENTORY DEDUCTION TRIGGER ---
    const isAffirmationAfterRecap = (state.stage === 'RECAP' && (interp.acceptance?.price_accepted || interp.acceptance?.time_accepted || sanitizedMessage.match(/\b(oui|ok|d\'accord|mezian|yallah|sir|wakha)\b/i)));
    const isFinalHandoff = (action.type === 'handoff' && state.intent === 'purchase');

    if (state.intent === 'purchase' && !state.flags.sale_recorded && (isAffirmationAfterRecap || isFinalHandoff)) {
        try {
            // Already standardized in NLU, just fallback check
            let finalBtu = state.slots.btu;
            if (finalBtu && !finalBtu.endsWith('_BTU')) {
                finalBtu = finalBtu.replace(/\D/g, "") + "_BTU";
            }

            console.log(`[INVENTORY] Triggering recordSale for ${state.slots.brand} - ${finalBtu}`);
            await recordSale(state.slots.brand, finalBtu, state.slots.name, state.slots.phone);
            state.flags.sale_recorded = true;
        } catch (invErr) {
            console.error('[INVENTORY TRIGGER ERROR]', invErr.stack || invErr.message);
        }
    }

    if (reply) {
        state.last_bot_text = reply;
        if (action.type === 'ask' && action.slots.length > 0) {
            state.last_bot_question_slot = action.slots[0];
        } else {
            state.last_bot_question_slot = null;
        }
    }

    return {
        newState: state,
        interpretation: interp,
        nextAction: action,
        reply,
        validatorResult,
        tokens: turnTokens
    };
}

module.exports = { runTurn, clean };
