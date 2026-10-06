import os

with open("src/services/llm.js", "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("async function askAI(messages, maxTokens = 800, opts = { json: false, temperature: 0.4 }) {", "async function askAI(messages, maxTokens = 800, retries = 3, opts = { json: false, temperature: 0.4 }) {")

with open("src/services/llm.js", "w", encoding="utf-8") as f:
    f.write(code)
