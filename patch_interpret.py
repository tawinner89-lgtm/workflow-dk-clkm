import os

with open("lib/v2/interpret.js", "r", encoding="utf-8") as f:
    code = f.read()

# Replace prompt JSON structure to use null
code = code.replace('"answers_to_slot": "slot_name_or_null"', '"answers_to_slot": null')
code = code.replace('"question_asked": "topic_or_null"', '"question_asked": null')
code = code.replace('"intent_change": "new_intent_or_null"', '"intent_change": null')

# Add jsonrepair require at top
if "jsonrepair" not in code:
    code = "const { jsonrepair } = require('jsonrepair');\n" + code

# Replace JSON parsing block
old_parse_block = """    try {
        let cleanOutput = res.text.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const firstBrace = cleanOutput.indexOf('{');
        const lastBrace = cleanOutput.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            const jsonStr = cleanOutput.substring(firstBrace, lastBrace + 1);
            parsed = JSON.parse(jsonStr);
        } else {
            throw new Error("No JSON structure found");
        }
    } catch(e) {"""

new_parse_block = """    try {
        let cleanOutput = res.text.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const firstBrace = cleanOutput.indexOf('{');
        const lastBrace = cleanOutput.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            const jsonStr = cleanOutput.substring(firstBrace, lastBrace + 1);
            try {
                parsed = JSON.parse(jsonStr);
            } catch (err) {
                try {
                    parsed = JSON.parse(jsonrepair(jsonStr));
                } catch (repairErr) {
                    throw repairErr;
                }
            }
        } else {
            throw new Error("No JSON structure found");
        }
    } catch(e) {"""
code = code.replace(old_parse_block, new_parse_block)

# Add BTU guardrail before human_requested
btu_guardrail = """
    // Programmatic guardrail for BTU
    if (!parsed.slot_updates.btu) {
        const btuMatch = customerMessage.match(/\\b(\\d{1,2}[\\s.]?\\d{3})\\s*_?btu\\b/i);
        if (btuMatch) {
            let btuVal = btuMatch[1].replace(/\\D/g, '');
            parsed.slot_updates.btu = btuVal + "_BTU";
        }
    }
"""
code = code.replace("// Programmatic guardrail against false-positive human_requested", btu_guardrail + "\n    // Programmatic guardrail against false-positive human_requested")

with open("lib/v2/interpret.js", "w", encoding="utf-8") as f:
    f.write(code)
