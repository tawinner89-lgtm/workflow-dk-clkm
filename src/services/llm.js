const axios = require("axios");
const { Groq } = require("groq-sdk");
require("dotenv").config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const groqModel = process.env.GROQ_MODEL || "llama-3.1-70b-versatile";

global.GROQ_COOLDOWN_UNTIL = null;

async function askDeepSeek(messages, maxTokens, opts = {}) {
  const payload = {
    model: "deepseek-chat",
    messages,
    max_tokens: maxTokens,
    temperature: opts.temperature !== undefined ? opts.temperature : 0.4,
  };
  if (opts.json) {
    payload.response_format = { type: "json_object" };
  }
  const res = await axios.post(
    "https://api.deepseek.com/chat/completions",
    payload,
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  );
  if (res.data.usage) {
    console.log(`[USAGE] Provider: DeepSeek | Model: deepseek-chat | Prompt: ${res.data.usage.prompt_tokens} | Completion: ${res.data.usage.completion_tokens}`);
  }
  return res.data.choices[0].message.content.trim();
}

async function askAI(messages, maxTokens = 800, retries = 3, opts = { json: false, temperature: 0.4 }) {
  // Ensure reasoning/JSON models have enough tokens
  if (opts.json && maxTokens < 1500) maxTokens = 1500;

  try {
    if (groqModel && !(global.GROQ_COOLDOWN_UNTIL && Date.now() < global.GROQ_COOLDOWN_UNTIL)) {
      const payload = {
        messages,
        model: groqModel,
        max_tokens: maxTokens,
        temperature: opts.temperature !== undefined ? opts.temperature : 0.4,
      };
      if (opts.json) {
        payload.response_format = { type: "json_object" };
      }
      
      const completion = await groq.chat.completions.create(payload);
      if (completion.usage) {
        console.log(`[USAGE] Provider: Groq | Model: ${groqModel} | Prompt: ${completion.usage.prompt_tokens} | Completion: ${completion.usage.completion_tokens}`);
      }
      return completion.choices[0].message.content.trim();
    } else {
      if (process.env.DEEPSEEK_API_KEY) return await askDeepSeek(messages, maxTokens, opts);
      throw new Error("No fallback AI providers configured.");
    }
  } catch (err) {
    const isRateLimit = err.message && (err.message.includes("429") || err.message.includes("rate_limit") || err.message.includes("Too Many Requests"));
    
    if (isRateLimit) {
      console.warn("[LLM] 429 Rate Limit on Groq. Activating 60s global cooldown and falling back to DeepSeek immediately.");
      global.GROQ_COOLDOWN_UNTIL = Date.now() + 60000;
      if (process.env.DEEPSEEK_API_KEY) return await askDeepSeek(messages, maxTokens, opts);
    }
    
    console.error("[LLM ERROR] Primary API failed:", err.message);
    if (process.env.DEEPSEEK_API_KEY) return await askDeepSeek(messages, maxTokens, opts);
    throw err;
  }
}

module.exports = { askAI, askDeepSeek };

