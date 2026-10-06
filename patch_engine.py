import os

with open("lib/v2/engine.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Nullish filtering
old_nullish = "if (strVal === 'null' || strVal === 'n/a' || strVal === 'none' || strVal === 'inconnu') {"
new_nullish = "if (strVal === 'null' || strVal === 'n/a' || strVal === 'none' || strVal === 'inconnu' || strVal === 'slot_name_or_null') {"
code = code.replace(old_nullish, new_nullish)

# 2. Strict lock with correction keywords
old_lock = "if (['name', 'phone', 'intent', 'service_type', 'ac_type'].includes(key) && state.slots[key]) {\n                continue;\n            }"
new_lock = """if (['name', 'phone', 'brand', 'btu', 'service_type', 'ac_type'].includes(key) && state.slots[key]) {
                const correctionWords = ['non', 'erreur', 'ghalat', 'machi', 'la ', 'false', 'actually', 'instead'];
                const isCorrection = correctionWords.some(w => customerMessage.toLowerCase().includes(w));
                if (!isCorrection) continue;
            }"""
code = code.replace(old_lock, new_lock)

# 3. recordSale idempotency
old_inventory = """if (state.intent === 'purchase') {
            try {
                const { recordSale } = require('../../src/services/inventory');
                
                // NORMALIZATION: Ensure exact string format for DB (e.g. 9000_BTU)
                let finalBtu = String(state.slots.btu).replace(/\\D/g, "");
                if (finalBtu) { finalBtu = `${finalBtu}_BTU`; }

                console.log(`[INVENTORY] Triggering recordSale for ${state.slots.brand} - ${finalBtu}`);
                await recordSale(state.slots.brand, finalBtu, state.slots.name, state.slots.phone);"""
new_inventory = """if (state.intent === 'purchase' && !state.flags.sale_recorded) {
            try {
                const { recordSale } = require('../../src/services/inventory');
                
                // NORMALIZATION: Ensure exact string format for DB (e.g. 9000_BTU)
                let finalBtu = String(state.slots.btu).replace(/\\D/g, "");
                if (finalBtu) { finalBtu = `${finalBtu}_BTU`; }

                console.log(`[INVENTORY] Triggering recordSale for ${state.slots.brand} - ${finalBtu}`);
                await recordSale(state.slots.brand, finalBtu, state.slots.name, state.slots.phone);
                state.flags.sale_recorded = true;"""
code = code.replace(old_inventory, new_inventory)

with open("lib/v2/engine.js", "w", encoding="utf-8") as f:
    f.write(code)
