const { interpret } = require('./interpret');
const { planner } = require('./planner');
const { writeReply } = require('./writer');
const { validate } = require('./validator');

async function runTurn(llmFn, state, customerMessage, history, rulesText = "") {
    let turnTokens = 0;
    
    // 1. Interpret
    const interp = await interpret(llmFn, state, customerMessage);
    turnTokens += interp._tokens || 0;
    
    // 2. Update state
    if (interp.intent_change) {
        state.intent = interp.intent_change;
    }
    if (interp.slot_updates && typeof interp.slot_updates === 'object') {
        for (const [key, val] of Object.entries(interp.slot_updates)) {
            if (val !== null && val !== "" && val !== undefined) {
                state.slots[key] = val;
            }
        }
    }
    if (interp.answers_to_slot && !state.slots[interp.answers_to_slot]) {
        state.slots[interp.answers_to_slot] = customerMessage;
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

module.exports = { runTurn };
