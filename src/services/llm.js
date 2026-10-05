const axios = require("axios");
const { Groq } = require("groq-sdk");
require("dotenv").config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const groqModel = "openai/gpt-oss-120b";
const replyMaxTokens = 800;

global.GROQ_COOLDOWN_UNTIL = null;

async function askOpenRouter(messages, maxTokens) {
  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "qwen/qwen-2.5-72b-instruct",
      messages,
      max_tokens: maxTokens,
      temperature: 0.4,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
  if (res.data.usage) {
    console.log(`[USAGE] Provider: OpenRouter | Model: qwen-2.5-72b | Prompt: ${res.data.usage.prompt_tokens} | Completion: ${res.data.usage.completion_tokens}`);
  }
  return res.data.choices[0].message.content.trim();
}

async function askDeepSeek(messages, maxTokens) {
  const res = await axios.post(
    "https://api.deepseek.com/chat/completions",
    {
      model: "deepseek-chat",
      messages,
      max_tokens: maxTokens,
      temperature: 0.4,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
  if (res.data.usage) {
    console.log(`[USAGE] Provider: DeepSeek | Model: deepseek-chat | Prompt: ${res.data.usage.prompt_tokens} | Completion: ${res.data.usage.completion_tokens}`);
  }
  return res.data.choices[0].message.content.trim();
}

async function askAI(messages, maxTokens = replyMaxTokens, retries = 3) {
  let attempts = 0;
  while (attempts < retries) {
    try {
      // 429 Cooldown Mitigation
      if (groqModel && !(global.GROQ_COOLDOWN_UNTIL && Date.now() < global.GROQ_COOLDOWN_UNTIL)) {
        const completion = await groq.chat.completions.create({
          messages,
          model: groqModel,
          max_tokens: maxTokens,
          temperature: 0.4,
        });
        if (completion.usage) {
          console.log(`[USAGE] Provider: Groq | Model: ${groqModel} | Prompt: ${completion.usage.prompt_tokens} | Completion: ${completion.usage.completion_tokens}`);
        }
        return completion.choices[0].message.content.trim();
      } else {
        if (process.env.DEEPSEEK_API_KEY) return await askDeepSeek(messages, maxTokens);
        if (process.env.OPENROUTER_API_KEY) return await askOpenRouter(messages, maxTokens);
        throw new Error("No fallback AI providers configured (DeepSeek/OpenRouter).");
      }
    } catch (err) {
      attempts++;
      
      const isRateLimit = err.message && (err.message.includes("429") || err.message.includes("rate_limit"));
      const isModelError = err.message && (err.message.includes("model_not_found") || err.message.includes("model_decommissioned"));
      
      if (isRateLimit || isModelError) {
        if (attempts >= retries) {
          console.warn("[LLM FATAL] Rate limit/model error on Groq after retries. Activating 5 min global cooldown.");
          global.GROQ_COOLDOWN_UNTIL = Date.now() + 5 * 60 * 1000;
          throw err;
        }

        const retryAfter = (err.response && err.response.headers && err.response.headers['retry-after'])
          ? parseInt(err.response.headers['retry-after']) * 1000
          : 2000 * Math.pow(2, attempts); // Exponential backoff (4s, 8s...)
          
        console.warn(`[LLM] 429 Rate Limit on Groq. Retrying in ${retryAfter}ms (Attempt ${attempts} of ${retries})...`);
        await new Promise((res) => setTimeout(res, retryAfter));
        continue;
      } else {
        console.error("[LLM ERROR] Primary API failed:", err.message);
      }
      
      if (attempts >= retries) {
        console.error("[LLM FATAL] All AI providers failed after retries.");
        throw err;
      }
      
      try {
        if (process.env.DEEPSEEK_API_KEY) return await askDeepSeek(messages, maxTokens);
        if (process.env.OPENROUTER_API_KEY) return await askOpenRouter(messages, maxTokens);
      } catch (fallbackErr) {
        console.error("[LLM ERROR] Fallback also failed:", fallbackErr.message);
      }
      await new Promise((res) => setTimeout(res, 2000 * attempts));
    }
  }
}

module.exports = { askAI, askDeepSeek, askOpenRouter };
