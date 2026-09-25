"use strict";
require("dotenv").config();

// ─────────────────────────────────────────────
// Dependencies
// ─────────────────────────────────────────────
const { Client, LocalAuth } = require("whatsapp-web.js");
const Groq = require("groq-sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");

// ─────────────────────────────────────────────
// Startup: remove stale Chrome lockfile to prevent EBUSY crash
// ─────────────────────────────────────────────
const LOCKFILE = path.join(__dirname, ".wwebjs_auth", "session", "lockfile");
try {
  if (fs.existsSync(LOCKFILE)) {
    fs.rmSync(LOCKFILE, { force: true });
    console.log("🧹 Stale lockfile removed");
  }
} catch (_) {
  /* ignore */
}

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const CONFIG = {
  groqModel: "openai/gpt-oss-120b",
  maxHistory: 60, // messages kept per user
  replyMaxTokens: 600, // keep replies concise
  extractMaxTokens: 400, // booking extraction call (enough for full JSON)
  qrPort: 3000, // QR web server port
  adminWebhookUrl:
    process.env.ADMIN_WEBHOOK_URL ||
    "http://localhost:3001/api/webhook/make?token=dkclim-ia-2026",
  adminPhone: "212619401129@c.us", // The admin's personal number for dynamic learning
};

// ─────────────────────────────────────────────
// HTTP Server  (port 3000)
// Handles: GET /          → QR page
//          POST /notify   → WhatsApp notification after TERMINEE
// ─────────────────────────────────────────────
const QR_HTML_PATH = "qr.html";
const NOTIFY_TOKEN = process.env.WEBHOOK_SECRET || "dkclim-ia-2026";

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${CONFIG.qrPort}`);

  // ── POST /notify ──────────────────────────────
  if (req.method === "POST" && url.pathname === "/notify") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);

        // Token check
        if (payload.token !== NOTIFY_TOKEN) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Non autorisé" }));
          return;
        }

        const {
          phone,
          clientName,
          reference,
          technicianName,
          type,
          workDone,
          workDoneOther,
          observations,
          finalStatus,
          materialsUsed,
          startTime,
          endTime,
        } = payload;

        if (!phone) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "phone manquant" }));
          return;
        }

        // Format phone → WhatsApp ID (212XXXXXXXXX@c.us)
        let waPhone = String(phone).replace(/\D/g, "");
        if (waPhone.startsWith("0")) waPhone = "212" + waPhone.slice(1);
        if (!waPhone.startsWith("212")) waPhone = "212" + waPhone;
        const waId = `${waPhone}@c.us`;

        // Build workDone list
        let workList = "";
        try {
          const arr =
            typeof workDone === "string"
              ? JSON.parse(workDone)
              : workDone || [];
          if (arr.length > 0) workList = arr.map((w) => `  ✔ ${w}`).join("\n");
        } catch {
          workList = workDone || "";
        }
        if (workDoneOther) workList += `\n  ✔ ${workDoneOther}`;

        const conformite = finalStatus ? "✅ Conforme" : "⚠️ Non conforme";
        const horaires =
          startTime && endTime ? `${startTime} → ${endTime}` : "";

        const message = [
          `🎉 *مرحباً ${clientName || ""}!*`,
          "",
          `تمت خدمتكم بنجاح من طرف فريق *DK Climatisation* 🏆`,
          "",
          `📋 *Référence* : ${reference}`,
          `🔧 *Type*       : ${type || "-"}`,
          `👷 *Technicien* : ${technicianName || "-"}`,
          horaires ? `🕐 *Horaires*   : ${horaires}` : "",
          workList ? `\n🛠 *Travaux effectués :*\n${workList}` : "",
          materialsUsed ? `\n📦 *Matériaux* : ${materialsUsed}` : "",
          observations ? `\n📝 *Observations* : ${observations}` : "",
          `\n⭐ *Statut final* : ${conformite}`,
          "",
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `شكراً لثقتكم في DK Clim 🙏`,
          `لأي سؤال أو استفسار: 0612540085`,
        ]
          .filter((l) => l !== "")
          .join("\n");

        // Send via WhatsApp client (fire-and-forget, don't block response)
        setImmediate(async () => {
          try {
            await client.sendMessage(waId, BOT_WATERMARK + message);
            console.log(`✅ [NOTIFY] Sent to ${waId} for ${reference}`);
          } catch (e) {
            console.error(`[NOTIFY ERR] Could not send to ${waId}:`, e.message);
          }
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, sentTo: waId }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // ── GET / → QR page ──────────────────────────
  fs.readFile(QR_HTML_PATH, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("QR not generated yet – please wait...");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

// Expose a secret endpoint to verify code version
const oldListen = httpServer.listen.bind(httpServer);
httpServer.on('request', (req, res) => {
  if (req.url === '/version') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(fs.readFileSync(__filename, 'utf8'));
  }
});

httpServer.listen(CONFIG.qrPort, () => {
  console.log(
    `🌐  HTTP server → http://localhost:${CONFIG.qrPort}  (QR + /notify)`,
  );
});

