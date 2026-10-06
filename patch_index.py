import os
import re

with open("index.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Add process.env check and remove hardcoded secrets
if "if (!process.env.ADMIN_PASSWORD) {" not in code:
    code = "if (!process.env.ADMIN_PASSWORD) {\n  console.error('FATAL: ADMIN_PASSWORD is required');\n  process.exit(1);\n}\n" + code

code = re.sub(r'adminWebhookUrl:[\s\S]*?\|\|\s*"[^"]*",', 'adminWebhookUrl: process.env.ADMIN_WEBHOOK_URL,', code)
code = re.sub(r'notifyToken: process\.env\.WEBHOOK_SECRET \|\| "[^"]*",', 'notifyToken: process.env.WEBHOOK_SECRET,', code)
code = re.sub(r'adminPassword: process\.env\.ADMIN_PASSWORD \|\| "[^"]*",', 'adminPassword: process.env.ADMIN_PASSWORD,', code)

# 2. Add InterventionSync table to initDB
if 'CREATE TABLE IF NOT EXISTS "InterventionSync"' not in code:
    code = code.replace('CREATE TABLE IF NOT EXISTS "Inventory"', 'CREATE TABLE IF NOT EXISTS "InterventionSync" (\n        hash TEXT PRIMARY KEY,\n        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n      );\n    `);\n    await pool.query(`\n      CREATE TABLE IF NOT EXISTS "Inventory"')

# 3. Add maps and notifyHandoff
if "const pendingBodies = new Map();" not in code:
    maps_code = """const pendingBodies = new Map();
const handoffCooldowns = new Map();

async function notifyHandoff(userId, reason, turnBody) {
    const now = Date.now();
    const last = handoffCooldowns.get(userId) || 0;
    if (now - last < 10 * 60 * 1000) return;
    handoffCooldowns.set(userId, now);
    
    const adminMsg = `?[HANDOFF ALERT]\nUser: ${userId}\nReason: ${reason}\nLast Msg: ${turnBody}`;
    for (const admin of TEAM_NUMBERS) {
        try {
            await client.sendMessage(normalizePhone(admin), adminMsg);
        } catch(e) {}
    }
}
"""
    code = code.replace('const activeMessageIds = new Map();', 'const activeMessageIds = new Map();\n' + maps_code)

# 4. Message buffer in handler
if "pendingBodies.get(userId).push(body);" not in code:
    code = code.replace('let body = msg.body?.trim() || "";', 'let body = msg.body?.trim() || "";\n  if (!pendingBodies.has(userId)) pendingBodies.set(userId, []);\n  pendingBodies.get(userId).push(body);')

# 5. Join buffer in processMessageQueue
if "const joinedBody =" not in code:
    join_logic = """
        const allBodies = pendingBodies.get(userId) || [];
        const joinedBody = allBodies.join('\\n');
        pendingBodies.delete(userId);
        
        if (!joinedBody.trim() && !activeMessageIds.get(userId)) return;
"""
    code = code.replace('const history = await getHistory(userId);', join_logic + '\n        const history = await getHistory(userId);')
    # Replace body with joinedBody for runTurn
    code = code.replace('runTurn(v2Llm, convState, body, history, businessRulesText)', 'runTurn(v2Llm, convState, joinedBody, history, businessRulesText)')

# 6. Idempotency hash for recap & Handoff trigger
hash_logic = """if (v2Result.nextAction?.type === 'recap') {
          const crypto = require('crypto');
          const hashStr = JSON.stringify([userId, convState.intent, convState.slots]);
          const hash = crypto.createHash('sha256').update(hashStr).digest('hex');
          try {
              const res = await pool.query('INSERT INTO "InterventionSync" (hash) VALUES ($1) ON CONFLICT (hash) DO NOTHING RETURNING hash', [hash]);
              if (res.rowCount > 0) {
                  notifyAdminV2(userId, v2Result.newState.slots).catch(err => console.error("[NOTIFY ERR]", err.message));
              }
          } catch(e) {}
        }
        
        if (v2Result.nextAction?.type === 'handoff') {
            notifyHandoff(userId, v2Result.nextAction.reason, joinedBody).catch(()=>{});
        }"""
code = code.replace("if (v2Result.nextAction?.type === 'recap') {\n            notifyAdminV2(userId, v2Result.newState.slots).catch(err => console.error(\"[NOTIFY ERR]\", err.message));\n        }", hash_logic)

with open("index.js", "w", encoding="utf-8") as f:
    f.write(code)
