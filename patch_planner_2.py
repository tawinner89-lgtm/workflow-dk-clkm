import os

with open("lib/v2/planner.js", "r", encoding="utf-8") as f:
    code = f.read()

# Fix loop prevention to reset when progress is made
code = code.replace("function planner(state, interp) {", """function planner(state, interp) {
    // Reset loop count if slots were updated
    if (Object.keys(interp.slot_updates || {}).length > 0) {
        state.ask_count = 0;
    }
""")

code = code.replace("state.ask_count >= 5", "state.ask_count >= 3")

with open("lib/v2/planner.js", "w", encoding="utf-8") as f:
    f.write(code)
