import os

with open("lib/v2/interpret.js", "r", encoding="utf-8") as f:
    code = f.read()

slim_state_logic = """const slimState = {
        slots: state.slots,
        intent: state.intent,
        stage: state.stage,
        last_bot_question_slot: state.last_bot_question_slot
    };
    const prompt = `
You are the NLU Engine for a Moroccan HVAC WhatsApp bot.
Current state: ${JSON.stringify(slimState)}"""

code = code.replace("""const prompt = `
You are the NLU Engine for a Moroccan HVAC WhatsApp bot.
Current state: ${JSON.stringify(state)}""", slim_state_logic)

with open("lib/v2/interpret.js", "w", encoding="utf-8") as f:
    f.write(code)