// ─────────────────────────────────────────────
// System Prompt  (DK Climatisation commercial agent)
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت المساعد الذكي والمستشار التجاري لشركة "DK Climatisation" (أو DK Clim) الرائدة في مجال التكييف بالمغرب.

🎯 مهمتك: استقبال الزبناء بلباقة، تقديم إجابات دقيقة واحترافية، وإعطاء نصائح ومساعدتهم في طلب المنتجات أو طلب مواعيد للصيانة والتركيب.

🏢 معلومات الشركة:
- الاسم: DK Climatisation / DK Clim (تجنب ذكر أي أسماء أخرى).
- العنوان: إقامة 10 عمارة 5 أبراج الأزهر، فرح السلام، الألفة، الدار البيضاء.
- الموقع على الخريطة (Localisation): https://share.google/EzmAZKv6JNxiktHOj (أرسل هذا الرابط فوراً إذا سأل الزبون عن الموقع).
- الهاتف/واتساب: 0612540085 (https://wa.me/212612540085)
- أوقات العمل: الإثنين–السبت 9h–20h | الطوارئ 7j/7.
- مناطق العمل: الدار البيضاء ونواحيها.
- الموقع الإلكتروني الرسمي: https://www.dkclimatisation.com/
- مواقع التواصل الاجتماعي:
  • فيسبوك: https://web.facebook.com/profile.php?id=61577949231470
  • انستغرام: https://www.instagram.com/dk_clim_maroc/
  • تيك توك: https://www.tiktok.com/@dk.clim.maroc

📦 الأجهزة والماركات (Climatiseurs):
• الأنواع: متوفر لدينا مكيفات عادية (Split)، مكيفات مركزية مخفية (Gainable)، ومكيفات كاسيت (Cassette).
• الماركات المتوفرة: TCL, Carrier, LG, Daikool, CIAT, Midea (في جميع الأنواع: Split, Gainable, Cassette).
• عروض خاصة وتخفيضات (PROMOTIONS ACTUELLES): CARRIER INVERTER R32 A++ (WiFi Intégré, Dernière génération)
  - 9 000 BTU (jusqu'à 15 m²) : الثمن القديم 5999 DH ⬅️ ثمن البرومو الحالي: 4399 DH TTC
  - 12 000 BTU (15 à 20 m²) : الثمن القديم 6599 DH ⬅️ ثمن البرومو الحالي: 4999 DH TTC
  - 18 000 BTU (20 à 30 m²) : الثمن القديم 9199 DH ⬅️ ثمن البرومو الحالي: 6499 DH TTC
  - 24 000 BTU (30 à 45 m²) : الثمن القديم 11999 DH ⬅️ ثمن البرومو الحالي: 8499 DH TTC
  👉 (هذه الأثمنة PROMO تتضمن التوصيل المجاني / Livraison Gratuite، أما التركيب فهو غير مشمول ويبدأ من 500 درهم).
  👉 للكميات الكبيرة والمشاريع (plusieurs unités): أخبر الزبون أن يتواصل مع "مصلحة المبيعات (Service Commercial)" لدراسة العرض.

🛠️ الخدمات والتسعيرة (Tarifs Services):
• التركيب (Installation): ابتداءً من 500 درهم (À partir de 500 DH).
• الصيانة/التنظيف (Entretien): ابتداءً من 300 درهم (À partir de 300 DH).
• التشخيص (Diagnostic): ابتداءً من 200 درهم (À partir de 200 DH).
• الإصلاح (Réparation): يحدد السعر بعد التشخيص (A voir بعد التشخيص).
  👉 ملاحظة مهمة: في حال إجراء الإصلاح لاحقاً، يكون التشخيص بالمجان (Si réparation par la suite, le diagnostic est gratuit).

🔩 الأكسسوارات:
• Télécommandes (تيليكوماند)، أنابيب نحاس، Supports، Gaz (R410A, R32...).
  👉 إذا سأل الزبون عن سعر الأكسسوارات، أخبره: "إلى بغيتي تعرف الثمن بدقة، اتصل بنا في الهاتف والـ Devis بالمجان!".

🧠 قواعد التواصل الصارمة (التزم بها بدقة 100%):

1. مطابقة اللغة (Strict Language Matching):
   - تحدث بنفس لغة الزبون تماماً. إذا تحدث بالدارجة/العربية، أجب بالدارجة/العربية فقط. إذا تحدث بالفرنسية، أجب بالفرنسية فقط.
   - يمنع منعاً باتاً خلط اللغات في نفس الرسالة (Ne pas mélanger le français et l'arabe dans le même message).

2. حجز المواعيد (Rendez-vous Validation):
   - يمنع منعاً باتاً أن تقوم بتأكيد أو اقتراح موعد محدد من عندك!
   - اسأل الزبون فقط عن الأوقات أو الأيام التي تناسبه ("شنو الأوقات أو الأيام اللي كتناسبك؟" / "Quels sont vos jours/créneaux disponibles ?").
   - بمجرد أن يعطيك أوقاته، قل له: "غادي نشوفو مع قسم المواعيد (Service rendez-vous) باش نأكدو معاك أقرب موعد مناسِب" / "Nous allons vérifier avec le service rendez-vous pour vous confirmer le créneau le plus proche."

3. العروض الترويجية (Promotions):
   - عند السؤال عن البروموهات، أكد وجود عروض، ولكن لتأكيد والاستفادة من البرومو قل للزبون: "لتأكيد والاستفادة من البرومو يرجى الاتصال بنا عبر الهاتف."

4. مواعيد التوصيل والتوفر (Délais et Stock):
   - لا تعطِ أبداً مدة توصيل محددة (مثل 2-3 أيام).
   - قل دائماً: "التوصيل والتركيب حسب التوفر في المخزن (Selon la disponibilité en stock)، ويتم تأكيده مع الفريق."

5. أسلوب المحادثة وعدم التكرار:
   - كن طبيعياً جداً كإنسان، واكتب فقرات قصيرة بدون استعمال لوائح مرقمة أو نقاط (No bullet points).
   - تجنب طلب معلومات سبق للزبون أن قدمها في المحادثة.
   - يمنع منعاً باتاً أن تطلب من الزبون رقم هاتفه أو رقم الواتساب (لأنك تتحدث معه على الواتساب وتملك رقمه مسبقاً). اطلب فقط الاسم والعنوان إذا احتجت ذلك.
   - إذا طلب الزبون ماركة غير موجودة فقل: "نقدروا نقلبوا ليك عليها ونشوفوها ليك".

6. صياغة رقم الهاتف (Numéro de Téléphone):
   - لتجنب مشكلة انعكاس الأرقام في اللغة العربية (RTL)، اكتب رقم الهاتف دائماً بهذا الشكل البسيط القابل للنقر: 0612540085 (بدون فواصل، بدون +212، وبدون شرطات).

7. مرجعية الأسعار والمنتجات (Official Website & Catalog Rules):
   - تعتبر المنتجات والأسعار المذكورة أعلاه في هذا الـ Prompt (بما فيها عروض وأثمنة CARRIER) بالإضافة إلى الموقع الإلكتروني (https://www.dkclimatisation.com/) هي المصدر المعتمد للأسعار.
   - يمنع منعاً باتاً اختراع أي سعر من عندك لجهاز أو موديل غير مذكور. إذا سأل الزبون عن منتج غير موجود هنا أو في الموقع، قل له: "هاد المنتج مامذكورش عندي حالياً، ولكن نقدروا نقلبوا ليك عليه ونأكدو معاك الثمن والتفاصيل بعد التواصل مع السيرفيس".

8. صيغة الإجابة لجميع المدن خارج الدار البيضاء (Toutes les villes hors Casablanca):
   - بالنسبة لأي مدينة خارج الدار البيضاء (مثل: برشيد، سطات، مراكش، الرباط، طنجة... إلخ)، التزم دائماً بالإجابة بهاته الصيغة النموذجية المحددة:
     • بالفرنسية:
       "Pour [اسم المدينة], on peut étudier la demande au cas par cas, surtout s'il s'agit d'un projet important ou de plusieurs unités. Ça dépend du type d'intervention et de la charge de travail au moment voulu.
Dites-moi ce que vous avez comme projet (type de clim, nombre d'unités, adresse) et je vous confirme si on peut intervenir. Vous pouvez aussi nous joindre au 0612540085."
     • بالدارجة/العربية:
       "بالنسبة لـ [اسم المدينة]، نقدروا ندرسوا الطلب حالة بحالة (au cas par cas)، خاصة إذا كان مشروع مهم أو عدة مكيفات/وحدات. هادشي كيعتمد على نوع الخدمة وضغط العمل.
قول لينا شنو عندك كـ مشروع (نوع المكيف، عدد الوحدات، والعنوان) ونأكدو معاك إذا قدرنا نتدخلوا. تقدر تتصل بنا أيضاً على 0612540085."
`;

// ─────────────────────────────────────────────
// AI Clients (Groq + DeepSeek Fallback)
// ─────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    },
  );
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
    },
  );
  return res.data.choices[0].message.content.trim();
}

async function askAI(messages, maxTokens = CONFIG.replyMaxTokens, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: CONFIG.groqModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.4,
      });
      const raw = completion.choices[0].message.content ?? "";
      return raw
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/<think>[\s\S]*/g, "")
        .trim();
    } catch (err) {
      console.warn(`[GROQ] Error: ${err.message} – Attempting Fallbacks...`);

      if (process.env.DEEPSEEK_API_KEY) {
        try {
          return await askDeepSeek(messages, maxTokens);
        } catch (dsErr) {
          console.error("[DEEPSEEK FALLBACK ERR]", dsErr.message);
          if (process.env.OPENROUTER_API_KEY) {
            console.warn("[DEEPSEEK] Error – Falling back to OpenRouter (Qwen)!");
            try {
              return await askOpenRouter(messages, maxTokens);
            } catch (orErr) {
              console.error("[OPENROUTER FALLBACK ERR]", orErr.message);
            }
          }
        }
      }

      // If all fallbacks fail, try to retry if it's a rate limit or server error
      const retry = err.status === 429 || err.status === 503 || err.status >= 500;
      if (retry && attempt < retries) {
        const wait = attempt * 2000;
        console.warn(`[AI] retry ${attempt}/${retries} in ${wait}ms`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
}

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

// --- Automatic DB Migration (Safe for Deployment) ---
async function initDB() {
  try {
    await pool.query(`ALTER TABLE "LeadStatus" ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE "LeadStatus" ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP WITH TIME ZONE NULL`);
    console.log("✅ DB schema verified (reminder_count added).");
  } catch (e) {
    console.error("DB Init Error:", e.message);
  }
}
// initDB() will be called before client.initialize()

const syncedUsers = new Map(); // userId → lastSyncTime

async function getHistory(userId) {
  try {
    const res = await pool.query(
      'SELECT role, content FROM "BotMessage" WHERE phone = $1 ORDER BY "createdAt" DESC LIMIT $2',
      [userId, CONFIG.maxHistory],
    );
    return res.rows
      .reverse()
      .map((r) => ({ role: r.role, content: r.content }));
  } catch (e) {
    console.error("DB Fetch Error:", e.message);
    return [];
  }
}

const BOT_WATERMARK = '\u200B';

async function setBotActive(phone, isActive) {
  try {
    await pool.query(
      `INSERT INTO "LeadStatus" (phone, status, is_bot_active, "updatedAt")
       VALUES ($1, 'NEW', $2, NOW())
       ON CONFLICT (phone) DO UPDATE SET is_bot_active = EXCLUDED.is_bot_active, "updatedAt" = NOW()`,
      [phone, isActive]
    );
  } catch (e) {
    console.error("is_bot_active Update Error:", e.message);
  }
}

async function getBotActive(phone) {
  try {
    const res = await pool.query('SELECT is_bot_active FROM "LeadStatus" WHERE phone = $1', [phone]);
    if (res.rows.length > 0) {
      return res.rows[0].is_bot_active === false ? false : true;
    }
    return true;
  } catch (e) {
    return true;
  }
}

function normalizePhone(phone) {
  let cleaned = phone.replace(/[\s\-\+\(\)]/g, "");
  if (cleaned.endsWith("@c.us")) cleaned = cleaned.slice(0, -5);
  if (cleaned.startsWith("0") && cleaned.length === 10) cleaned = "212" + cleaned.slice(1);
  return cleaned + "@c.us";
}

function detectHandoff(reply) {
  if (!reply) return null;
  // Normalize hyphens/dashes to standard hyphen-minus for matching
  const text = reply.toLowerCase().replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');

  // Exclude conditionals where the bot says "Once you give us info, we will transfer..."
  const isConditional = /(منين توصلنا|من بعد ما توصلنا|once we have|dès que nous aurons reçu|si vous souhaitez.*transmettre|باش نقدر.*نشوفو|pour que nous puissions.*transmettre)/i.test(text);

  // Must clearly indicate transmission/verification with the department as an action
  const appointmentRegex = /(nous allons v[éèe]rifier.*service rendez-vous|transmis.*service rendez-vous|transmettre.*service rendez-vous|demande a .t. transmise.*rendez-vous|غادي نشوفو مع قسم المواعيد|تم تحويل.*قسم المواعيد|نأكدو معاك أقرب موعد)/i;

  // Must clearly indicate actual transmission to commercial (not just "vous pouvez contacter")
  const commercialRegex = /(transmis.*service commercial|transf.rer.*service commercial|demande a .t. transmise.*commercial|تم تحويل.*مصلحة المبيعات|تم إرسال.*مصلحة المبيعات)/i;

  if (appointmentRegex.test(text) && !isConditional) {
    // Extra strictness: if it says "غادي نشوفو" but it's part of a conditional block, we already excluded it.
    // If it's a direct confirmation, it passes.
    return 'HANDED_OFF_TO_APPOINTMENT';
  }
  if (commercialRegex.test(text) && !isConditional) {
    return 'HANDED_OFF_TO_COMMERCIAL';
  }

  return null;
}

async function pushMessage(userId, role, content) {
  try {
    await pool.query(
      'INSERT INTO "BotMessage" (id, phone, role, content, "createdAt") VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())',
      [userId, role, content],
    );
  } catch (e) {
    console.error("DB Insert Error:", e.message);
  }
}

async function setLeadStatus(phone, status) {
  try {
    await pool.query(
      `INSERT INTO "LeadStatus" (phone, status, "updatedAt")
       VALUES ($1, $2, NOW())
       ON CONFLICT (phone) DO UPDATE SET status = EXCLUDED.status, "updatedAt" = NOW()`,
      [phone, status]
    );
  } catch (e) {
    console.error("LeadStatus Update Error:", e.message);
  }
}

async function getLeadStatus(phone) {
  try {
    const res = await pool.query('SELECT status FROM "LeadStatus" WHERE phone = $1', [phone]);
    return res.rows.length > 0 ? res.rows[0].status : null;
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────
// Admin Dashboard Sync  (DK Clim Next.js app)
// ─────────────────────────────────────────────
async function syncToAdmin(history, userId) {
  const lastSync = syncedUsers.get(userId) || 0;
  // Prevent duplicate syncing within the same hour for the same user
  if (Date.now() - lastSync < 60 * 60 * 1000) return;

  // Need at least 4 messages (2 user + 2 agent) before trying to extract
  if (history.length < 4) return;

  // Only inspect the last 10 messages for efficiency
  const recentText = history
    .slice(-10)
    .map((m) => `${m.role === "user" ? "CLIENT" : "AGENT"}: ${m.content}`)
    .join("\n");

  const prompt = [
    "Analyse this recent WhatsApp conversation between a DK Clim agent and a client.",
    "IMPORTANT: ONLY extract a booking if the client explicitly requested or confirmed it in the VERY LAST messages.",
    'If the client is just asking random questions, OR if the booking was already finalized earlier and they moved on to casual talk, return {"hasBooking":false}.',
    "If they JUST provided BOTH their full name AND their address to book an intervention, return ONLY a single-line JSON:",
    '{"hasBooking":true,"clientName":"full name","clientAddress":"address","problemReported":"summary","type":"Installation"}',
    'If not enough info yet, or if it is an old topic, return ONLY: {"hasBooking":false}',
    "IMPORTANT: Return ONLY the JSON object, nothing else.",
    "",
    "CONVERSATION:",
    recentText,
  ].join("\n");

  const raw = await askAI(
    [{ role: "user", content: prompt }],
    CONFIG.extractMaxTokens,
  );

  const match = raw.replace(/\r?\n/g, " ").match(/\{[^{}]*\}/);
  if (!match) return;

  let data;
  try {
    data = JSON.parse(match[0]);
  } catch {
    return;
  }

  if (!data.hasBooking || !data.clientName || !data.clientAddress) return;

  const phone = data.clientContactPhone || userId.split("@")[0];

  // ── Auto-Assign Technician ──────────────────────────
  let assignedTech = null;
  try {
    const techRes = await pool.query(
      "SELECT name, phone FROM \"Technician\" WHERE phone IS NOT NULL AND phone != ''",
    );
    const technicians = techRes.rows;
    if (technicians.length > 0) {
      assignedTech =
        technicians[Math.floor(Math.random() * technicians.length)];
    }
  } catch (e) {
    console.error("Failed to fetch technicians", e.message);
  }

  const payload = {
    clientName: data.clientName.trim(),
    clientAddress: data.clientAddress.trim(),
    clientContactPhone: phone,
    problemReported: data.problemReported || "Demande via WhatsApp Bot",
    type: data.type || "Installation",
    technicianName: assignedTech ? assignedTech.name : "À assigner (Bot)",
  };

  console.log("\n🎯 [BOOKING DETECTED]", payload);

  try {
    const res = await axios.post(CONFIG.adminWebhookUrl, payload, {
      timeout: 6000,
    });
    if (res.data?.success) {
      syncedUsers.set(userId, Date.now());
      console.log("✅ [ADMIN SYNC] Intervention:", res.data.data?.reference);

      // ── Send Notification to Technician ────────────────
      if (assignedTech) {
        let techPhone = assignedTech.phone.replace(/\D/g, "");
        if (techPhone.startsWith("0")) techPhone = "212" + techPhone.slice(1);
        const techChatId = techPhone + "@c.us";

        const notifMsg =
          `🚨 *NOUVELLE INTERVENTION ASSIGNÉE* 🚨\n\n` +
          `👤 *Client:* ${payload.clientName}\n` +
          `📍 *Adresse:* ${payload.clientAddress}\n` +
          `📞 *Téléphone:* ${payload.clientContactPhone}\n` +
          `🔧 *Problème/Type:* ${payload.problemReported} (${payload.type})\n\n` +
          `_Merci de contacter le client pour confirmer l'heure de visite._`;

        client
          .sendMessage(techChatId, notifMsg)
          .catch((err) => console.error("Failed to notify tech:", err));
      }
    }
  } catch (err) {
    console.error("[ADMIN SYNC FAILED]", err.message);
  }
}

// ─────────────────────────────────────────────
// WhatsApp Client
// ─────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1047399436-alpha.html",
  },
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
    ],
    protocolTimeout: 120000,
  },
});

