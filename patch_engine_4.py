import os

with open("lib/v2/engine.js", "r", encoding="utf-8") as f:
    code = f.read()

retry_logic = """if (!validatorResult.valid) {
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
        }"""

code = code.replace("""if (!validatorResult.valid) {
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
        }""", retry_logic)

with open("lib/v2/engine.js", "w", encoding="utf-8") as f:
    f.write(code)
