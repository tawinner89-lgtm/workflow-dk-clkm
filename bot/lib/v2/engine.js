"use strict";
const { interpret } = require('./interpret');
const { planner } = require('./planner');
const { writeReply } = require('./writer');
const { validate } = require('./validator');
const { render } = require('./templates');
const { recordSale, getProductAvailability } = require('../../src/services/inventory');
const { normalizeIntent } = require('./intent');
const { getOffer } = require('./templates');
function clean(val) {
    if (val===null||val===undefined||val==="") return null;
    const s=String(val).trim().toLowerCase();
    if (['null','n/a','none','inconnu','slot_name_or_null'].includes(s)) return null;
    return val;
}
async function runTurn(llmFn, state, customerMessage, history, rulesText="") {
    state.slots ||= {};
    state.flags ||= {};
    let turnTokens=0;
    const prevStage=state.stage;
    let sanitized=customerMessage
        .replace(/j\s*['’]?\s*aimerais\s+en\s+savoir\s+plus\s+sur\s+votre\s+entreprise/giu, 'parlez-moi de votre entreprise')
        .replace(/j\s*['’]?\s*aimerais/giu, '')
        .trim();
    const interp=await interpret(llmFn, state, sanitized);
    turnTokens+=interp._tokens||0;
    if (interp.detected_language) state.language=interp.detected_language;
    if (interp.intent_change) state.intent=normalizeIntent(interp.intent_change) || state.intent;
    const affirmative = /^(?:oui|yes|ok|okay|d'accord|wakha|mezian|yallah|sir)(?:\b|\s|[!.])/iu.test(sanitized.trim());
    const oldBrand = state.slots.brand;
    const oldBtu = state.slots.btu;
    const alternative = state.flags.stock_check?.alternatives?.[0];
    const acceptedAlternative = affirmative && state.last_bot_question_slot === 'brand' && !state.flags.stock_check?.available && alternative;
    if (acceptedAlternative) interp.slot_updates.brand = alternative.brand;
    if (interp.slot_updates && typeof interp.slot_updates==='object') {
        for (const [k, raw] of Object.entries(interp.slot_updates)) {
            const v=clean(raw); if(v===null) continue;
            if (['name','phone','brand','btu','service_type','ac_type'].includes(k) && state.slots[k] && state.last_bot_question_slot !== k && !(acceptedAlternative && k === 'brand')) {
                const isCorr=/\b(non|en fait|plutot|pardon|erreur|ghalat|machi)\b/i.test(sanitized);
                if(!isCorr) continue;
            }
            state.slots[k]=v;
        }
    }
    if (oldBrand !== state.slots.brand || oldBtu !== state.slots.btu) delete state.flags.stock_check;
    const ans=clean(interp.answers_to_slot);
    if (ans && !state.slots[ans]) state.slots[ans]=sanitized;
    if (interp.acceptance?.price_accepted) state.flags.price_accepted=true;
    if (interp.acceptance?.time_accepted) state.flags.time_accepted=true;
    state.flags.closing=false;
    if (interp.human_requested) state.flags.human_requested=true;
    if (interp.complaint) state.flags.complaint=true;
    if (interp.urgency) state.flags.urgency=true;
    if (interp.closing) state.flags.closing=true;
    if (state.intent === 'purchase' && state.slots.brand && state.slots.btu && !state.flags.stock_check) {
        state.flags.stock_check = await getProductAvailability(state.slots.brand, state.slots.btu);
        if (state.flags.stock_check.status === 'checked') {
            state.flags.stock_check.alternatives = state.flags.stock_check.alternatives.filter(product => getOffer(product.brand, product.btu));
        }
    }
    let action;
    let saleResult = null;
    if (prevStage === 'RECAP' && state.intent === 'purchase' && affirmative) {
        if (!state.flags.stock_check?.available) {
            action = { type: 'ask', reason: 'alternative_brand', slots: ['brand'] };
        } else if (!state.flags.sale_recorded) {
            saleResult = await recordSale(state.slots.brand, state.slots.btu, state.slots.name, state.slots.phone);
            if (saleResult.ok) {
                state.flags.sale_recorded = true;
                action = { type: 'close', reason: 'sale_pending', slots: [] };
            } else if (saleResult.reason === 'OUT_OF_STOCK') {
                state.flags.stock_check = await getProductAvailability(state.slots.brand, state.slots.btu);
                if (state.flags.stock_check.status === 'checked') {
                    state.flags.stock_check.alternatives = state.flags.stock_check.alternatives.filter(product => getOffer(product.brand, product.btu));
                }
                if (!state.flags.stock_check.available) action = { type: 'ask', reason: 'alternative_brand', slots: ['brand'] };
                else action = { type: 'handoff', reason: 'inventory_race', slots: [] };
            } else {
                action = { type: 'handoff', reason: 'sale_record_failed', slots: [] };
            }
        } else {
            action = { type: 'close', reason: 'sale_pending', slots: [] };
        }
    } else {
        action = planner(state, interp);
    }
    if (state.intent === 'purchase' && ['recap', 'answer_question'].includes(action.type) && state.slots.brand && state.slots.btu) {
        state.flags.stock_check = await getProductAvailability(state.slots.brand, state.slots.btu);
        if (state.flags.stock_check.status === 'checked') {
            state.flags.stock_check.alternatives = state.flags.stock_check.alternatives.filter(product => getOffer(product.brand, product.btu));
        }
        if (action.type === 'recap' && !state.flags.stock_check.available) action = planner(state, interp);
    }
    let reply=""; let validatorResult={valid:true};
    if (action.type!=='silent') {
        const wRes=await writeReply(llmFn, state, action, history, rulesText);
        reply=wRes.text; turnTokens+=wRes.tokens||0;
        validatorResult=await validate(llmFn, reply, state, action);
        turnTokens+=validatorResult.tokens||0;
        if (!validatorResult.valid) {
            if (validatorResult.type==='hard') {
                console.error("[V2 HARD FAIL]", validatorResult.reason);
                reply=render(state, { type: 'handoff' });
                action.type="handoff"; action.reason="validation_failure_hard";
            } else {
                console.warn("[V2 RETRY]", validatorResult.reason);
                const retryAction={...action, reason: action.reason+" (Retry: "+validatorResult.reason+")"};
                const rRes=await writeReply(llmFn, state, retryAction, history, rulesText);
                reply=rRes.text; turnTokens+=rRes.tokens||0;
                validatorResult=await validate(llmFn, reply, state, action);
                turnTokens+=validatorResult.tokens||0;
                if (!validatorResult.valid) {
                    reply=render(state, { type: 'handoff' });
                    action.type="handoff"; action.reason="validation_failure";
                }
            }
        }
    }
    console.log('[V2]', JSON.stringify({msg:sanitized.slice(0,60), intent:interp.intent_change||state.intent, action:action.type, slot:action.slots?.[0]}));
    if (action.type==='recap') state.stage='RECAP';
    else if (action.type==='handoff') state.stage='HANDOFF';
    else if (action.type==='close' || action.reason==='closing') state.stage='CLOSED';
    else if (state.stage==='INITIAL' && state.intent) state.stage='COLLECT';
    const isAffirmationAfterRecap=(prevStage==='RECAP' && state.intent==='purchase' && affirmative && Boolean(saleResult?.ok || state.flags.sale_recorded));
    if (reply) { state.last_bot_text=reply; state.last_bot_question_slot=(action.type==='ask'&&action.slots.length>0)?action.slots[0]:null; }
    return { newState: state, interpretation: interp, nextAction: action, isAffirmationAfterRecap, saleResult, reply, validatorResult, tokens: turnTokens };
}
module.exports = { runTurn, clean };
