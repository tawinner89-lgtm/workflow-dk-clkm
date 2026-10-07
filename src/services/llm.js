"use strict";
const axios = require("axios");
const { Groq } = require("groq-sdk");
require("dotenv").config();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const groqModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
global.GROQ_COOLDOWN_UNTIL = null;
async function askDeepSeek(messages, maxTokens, opts = {}) {
  const payload = { model: "deepseek-chat", messages, max_tokens: maxTokens, temperature: opts.temperature ?? 0.4 };
  if (opts.json) payload.response_format = { type: "json_object" };
  const res = await axios.post("https://api.deepseek.com/chat/completions", payload, { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" }, timeout: 20000 });
  return { text: res.data.choices[0].message.content.trim(), tokens: (res.data.usage?.prompt_tokens||0)+(res.data.usage?.completion_tokens||0) };
}
async function askAI(messages, maxTokens=800, retries=3, opts={json:false, temperature:0.4}) {
  if (opts.json && maxTokens < 1500) maxTokens = 1500;
  try {
    if (groqModel && !(global.GROQ_COOLDOWN_UNTIL && Date.now() < global.GROQ_COOLDOWN_UNTIL)) {
      const payload = { messages, model: groqModel, max_tokens: maxTokens, temperature: opts.temperature ?? 0.4 };
      if (opts.json) payload.response_format = { type: "json_object" };
      const completion = await groq.chat.completions.create(payload);
      return { text: completion.choices[0].message.content.trim(), tokens: (completion.usage?.prompt_tokens||0)+(completion.usage?.completion_tokens||0) };
    } else {
      if (process.env.DEEPSEEK_API_KEY) { const r=await askDeepSeek(messages,maxTokens,opts); return {text:r.text, tokens:r.tokens}; }
      throw new Error("No fallback configured");
    }
  } catch (err) {
    const isRateLimit = err.message?.includes("429") || err.message?.includes("rate_limit");
    const isDecommissioned = err.message?.includes("model_decommissioned");
    if (isDecommissioned || isRateLimit) {
      global.GROQ_COOLDOWN_UNTIL = Date.now() + (isDecommissioned?3600000:60000);
      if (process.env.DEEPSEEK_API_KEY) { const r=await askDeepSeek(messages,maxTokens,opts); return {text:r.text, tokens:r.tokens}; }
    }
    console.error("[LLM ERROR]", err.message);
    if (process.env.DEEPSEEK_API_KEY) { const r=await askDeepSeek(messages,maxTokens,opts); return {text:r.text, tokens:r.tokens}; }
    throw err;
  }
}
module.exports = { askAI, askDeepSeek };
