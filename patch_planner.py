import os

with open("lib/v2/planner.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Add loop prevention and urgency at the very top of planner()
new_top = """function planner(state, interp) {
    if (interp.urgency) {
        return { type: 'handoff', reason: 'urgency', slots: [] };
    }
    
    // Loop prevention
    if (!state.ask_count) state.ask_count = 0;
    
    if (interp.is_media) {"""
code = code.replace("function planner(state, interp) {\n    if (interp.is_media) {", new_top)

# Remove the old urgency check
code = code.replace("""    if (interp.urgency) {
        return { type: 'handoff', reason: 'urgency', slots: [] };
    }\n    """, "")

# 2. Normalize intent
old_intent = "const intent = state.intent;"
new_intent = """let intent = state.intent ? state.intent.trim().toLowerCase() : null;
    // Map common French/Darija words to intents
    if (intent === 'reparation' || intent === 'rparation' || intent === 'islah') intent = 'repair';
    if (intent === 'achat' || intent === 'chra' || intent === 'buy') intent = 'purchase';
    if (intent === 'entretien' || intent === 'nettoyage') intent = 'maintenance';
    
    state.intent = intent; // update state with normalized
"""
code = code.replace(old_intent, new_intent)

# 3. Increment ask_count and return handoff if >= 3
old_ask = "return { type: 'ask', reason: 'collect_info', slots: [missingOther[0]] };"
new_ask = """state.ask_count++;
        if (state.ask_count >= 5) return { type: 'handoff', reason: 'loop_prevention', slots: [] };
        return { type: 'ask', reason: 'collect_info', slots: [missingOther[0]] };"""
code = code.replace(old_ask, new_ask)

old_booking_ask = "return { type: 'ask', reason: 'collect_booking', slots: [missingBooking[0]] };"
new_booking_ask = """state.ask_count++;
        if (state.ask_count >= 5) return { type: 'handoff', reason: 'loop_prevention', slots: [] };
        return { type: 'ask', reason: 'collect_booking', slots: [missingBooking[0]] };"""
code = code.replace(old_booking_ask, new_booking_ask)

old_missing_intent = "return { type: 'ask', reason: 'missing_intent', slots: ['intent'] };"
new_missing_intent = """state.ask_count++;
        if (state.ask_count >= 5) return { type: 'handoff', reason: 'loop_prevention', slots: [] };
        return { type: 'ask', reason: 'missing_intent', slots: ['intent'] };"""
code = code.replace(old_missing_intent, new_missing_intent)

old_resume = "return { type: 'ask', reason: 'resume_flow', slots: [nextSlot] };"
new_resume = """state.ask_count++;
        if (state.ask_count >= 5) return { type: 'handoff', reason: 'loop_prevention', slots: [] };
        return { type: 'ask', reason: 'resume_flow', slots: [nextSlot] };"""
code = code.replace(old_resume, new_resume)


with open("lib/v2/planner.js", "w", encoding="utf-8") as f:
    f.write(code)