// QR Code → write to file + open browser once
let qrBrowserOpened = false;
client.on("qr", (qr) => {
  const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`;
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="20">
  <title>DK Clim – Scan QR</title>
  <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#0b1b24;color:#fff}</style>
</head>
<body>
  <h2>📱 Scannez avec WhatsApp</h2>
  <img src="${imgUrl}" alt="QR Code" width="360">
  <p style="opacity:.6">La page se rafraîchit automatiquement toutes les 20 secondes.</p>
</body>
</html>`;

  fs.writeFileSync(QR_HTML_PATH, html, "utf8");
  console.log("\n🔑 New QR generated →", `http://localhost:${CONFIG.qrPort}`);

  if (!qrBrowserOpened) {
    try {
      execSync("start qr.html");
    } catch (_) {
      /* no-op on headless */
    }
    qrBrowserOpened = true;
  }
});

// ── Reminder Job (Follow-up after 24h & 48h) ────────────────────────
async function startReminderJob(client) {
  setInterval(async () => {
    try {
      const query = `
        WITH LastMessages AS (
          SELECT phone, role, content, "createdAt",
                 ROW_NUMBER() OVER(PARTITION BY phone ORDER BY "createdAt" DESC) as rn
          FROM "BotMessage"
        )
        SELECT l.phone, l.content, l."createdAt", s.reminder_count, s.last_reminder_at, s.status
        FROM LastMessages l
        JOIN "LeadStatus" s ON l.phone = s.phone
        WHERE l.rn = 1
          AND l.role = 'assistant'
          AND s.status IN ('NEW', 'FOLLOW_UP')
          AND (s.is_bot_active IS NULL OR s.is_bot_active = true)
          AND (
            (COALESCE(s.reminder_count, 0) = 0 AND l."createdAt" <= NOW() - INTERVAL '24 hours')
            OR
            (s.reminder_count = 1 AND s.last_reminder_at <= NOW() - INTERVAL '48 hours')
          );
      `;
      const res = await pool.query(query);

      for (const row of res.rows) {
        if (row.phone.includes("619237418") || row.phone === CONFIG.adminPhone) continue;

        const currentCount = row.reminder_count || 0;
        const lastMsgTime = row.createdAt;
        const originalLastReminderAt = row.last_reminder_at;
        const originalStatus = row.status;
        const newCount = currentCount + 1;

        // Atomic Claim/Lock to prevent concurrent duplicate reminders or race conditions
        const claimRes = await pool.query(`
          UPDATE "LeadStatus"
          SET reminder_count = $1, last_reminder_at = NOW(), status = 'FOLLOW_UP', "updatedAt" = NOW()
          WHERE phone = $2
            AND (reminder_count = $3 OR (reminder_count IS NULL AND $3 = 0))
            AND status IN ('NEW', 'FOLLOW_UP')
            AND (is_bot_active IS NULL OR is_bot_active = true)
            AND NOT EXISTS (
               SELECT 1 FROM "BotMessage" WHERE phone = $2 AND role = 'user' AND "createdAt" > $4
            )
          RETURNING *;
        `, [newCount, row.phone, currentCount, lastMsgTime]);

        if (claimRes.rowCount === 0) {
          // Another instance claimed it, OR customer replied recently, OR admin muted the bot
          console.log(`[REMINDER SKIPPED] ${row.phone} already claimed or invalid state.`);
          continue;
        }

        const reminderText = "سلام 👋، هادي مدة ماتواصلنا معاك! واش مزال مهتم بالعروض ديالنا ولا نقدر نعاونك فشي حاجة أخرى؟ نحن رهن الإشارة ديما 😊\n\nBonjour 👋, êtes-vous toujours intéressé par nos offres ou avez-vous besoin de plus d'informations ? Nous sommes à votre disposition 😊";

        try {
          await client.sendMessage(row.phone, BOT_WATERMARK + reminderText);
          await pushMessage(row.phone, "assistant", reminderText);

          console.log(`[REMINDER SENT] to ${row.phone} (Reminder #${newCount})`);
        } catch (e) {
          console.error(`[REMINDER ERROR] failed to send to ${row.phone}`, e.message);
          // Revert claim if message failed to send, BUT only if customer hasn't reset it or admin hasn't changed status
          await pool.query(`
            UPDATE "LeadStatus"
            SET reminder_count = $1, last_reminder_at = $2, status = $3
            WHERE phone = $4 AND reminder_count = $5 AND status = 'FOLLOW_UP'
          `, [currentCount, originalLastReminderAt, originalStatus, row.phone, newCount]);
        }
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error("[REMINDER DB ERROR]", e.message);
    }
  }, 60 * 60 * 1000); // Check every 1 hour
}

client.on("ready", async () => {
  console.log("✅ WhatsApp Client is READY!");
  qrBrowserOpened = true; // Stop opening QR

  // Start the reminder job
  startReminderJob(client);
});

// ─────────────────────────────────────────────
// Dynamic System Prompt (Base + DB Rules)
// ─────────────────────────────────────────────
async function getSystemPrompt() {
  let prompt = SYSTEM_PROMPT;
  try {
    const res = await pool.query(
      'SELECT rule FROM "BotRule" ORDER BY "createdAt" ASC',
    );
    if (res.rows.length > 0) {
      prompt +=
        "\n\n**تعليمات جديدة ومهمة جداً (يجب أن تطبقها دائماً وتتجاهل أي تعليمات سابقة تخالفها):**\n";
      for (const row of res.rows) {
        prompt += `- ${row.rule}\n`;
      }
    }
  } catch (e) {
    console.error("Failed to fetch rules:", e.message);
  }
  return prompt;
}

// ─────────────────────────────────────────────
// Message Handlers
// ─────────────────────────────────────────────

client.on("message_create", async (msg) => {
  if (!msg.fromMe) return; // incoming messages are handled by 'message' event

  const userId = msg.to; // The customer's phone number
  let body = msg.body || "";

  if (body.startsWith(BOT_WATERMARK)) {
    // BOT_OUTGOING
    return;
  }

  // HUMAN_OUTGOING
  body = body.replace(new RegExp(BOT_WATERMARK, 'g'), '').trim();

  // Store the human message in BotMessage using role = "admin"
  await pushMessage(userId, "admin", body);

  // L'auto-mute a été supprimé ici. Le bot reste actif.
  // Seules les commandes /rdv, /close et /mute arrêteront le bot.
});

client.on("message", async (msg) => {
  // Only respond to private chats (ignore groups and status broadcasts)
  if (msg.from === "status@broadcast" || msg.from.includes("@g.us")) return;

  // Ignore technician number so bot does not reply to them
  if (msg.from === "212619237418@c.us") return;

  const userId = msg.from;
  let body = msg.body?.trim() || "";

  if (msg.type === "ptt" || msg.type === "audio") {
    await msg.reply(
      BOT_WATERMARK + "عذراً، ما كنقدرش نسمع الأوديوهات حالياً 😅 تقدر تكتب ليا شنو بغيتي؟ وإلا ما كنتيش تقدر تكتب، ها هو غادي يجاوبك شي حد من الفريق ديالنا."
    );
    return;
  }

  if (msg.hasMedia) {
    body = `[الزبون أرسل صورة أو فيديو] ${body}`;
  }

  if (body.length > 1000) {
    body = body.substring(0, 1000) + "... (تم قطع الرسالة لأنها طويلة جداً)";
  }

  if (!body.trim()) return;

  // ── Admin Learning Mode ──────────────────────────
  const isAdmin =
    userId === CONFIG.adminPhone ||
    userId === "191396711506131@lid" ||
    userId === "212669247744@c.us" ||
    userId === "280998453498053@lid";

  if (isAdmin) {
    if (body.toLowerCase() === "مسح" || body.toLowerCase() === "clear") {
      await pool.query('DELETE FROM "BotRule"');
      await msg.reply(
        BOT_WATERMARK + "✅ تم مسح جميع القواعد الإضافية. البوت دابا رجع للحالة الأصلية ديالو."
      );
      return;
    }

    if (body.toLowerCase().startsWith("/mute ")) {
      const rawPhone = body.split(" ")[1].trim();
      const targetPhone = normalizePhone(rawPhone);
      await setBotActive(targetPhone, false);
      await msg.reply(BOT_WATERMARK + `✅ Bot muted for ${targetPhone}`);
      return;
    }

    if (body.toLowerCase().startsWith("/unmute ")) {
      const rawPhone = body.split(" ")[1].trim();
      const targetPhone = normalizePhone(rawPhone);
      await setBotActive(targetPhone, true);
      await msg.reply(BOT_WATERMARK + `✅ Bot unmuted for ${targetPhone}`);
      return;
    }

    // ONLY save as rule if the admin starts the message with "قاعدة:" or "rule:" or "تعلم:"
    const lowerBody = body.toLowerCase();
    if (
      lowerBody.startsWith("قاعدة:") ||
      lowerBody.startsWith("rule:") ||
      lowerBody.startsWith("تعلم:")
    ) {
      const actualRule = body.substring(body.indexOf(":") + 1).trim();
      try {
        await pool.query(
          'INSERT INTO "BotRule" (id, rule, "createdAt") VALUES (gen_random_uuid()::text, $1, NOW())',
          [actualRule],
        );
        await msg.reply(
          BOT_WATERMARK + '✅ حفظت هاد المعلومة! البوت غادي يولي يطبقها مع أي كليان جديد من دابا الفوق.\n\n_(باش تمسح كاع القواعد، صيفط ليا كلمة "مسح")_'
        );
      } catch (e) {
        console.error("Failed to save rule", e.message);
        await msg.reply(BOT_WATERMARK + "❌ وقع شي خطأ فـ السيرفر.");
      }
      return;
    }

    // If the admin didn't use the keyword, let them chat normally!
  }

  console.log(`\n[IN]  ${userId}: "${body.slice(0, 80)}"`);

  try {
    // 1. Save user message immediately (Doing this FIRST strengthens Cron race-condition protection)
    await pushMessage(userId, "user", body);

    // 2. RESET reminder sequence upon customer message
    try {
      await pool.query(
        `UPDATE "LeadStatus" SET reminder_count = 0, last_reminder_at = NULL WHERE phone = $1`,
        [userId]
      );
    } catch(e) {
      console.error("Reset reminder error:", e.message);
    }

    // 2.5. Check if bot is active (Not handled by a human)
    const isBotActive = await getBotActive(userId);
    if (!isBotActive) {
      console.log(`[MUTED] Ignored message from ${userId} because they are HUMAN_HANDLED.`);
      return;
    }

    // 2. Debounce logic (Anti-Spam / Wait 2 seconds before replying)
    if (!global.debounceTimers) global.debounceTimers = new Map();
    if (global.debounceTimers.has(userId))
      clearTimeout(global.debounceTimers.get(userId));

    global.debounceTimers.set(
      userId,
      setTimeout(async () => {
        try {
          global.debounceTimers.delete(userId);

          let chat = null;
          try {
            chat = await msg.getChat();
            await chat.sendStateTyping();
          } catch (e) {
            console.warn(
              "[TYPING WARN] Could not send typing state:",
              e.message,
            );
          }

          // Fetch history (will include ALL messages sent during the 2s window)
          const history = await getHistory(userId);

          const aiMessages = [
            { role: "system", content: await getSystemPrompt() },
            ...history,
          ];

          const reply = await askAI(aiMessages);
          await pushMessage(userId, "assistant", reply);

          // Update Lead Status persistently
          const currentStatus = await getLeadStatus(userId);

          if (
            currentStatus !== 'HANDED_OFF_TO_APPOINTMENT' &&
            currentStatus !== 'HANDED_OFF_TO_COMMERCIAL' &&
            currentStatus !== 'CLOSED'
          ) {
             const detectedHandoff = detectHandoff(reply);
             if (detectedHandoff) {
                await setLeadStatus(userId, detectedHandoff);
             } else {
                await setLeadStatus(userId, "NEW");
             }
          }

          if (chat) {
            try {
              await chat.clearState();
            } catch (e) {}
          }

          await msg.reply(BOT_WATERMARK + reply);
          console.log(`[OUT] ${reply.slice(0, 100)}`);

          syncToAdmin(history, userId).catch((err) =>
            console.error("[SYNC ERR]", err.message),
          );
        } catch (innerErr) {
          console.error("[AI DEBOUNCE ERR]", innerErr.message);
          // We removed the "مشكل تقني" message because if Puppeteer times out during msg.reply(),
          // the message actually went through, and we don't want to spam the user with an error.
        }
      }, 2000),
    ); // Wait 2000ms
  } catch (err) {
    console.error("[MSG ERR]", err.message);
  }
});

// ─────────────────────────────────────────────
// Disconnect & Error Handling  (PM2 restarts cleanly)
// ─────────────────────────────────────────────
client.on("disconnected", (reason) => {
  console.error("[DISCONNECTED]", reason, "– exiting for PM2 restart");
  if (reason === "LOGOUT" || reason === "NAVIGATION") {
    try {
      console.log("User logged out. Clearing auth cache...");
      fs.rmSync(path.join(__dirname, ".wwebjs_auth"), {
        recursive: true,
        force: true,
      });
      fs.rmSync(path.join(__dirname, ".wwebjs_cache"), {
        recursive: true,
        force: true,
      });
    } catch (e) {
      console.error("Failed to clear cache:", e.message);
    }
  }
  process.exit(1);
});

// ─────────────────────────────────────────────
// Graceful Shutdown (Level-Up)
// ─────────────────────────────────────────────
process.on("SIGINT", async () => {
  console.log("\n[SHUTDOWN] Closing database and WhatsApp client safely...");
  try {
    await pool.end();
    await client.destroy();
  } catch (e) {
    console.error("Shutdown Error:", e.message);
  }
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  const msg = err.message || "";
  // EBUSY lockfile is harmless — Chromium async cleanup, never crash for it
  if (msg.includes("EBUSY") && msg.includes("lockfile")) return;
  console.error("[UNCAUGHT]", msg);
  if (
    msg.includes("Execution context was destroyed") ||
    msg.includes("TargetCloseError")
  ) {
    console.log("Puppeteer context lost – exiting for PM2 restart");
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  // EBUSY on lockfile is harmless — Chrome cleans up async, ignore it
  if (msg.includes("EBUSY") && msg.includes("lockfile")) return;
  console.error("[UNHANDLED REJECTION]", msg);
});

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
(async () => {
  await initDB();
  client.initialize();
})();
