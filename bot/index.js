"use strict";
require('dotenv').config();
if (!process.env.ADMIN_PASSWORD) { console.warn('WARNING: ADMIN_PASSWORD not set. Using default fallback password.'); }
process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message && reason.message.includes('Execution context was destroyed')) {
        console.warn('[PUPPETEER WARNING] Execution context destroyed. Ignoring to prevent crash.');
        return;
    }
    console.error('[UNHANDLED REJECTION]', reason);
});

// ---------------------------------------------------------
// Dependencies
// ---------------------------------------------------------
const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const qrTerminal = require("qrcode-terminal");
const { pool } = require("./src/config/db");
const { normalizePhone, normalizePhoneWithSuffix, getMoroccanPhone } = require("./src/utils");
const { createConfirmedBooking } = require("./src/services/interventions");
const { render } = require("./lib/v2/templates");
const { renderQrSvg } = require("./src/utils/qr");
const BUSINESS_RULES_TEXT = JSON.stringify(require("../shared/business.json"), null, 2);

// ---------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------
const BOT_WATERMARK = "\u200B";
const MEDIA_AUTO_REPLY = "Merci pour votre fichier. Notre service client l'analysera et vous répondra dans les plus brefs délais. 📞 شكراً على إرسالك. فريق خدمة العملاء سيقوم بالرد عليك في أقرب وقت. 📞";

// Phone Normalization Utilities
function getRawPhone(phoneOrId) {
  return normalizePhone(phoneOrId);
}

const DEFAULT_ADMINS = (
  process.env.ADMIN_NUMBERS
    ? process.env.ADMIN_NUMBERS.split(",")
    : []
)
  .map((s) => getRawPhone(s.trim()))
  .filter(Boolean);

let TEAM_NUMBERS = [...DEFAULT_ADMINS];

// Optional local cache for development
try {
  if (fs.existsSync("admins.json")) {
    const cached = JSON.parse(fs.readFileSync("admins.json", "utf8"));
    if (Array.isArray(cached)) {
      const cleanCached = cached.map((s) => getRawPhone(s)).filter(Boolean);
      TEAM_NUMBERS = Array.from(new Set([...TEAM_NUMBERS, ...cleanCached]));
    }
  }
} catch (_) {}

const CONFIG = {
  groqModel: "openai/gpt-oss-120b",
  maxHistory: 60,
  replyMaxTokens: 600,
  extractMaxTokens: 400,
  qrPort: parseInt(process.env.PORT, 10) || 3000,
  adminWebhookUrl: process.env.ADMIN_WEBHOOK_URL,
  notifyToken: process.env.WEBHOOK_SECRET,
  adminPassword: process.env.ADMIN_PASSWORD,
  debounceDelay: 7000,
};

// ---------------------------------------------------------
// Startup: remove stale Chrome lockfile
// ---------------------------------------------------------
const LOCKFILE = path.join(__dirname, ".wwebjs_auth", "session", "lockfile");
try {
  if (fs.existsSync(LOCKFILE)) {
    fs.rmSync(LOCKFILE, { force: true });
    console.log("[CLEANUP] Removed stale lockfile");
  }
} catch (_) {
  /* ignore */
}

// ---------------------------------------------------------
// Database pool is shared through src/config/db.js.

// Automatic DB Migration (Safe, Idempotent)
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "ProcessedMessage" (
        id TEXT PRIMARY KEY,
        status VARCHAR(100),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "ConversationState" (
          phone VARCHAR(50) PRIMARY KEY,
          state JSONB,
          "updatedAt" TIMESTAMP DEFAULT NOW()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "LeadStatus" (
        phone VARCHAR(255) PRIMARY KEY,
        status VARCHAR(100) DEFAULT 'NEW',
        is_bot_active BOOLEAN DEFAULT true,
        reminder_count INTEGER DEFAULT 0,
        last_reminder_at TIMESTAMP WITH TIME ZONE NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "BotMessage" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        phone VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS "idx_botmessage_phone" ON "BotMessage" (phone);`
    );
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "InterventionSync" (
        hash TEXT PRIMARY KEY,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "SaleSync" (
        hash TEXT PRIMARY KEY,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Inventory" (
        id SERIAL PRIMARY KEY,
        brand VARCHAR(50),
        btu VARCHAR(50),
        stock_quantity INT
      );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Inventory_brand_btu_key"
      ON "Inventory" (brand, btu);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "SalesLog" (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT NOW(),
        brand VARCHAR(50),
        btu VARCHAR(50),
        customer_name VARCHAR(100),
        customer_phone VARCHAR(50),
        status VARCHAR(20) DEFAULT 'PENDING',
        notes TEXT
      );
    `);
    await pool.query(`ALTER TABLE "SalesLog" ADD COLUMN IF NOT EXISTS notes TEXT`);
    await pool.query(`ALTER TABLE "SalesLog" ADD COLUMN IF NOT EXISTS "syncHash" TEXT`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "SalesLog_syncHash_key" ON "SalesLog" ("syncHash")`);

    // Keep bot writes compatible with the dashboard schema when a deployment
    // starts before the Prisma migration has been applied. These are additive
    // and idempotent; existing intervention and technician data is preserved.
    await pool.query(`
      ALTER TABLE "Intervention"
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS intent TEXT,
        ADD COLUMN IF NOT EXISTS symptom TEXT,
        ADD COLUMN IF NOT EXISTS ac_type TEXT,
        ADD COLUMN IF NOT EXISTS units INTEGER,
        ADD COLUMN IF NOT EXISTS brand TEXT,
        ADD COLUMN IF NOT EXISTS btu TEXT,
        ADD COLUMN IF NOT EXISTS budget DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS room_area DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS day TEXT,
        ADD COLUMN IF NOT EXISTS time_window TEXT,
        ADD COLUMN IF NOT EXISTS "syncHash" TEXT;
    `);
    await pool.query(`
      ALTER TABLE "Technician"
        ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE;
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Intervention_syncHash_key"
      ON "Intervention" ("syncHash");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "Intervention_createdAt_idx"
      ON "Intervention" ("createdAt");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "Intervention_technicianName_status_idx"
      ON "Intervention" ("technicianName", status);
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "BotRule" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        rule TEXT NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "BotAdmin" (
        phone VARCHAR(255) PRIMARY KEY,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(
      `ALTER TABLE "LeadStatus" ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0`
    );
    await pool.query(
      `ALTER TABLE "LeadStatus" ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP WITH TIME ZONE NULL`
    );

    // Seed default admins in database
    for (const adminNum of DEFAULT_ADMINS) {
      await pool.query(
        `INSERT INTO "BotAdmin" (phone, "createdAt") VALUES ($1, NOW()) ON CONFLICT (phone) DO NOTHING`,
        [adminNum]
      );
    }

    // Load active admins from database
    const adminRows = await pool.query('SELECT phone FROM "BotAdmin"');
    const dbAdmins = adminRows.rows.map((r) => r.phone);
    TEAM_NUMBERS = Array.from(new Set([...DEFAULT_ADMINS, ...dbAdmins]));

    console.log(
      `✅ DB schema verified and initialized. Active admins: ${TEAM_NUMBERS.length}`
    );
  } catch (e) {
    console.error("DB Init Error:", e.message);
  }
}

// ---------------------------------------------------------
// HTTP Server (Unified Router)
// ---------------------------------------------------------
const QR_HTML_PATH = path.join(__dirname, "qr.html");
fs.writeFileSync(QR_HTML_PATH, `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DK Clim - WhatsApp</title><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0b1b24;color:#fff"><h2>Connexion WhatsApp en cours…</h2><p>La page se mettra à jour automatiquement.</p></body></html>`, "utf8");

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${CONFIG.qrPort}`);
  const pathname = url.pathname;

  // Health / version check
  if (req.method === "GET" && pathname === "/version") {
    const authHeader =
      req.headers["authorization"] || url.searchParams.get("token");
    if (
      authHeader !== CONFIG.notifyToken &&
      authHeader !== `Bearer ${CONFIG.notifyToken}`
    ) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Non autorisé" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        adminCount: TEAM_NUMBERS.length,
      })
    );
    return;
  }

  // Notify endpoint for interventions
  if (req.method === "POST" && pathname === "/notify") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);

        if (payload.token !== CONFIG.notifyToken) {
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

        const waId = normalizePhoneWithSuffix(phone);
        if (!waId || waId.length <= 5 || !waId.endsWith("@c.us")) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: false,
              error: "Numéro de téléphone invalide",
            })
          );
          return;
        }

        let workList = "";
        try {
          const arr =
            typeof workDone === "string"
              ? JSON.parse(workDone)
              : workDone || [];
          if (Array.isArray(arr) && arr.length > 0) {
            workList = arr.map((w) => `  • ${w}`).join("\n");
          }
        } catch {
          workList = workDone || "";
        }
        if (workDoneOther) {
          workList += (workList ? "\n" : "") + `  • ${workDoneOther}`;
        }

        const horaires =
          startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || "");

        const conformite = finalStatus
          ? (finalStatus.toLowerCase().includes("conforme") && !finalStatus.toLowerCase().includes("non")
              ? "✅ Conforme"
              : `⚠️ ${finalStatus}`)
          : "N/A";

        const message = [
          "🚨 *NOUVELLE INTERVENTION* 🚨",
          "",
          "👤 *Client* : " + (clientName || "Inconnu"),
          "🔖 *Référence* : " + (reference || "-"),
          "🔧 *Type* : " + (type || "-"),
          "👨‍🔧 *Technicien* : " + (technicianName || "-"),
          horaires ? "⏰ *Horaires* : " + horaires : "",
          workList ? "\n🛠️ *Travaux effectués :*\n" + workList : "",
          materialsUsed ? "\n📦 *Matériaux* : " + materialsUsed : "",
          observations ? "\n📝 *Observations* : " + observations : "",
          "\n📌 *Statut final* : " + conformite,
          "",
          "-----------------------------------",
          "📞 Contact DK Clim: 0612540085"
        ].filter(Boolean).join("\n");

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

  // Default: serve QR html
  fs.readFile(QR_HTML_PATH, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("QR not generated yet - please wait for bot startup");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

httpServer.listen(CONFIG.qrPort, () => {
  console.log(`✅ HTTP Server listening on http://localhost:${CONFIG.qrPort}`);
});

// ---------------------------------------------------------
// DB Helpers
// ---------------------------------------------------------
async function getHistory(userId) {
  try {
    const res = await pool.query(
      'SELECT role, content FROM "BotMessage" WHERE phone = $1 ORDER BY "createdAt" DESC LIMIT $2',
      [userId, CONFIG.maxHistory]
    );
    return res.rows.reverse().map((r) => ({ role: r.role, content: r.content }));
  } catch (e) {
    console.error("DB Fetch Error:", e.message);
    return [];
  }
}

async function pushMessage(userId, role, content) {
  try {
    await pool.query(
      'INSERT INTO "BotMessage" (id, phone, role, content, "createdAt") VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())',
      [userId, role, content]
    );
  } catch (e) {
    console.error("DB Insert Error:", e.message);
  }
}

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
    const res = await pool.query(
      'SELECT is_bot_active FROM "LeadStatus" WHERE phone = $1',
      [phone]
    );
    if (res.rows.length > 0) {
      return res.rows[0].is_bot_active !== false;
    }
    return true;
  } catch (e) {
    return true;
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
    const res = await pool.query(
      'SELECT status FROM "LeadStatus" WHERE phone = $1',
      [phone]
    );
    return res.rows.length > 0 ? res.rows[0].status : null;
  } catch (e) {
    return null;
  }
}

function detectHandoff(reply) {
  if (!reply) return null;
  const text = reply
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-");

  const isConditional = /(si vous voulez|if you want|voulez-vous)/i.test(text);

  const appointmentRegex = /(rendez-vous|rdv|prendre.*rendez|book.*appointment|schedule)/i;
  const commercialRegex = /(commercial|devis|prix.*achat|acheter|facture|service commercial|parler.*humain|agent humain)/i;

  if (appointmentRegex.test(text) && !isConditional) {
    return "HANDED_OFF_TO_APPOINTMENT";
  }
  if (commercialRegex.test(text) && !isConditional) {
    return "HANDED_OFF_TO_COMMERCIAL";
  }

  return null;
}

// ---------------------------------------------------------
// Admin Dashboard Sync (DK Clim Next.js App)
// ---------------------------------------------------------
async function syncToAdmin(history, userId) {
    if (history.length < 4) return;

  const recentText = history
    .slice(-10)
    .map((m) => `${m.role === "user" ? "CLIENT" : "AGENT"}: ${m.content}`)
    .join("\n");

  const prompt = [
    "Analyse this recent WhatsApp conversation between a DK Clim agent and a client.",
    "IMPORTANT: ONLY extract a booking if the client explicitly requested or confirmed it in the VERY LAST messages.",
    'If the client is just asking random questions, OR if the booking was already finalized earlier and they moved on to casual talk, return {"hasBooking":false}.',
    "If they JUST provided BOTH their full name AND their address to book an intervention, return ONLY a single-line JSON:",
    '{"hasBooking":true,"clientName":"full name","clientAddress":"address","clientContactPhone":"extract phone if user provided it AT ANY POINT in chat, otherwise null","proposedTime":"optional date/time or null","problemReported":"summary","type":"Installation"}',
    'If not enough info yet, or if it is an old topic, return ONLY: {"hasBooking":false}',
    "IMPORTANT: Return ONLY the JSON object, nothing else.",
    "",
    "CONVERSATION:",
    recentText,
  ].join("\n");

  // Lazy load askAI to avoid circular deps at top
  let askAI;
  try {
    askAI = require('./src/services/llm').askAI;
  } catch {
    const { askAI: fallback } = require('./lib/v2/engine') || {};
    if (!fallback) return;
    askAI = fallback;
  }

  const raw = await askAI(
    [{ role: "user", content: prompt }],
    CONFIG.extractMaxTokens
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

  let rawExtractedPhone = data.clientContactPhone || getRawPhone(userId);
  let digitCount = String(rawExtractedPhone).replace(/\D/g, "").length;
  const phone = (digitCount >= 9 && digitCount <= 14) ? rawExtractedPhone : "Non fourni";

  // DETERMINISTIC VALIDATION: DO NOT trigger intervention if phone or time is missing.
  if (phone === "Non fourni" || !data.proposedTime) {
    console.log("[SYNC] Skipping - missing phone or proposedTime");
    return;
  }

    // ATOMIC IDEMPOTENCY BY PAYLOAD HASH
  const syncHash = crypto.createHash('sha256').update(JSON.stringify({
    userId,
    name: data.clientName.trim(),
    address: data.clientAddress.trim(),
    phone: phone,
    type: data.type || "Installation",
    proposedTime: data.proposedTime || "N/A"
  })).digest('hex');

  try {
    const res = await pool.query(
      `INSERT INTO "InterventionSync" (hash, "createdAt") VALUES ($1, NOW()) ON CONFLICT (hash) DO NOTHING RETURNING hash`,
      [syncHash]
    );
    if (res.rowCount === 0) {
      console.log("[SYNC] Duplicate intervention - skipping");
      return;
    }
  } catch (e) {
    console.error("InterventionSync DB error:", e.message);
  }

  let assignedTech = null;
  try {
    const techRes = await pool.query(
      "SELECT name, phone FROM \"Technician\" WHERE phone IS NOT NULL AND phone != ''"
    );
    const technicians = techRes.rows;
    if (technicians.length > 0) {
      assignedTech =
        technicians[Math.floor(Math.random() * technicians.length)];
    }
  } catch (e) {
    console.error("Failed to fetch technicians:", e.message);
  }

  const payload = {
    clientName: data.clientName.trim(),
    clientAddress: data.clientAddress.trim(),
    clientContactPhone: phone,
    proposedTime: data.proposedTime || undefined,
    problemReported: data.problemReported || "Demande via WhatsApp Bot",
    type: data.type || "Installation",
    technicianName: assignedTech ? assignedTech.name : "A assigner (Bot)",
  };

  console.log("[ADMIN SYNC PAYLOAD]", payload);

  try {
    const res = await axios.post(CONFIG.adminWebhookUrl, payload, {
      headers: {
        Authorization: `Bearer ${CONFIG.notifyToken}`,
        "Content-Type": "application/json",
      },
      timeout: 6000,
    });
    if (res.data?.success) {
      console.log("✅ [ADMIN SYNC] Intervention:", res.data.data?.reference);

      if (assignedTech && assignedTech.phone) {
        const techChatId = normalizePhoneWithSuffix(assignedTech.phone);
        let timeSuffix = `_Merci de contacter le client pour confirmer l'heure de visite._`;
        if (payload.proposedTime) {
          timeSuffix = `🕐 *Créneau:* ${payload.proposedTime}\n\n${timeSuffix}`;
        }
        const notifMsg =
          `🚨 *NOUVELLE INTERVENTION ASSIGNÉE* 🚨\n\n` +
          `👤 *Client:* ${payload.clientName}\n` +
          `📍 *Adresse:* ${payload.clientAddress}\n` +
          `📞 *Téléphone:* ${payload.clientContactPhone}\n` +
          `🔧 *Problème/Type:* ${payload.problemReported} (${payload.type})\n\n` +
          timeSuffix;

        client
          .sendMessage(techChatId, BOT_WATERMARK + notifMsg)
          .catch((err) => console.error("Failed to notify tech:", err.message));
      }
    }
  } catch (err) {
    console.error("[ADMIN SYNC FAILED]", err.message);
  }
}

// ---------------------------------------------------------
// WhatsApp Client Setup
// ---------------------------------------------------------
const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1047399436-alpha.html",
  },
  puppeteer: {
    headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
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

let qrBrowserOpened = false;
client.on("qr", (qr) => {
  const qrSvg = renderQrSvg(qr);
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="20">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DK Clim - Scan QR</title>
  <style>body{font-family:sans-serif;text-align:center;padding:32px;background:#0b1b24;color:#fff}.qr{background:#fff;padding:12px;width:min(360px,80vw);margin:24px auto}.qr svg{display:block;width:100%;height:auto}</style>
</head>
<body>
  <h2>📱 Scannez avec WhatsApp</h2>
  <div class="qr">${qrSvg}</div>
  <p style="opacity:.6">La page se rafraîchit automatiquement toutes les 20 secondes.</p>
</body>
</html>`;

  fs.writeFileSync(QR_HTML_PATH, html, "utf8");
  console.log(`[QR] Open http://localhost:${CONFIG.qrPort}`);
  qrTerminal.generate(qr, { small: true });

  if (!qrBrowserOpened) {
    if (process.platform === "win32" && process.env.NODE_ENV !== "production") {
      try {
        const browserProcess = spawn("cmd", ["/c", "start", "", "qr.html"], { detached: true, stdio: "ignore" });
        browserProcess.unref();
      } catch (_) {
        /* ignore */
      }
    }
    qrBrowserOpened = true;
  }
});

client.on("ready", async () => {
  console.log("✅ WhatsApp Client is READY!");
  fs.writeFileSync(QR_HTML_PATH, `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DK Clim - WhatsApp connecté</title><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0b1b24;color:#fff"><h2>✅ WhatsApp est connecté</h2><p>Le bot DK Clim est prêt.</p></body></html>`, "utf8");
  qrBrowserOpened = true;
});

client.on("authenticated", () => console.log('[WA AUTHENTICATED] Session authentifiée.'));
client.on("auth_failure", (message) => console.error('[WA AUTH FAILURE]', String(message).slice(0, 200)));
client.on("loading_screen", (percent, message) => console.log(`[WA LOADING] ${percent}% ${String(message || '').slice(0, 80)}`));
client.on("change_state", (state) => console.log(`[WA STATE] ${state}`));

// ---------------------------------------------------------
// Message State & Queues
// ---------------------------------------------------------
const debounceTimers = new Map();
const isProcessing = new Map();

client.on("message_create", async (msg) => {
  try {
    if (!msg.fromMe) return;
    // Ignore group messages and broadcast channels
    if (!msg.to || msg.to === "status@broadcast" || msg.to.includes("@g.us")) return;

    let rawPhone = getRawPhone(msg.to);
    try {
      const contact = await client.getContactById(msg.to);
      if (contact && contact.number) rawPhone = contact.number;
    } catch (e) {
      console.warn("[WARN] getContact failed in message_create, falling back to msg.to");
    }
    const userId = normalizePhoneWithSuffix(rawPhone);
    const body = msg.body || "";

    // Ignore bot's own messages (watermarked)
    if (body.startsWith(BOT_WATERMARK)) {
      return;
    }

    // AUTO-MUTE: Human agent took over conversation
    if (debounceTimers.has(userId)) {
      clearTimeout(debounceTimers.get(userId));
      debounceTimers.delete(userId);
    }
    
    // Also explicitly mark it as not processing anymore to kill any pending queue
    isProcessing.delete(userId);

    await setBotActive(userId, false);
    msg.getChat().then(chat => chat.clearState()).catch(()=>{});
    console.log(
      `[AUTO-MUTE] Admin replied manually. Bot silenced for ${userId}`
    );
  } catch (err) {
    console.error("[ERROR] message_create event crashed:", err.message);
  }
});

async function notifyAdminV2(userId, slots, intent) {
  const result = await createConfirmedBooking(userId, intent, slots);
  if (!result.ok) {
    console.error('[V2 INTERVENTION NOT SAVED]', result.reason, result.missing || result.error || '');
    return result;
  }

  const intervention = result.intervention;
  console.log(`[V2 INTERVENTION SAVED] ${intervention.reference} (${result.duplicate ? 'duplicate' : 'new'})`);
  if (result.duplicate) return result;

  if (result.technician?.phone) {
    const techChatId = normalizePhoneWithSuffix(result.technician.phone);
    const rawClientPhone = intervention.clientContactPhone || userId;
    const moroccanClientPhone = getMoroccanPhone(rawClientPhone);
    const normalizedClientPhone = normalizePhone(rawClientPhone);
    const displayClientPhone = moroccanClientPhone || (normalizedClientPhone ? `+${normalizedClientPhone}` : 'Non renseigné');
    const problem = [intervention.problemReported, intervention.type].filter(Boolean).join(' / ') || 'À préciser';
    const notifMsg =
      `🚨 NOUVELLE INTERVENTION ASSIGNÉE (V2) 🚨\n\n` +
      `👤 Client: ${intervention.clientName || 'Non renseigné'}\n` +
      `📍 Adresse: ${intervention.clientAddress || 'Non renseignée'}\n` +
      `📞 Téléphone: ${displayClientPhone}\n` +
      `🔧 Problème/Type: ${problem}\n\n` +
      `Merci de contacter le client pour confirmer l'heure de visite.`;
    try {
      await client.sendMessage(techChatId, BOT_WATERMARK + notifMsg);
      console.log(`[TECH NOTIFIED] ${intervention.reference}`);
    } catch (error) {
      console.error('[TECH NOTIFICATION FAILED]', intervention.reference, error.message);
    }
  } else {
    console.warn(`[NO AVAILABLE TECHNICIAN] ${intervention.reference}; admin assignment required`);
    // The booking already exists in the dashboard. Pass its reference so the
    // handoff notifier alerts the team without inserting a duplicate row.
    await notifyHandoff(userId, 'no_available_technician', intervention.reference, {
      intent,
      slots,
      reference: intervention.reference,
    });
  }
  return result;
}

const activeMessageIds = new Map();
const pendingBodies = new Map();
const handoffCooldowns = new Map();

async function notifyHandoff(userId, reason, turnBody, bookingState = null) {
    const now = Date.now();
    const last = handoffCooldowns.get(userId) || 0;
    if (now - last < 10 * 60 * 1000) return;
    handoffCooldowns.set(userId, now);

    let state = bookingState;
    if (!state) {
        try {
            const result = await pool.query(
                'SELECT state FROM "ConversationState" WHERE phone = $1',
                [userId]
            );
            state = result.rows[0]?.state || {};
        } catch (error) {
            console.error('[HANDOFF STATE ERROR]', error.message);
            state = {};
        }
    }

    const slots = state.slots || {};
    const rawPhone = slots.phone || state.clientContactPhone || userId;
    const moroccanPhone = getMoroccanPhone(rawPhone);
    const normalizedPhone = normalizePhone(rawPhone);
    const displayPhone = moroccanPhone || (normalizedPhone ? `+${normalizedPhone}` : 'Non renseigné');
    const clientName = slots.name || state.clientName || 'Non renseigné';
    const address = slots.address || state.clientAddress || 'Non renseignée';
    const problem = slots.symptom || state.problemReported || state.type || state.intent || turnBody || reason || 'À préciser';
    const ticket = `🚨 NOUVELLE INTERVENTION ASSIGNÉE (V2) 🚨

👤 Client: ${clientName}
📍 Adresse: ${address}
📞 Téléphone: ${displayPhone}
🔧 Problème/Type: ${problem}

Merci de contacter le client pour confirmer l'heure de visite.`;

    for (const admin of TEAM_NUMBERS) {
        try {
            const adminPhone = normalizePhone(admin);
            if (!/^212[5-7]\d{8}$/.test(adminPhone)) {
                throw new Error('ADMIN_NUMBERS must contain a Moroccan phone number, not a WhatsApp/LID identifier');
            }
            const adminId = await client.getNumberId(adminPhone);
            if (!adminId?._serialized) throw new Error('Configured admin number is not registered on WhatsApp');
            await client.sendMessage(adminId._serialized, BOT_WATERMARK + ticket);
        } catch (error) {
            console.error(`[HANDOFF NOTIFICATION ERROR] ${admin}:`, error.message);
        }
    }

    // Confirmed appointments are already written by createConfirmedBooking(); avoid
    // creating a duplicate when notifyHandoff is used because no technician was found.
    if (state.reference) return;

    let dbClient;
    try {
        if (clientName === 'Non renseigné' || address === 'Non renseignée') {
            console.warn(`[HANDOFF DB SKIPPED] Missing client name/address for ${userId}`);
            return;
        }

        const syncHash = crypto.createHash('sha256').update(JSON.stringify([
            'handoff', userId, clientName, address, displayPhone, problem,
            slots.day || state.day || null,
            slots.time_window_or_hour || state.time_window || null,
        ])).digest('hex');
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');
        const reservation = await dbClient.query(
            `INSERT INTO "InterventionSync" (hash, "createdAt") VALUES ($1, NOW())
             ON CONFLICT (hash) DO NOTHING RETURNING hash`,
            [syncHash]
        );
        if (reservation.rowCount === 0) {
            await dbClient.query('COMMIT');
            return;
        }

        const dateParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(new Date()).reduce((parts, item) => {
            if (item.type !== 'literal') parts[item.type] = item.value;
            return parts;
        }, {});
        const reference = `INT-${dateParts.year}${dateParts.month}${dateParts.day}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        const day = slots.day || state.day || null;
        const timeWindow = slots.time_window_or_hour || state.time_window || null;
        const startTime = [day, timeWindow].filter(Boolean).join(' ') || null;
        const intent = state.intent || reason || 'human_handoff';
        const serviceType = slots.service_type || state.type || intent;

        await dbClient.query(
            `INSERT INTO "Intervention" (
                id, reference, "clientName", "clientContactName", "clientAddress", "clientContactPhone",
                "technicianName", type, "startTime", "problemReported", status, intent, symptom,
                day, time_window, "syncHash", "createdAt", "updatedAt"
            ) VALUES (
                $1, $2, $3, $3, $4, $5, 'A assigner (Bot)', $6, $7, $8,
                'PLANIFIEE', $9, $10, $11, $12, $13, NOW(), NOW()
            )`,
            [
                crypto.randomUUID(), reference, clientName, address, displayPhone,
                String(serviceType), startTime, String(problem), String(intent),
                slots.symptom || state.symptom || null, day, timeWindow, syncHash,
            ]
        );
        await dbClient.query('COMMIT');
        console.log(`[HANDOFF DB SAVED] ${reference} for ${userId}`);
    } catch (error) {
        try { await dbClient?.query('ROLLBACK'); } catch (_) {}
        console.error('[HANDOFF DB INSERT ERROR]', error.message);
    } finally {
        dbClient?.release();
    }
}

const lastMediaReply = new Map();

client.on("message", async (msg) => {
  if (msg.from === "status@broadcast" || msg.from.includes("@g.us")) return;

  // Acknowledge media immediately. Never download it or pass it to the LLM.
  if (msg.hasMedia || ["image", "video", "audio", "ptt"].includes(msg.type)) {
    try {
      await msg.reply(BOT_WATERMARK + MEDIA_AUTO_REPLY);
    } catch (error) {
      console.error("[MEDIA AUTO-REPLY ERROR]", error.message);
    }
    return;
  }

  let rawPhone = getRawPhone(msg.from);
  try {
    const contact = await msg.getContact();
    if (contact && contact.number) rawPhone = contact.number;
  } catch (e) {}
  const userId = normalizePhoneWithSuffix(rawPhone);

  // ---------------------------------------------------------
  // Deduplication guard
  // ---------------------------------------------------------
  if (msg.id && msg.id.id) {
    try {
      let isDuplicate = false;
      const res = await pool.query(
        `INSERT INTO "ProcessedMessage" (id, status, "createdAt") VALUES ($1, 'PROCESSING', NOW()) ON CONFLICT (id) DO NOTHING RETURNING id`,
        [msg.id.id]
      );
      if (res.rowCount === 0) {
        const check = await pool.query(`SELECT status, "createdAt" FROM "ProcessedMessage" WHERE id = $1`, [msg.id.id]);
        if (check.rows.length > 0) {
          const row = check.rows[0];
          if (row.status === 'COMPLETED') {
            isDuplicate = true;
          } else if (row.status === 'PROCESSING') {
            const age = Date.now() - new Date(row.createdAt).getTime();
            if (age > 5 * 60 * 1000) {
              await pool.query(`UPDATE "ProcessedMessage" SET "createdAt" = NOW() WHERE id = $1`, [msg.id.id]);
            } else {
              isDuplicate = true;
            }
          }
        }
      }
      if (isDuplicate) {
        console.log(`[DUPLICATE DROP] Message ${msg.id.id} already processed or processing.`);
        return;
      }
      
      if (!activeMessageIds.has(userId)) activeMessageIds.set(userId, []);
      activeMessageIds.get(userId).push(msg.id.id);
    } catch (e) {
      console.error("Duplicate DB error:", e.message);
    }
  }

  let body = msg.body?.trim() || "";
  if (!pendingBodies.has(userId)) pendingBodies.set(userId, []);
  
  // Dynamic admin login
  const expectedPassword = CONFIG.adminPassword;
  if (body.toLowerCase() === `/login ${expectedPassword}`.toLowerCase()) {
    if (!TEAM_NUMBERS.includes(rawPhone)) {
      TEAM_NUMBERS.push(rawPhone);
      try {
        await pool.query(
          `INSERT INTO "BotAdmin" (phone, "createdAt") VALUES ($1, NOW()) ON CONFLICT (phone) DO NOTHING`,
          [rawPhone]
        );
      } catch (err) {
        console.error("Failed to persist admin to DB:", err.message);
      }
      try {
        await fs.promises.writeFile("admins.json", JSON.stringify(TEAM_NUMBERS), "utf8");
      } catch (_) {}
      await msg.reply(
        BOT_WATERMARK +
          "✅ Vous êtes maintenant connecté en tant qu'admin DK Clim."
      );
    } else {
      await msg.reply(BOT_WATERMARK + "✅ Vous êtes déjà admin.");
    }
    return;
  }

  // Emergency commands (Admins only)
  const isAdmin = TEAM_NUMBERS.includes(rawPhone);

  if (body.toLowerCase() === "/resetall") {
    if (isAdmin) {
      try {
        await pool.query(`UPDATE "LeadStatus" SET is_bot_active = true`);
        await msg.reply(
          BOT_WATERMARK +
            "✅ URGENCE : Tous les clients de la base de données ont été réactivés (is_bot_active = true)."
        );
      } catch (e) {
        await msg.reply(BOT_WATERMARK + "❌ Erreur: " + e.message);
      }
    }
    return;
  }

  if (body.toLowerCase() === "/purge") {
    if (isAdmin) {
      try {
        await pool.query(
          `UPDATE "LeadStatus" SET reminder_count = 1, last_reminder_at = NOW() WHERE status IN ('NEW', 'FOLLOW_UP')`
        );
        await msg.reply(
          BOT_WATERMARK +
            "✅ PURGE EFFECTUÉE : Tous les anciens clients sont exclus des futures relances (reminder_count = 1)."
        );
      } catch (e) {
        await msg.reply(BOT_WATERMARK + "❌ Erreur: " + e.message);
      }
    }
    return;
  }

  // Audio / voice handler
  if (msg.type === "ptt" || msg.type === "audio") {
    await pushMessage(userId, "user", "[Message Audio/Vocal]");
    try {
      await pool.query(
        `UPDATE "LeadStatus" SET reminder_count = 0, last_reminder_at = NULL WHERE phone = $1`,
        [userId]
      );
    } catch (_) {}
    await msg.reply(
      BOT_WATERMARK + "🎤 Merci pour votre message vocal. Pour mieux vous aider, merci de m'écrire votre demande en quelques mots (ex: panne clim, adresse, disponibilité)."
    );
    return;
  }

  // Media handler
  if (msg.hasMedia) {
    if (!body) {
      await pushMessage(userId, "user", "[Media file sans texte]");
      try {
        await pool.query(
          `UPDATE "LeadStatus" SET reminder_count = 0, last_reminder_at = NULL WHERE phone = $1`,
          [userId]
        );
      } catch (_) {}
      
      const lastReply = lastMediaReply.get(userId) || 0;
      const now = Date.now();
      if (now - lastReply > 2 * 60 * 1000) {
        lastMediaReply.set(userId, now);
        await msg.reply(
          BOT_WATERMARK + "📸 Merci pour la photo/vidéo. Pouvez-vous préciser votre nom, adresse et la panne observée pour que je puisse créer votre intervention ?"
        );
      }
      return;
    } else {
      body = `[SYSTEM: L'utilisateur a envoyé une image/vidéo avec ce texte. Tu ne peux pas voir l'image. Ignore l'image et réponds UNIQUEMENT au texte de l'utilisateur.] ${body}`;
    }
  }

  if (body.length > 1000) {
    body = body.substring(0, 1000) + "... (message tronqué)";
  }

  if (!body.trim()) return;

  // Admin dynamic learning & control
  if (isAdmin) {
    if (body.toLowerCase() === "/clearrules" || body.toLowerCase() === "clear") {
      await pool.query('DELETE FROM "BotRule"');
      await msg.reply(
        BOT_WATERMARK +
          "✅ Toutes les règles dynamiques ont été supprimées."
      );
      return;
    }

    if (body.toLowerCase().startsWith("/mute")) {
      const parts = body.split(" ");
      if (parts.length < 2 || !parts[1].trim()) {
        await msg.reply(
          BOT_WATERMARK + "⚠️ Usage: /mute <numéro> ex: /mute 0612345678"
        );
        return;
      }
      const targetPhone = normalizePhoneWithSuffix(parts[1].trim());
      await setBotActive(targetPhone, false);
      await msg.reply(BOT_WATERMARK + `✅ Bot muted for ${targetPhone}`);
      return;
    }

    if (body.toLowerCase().startsWith("/unmute")) {
      const parts = body.split(" ");
      if (parts.length < 2 || !parts[1].trim()) {
        await msg.reply(
          BOT_WATERMARK + "⚠️ Usage: /unmute <numéro> ex: /unmute 0612345678"
        );
        return;
      }
      const targetPhone = normalizePhoneWithSuffix(parts[1].trim());
      await setBotActive(targetPhone, true);
      await msg.reply(BOT_WATERMARK + `✅ Bot unmuted for ${targetPhone}`);
      return;
    }

    const lowerBody = body.toLowerCase();
    if (
      lowerBody.startsWith("add rule:") ||
      lowerBody.startsWith("rule:") ||
      lowerBody.startsWith("nouvelle regle:")
    ) {
      const actualRule = body.substring(body.indexOf(":") + 1).trim();
      try {
        await pool.query(
          'INSERT INTO "BotRule" (id, rule, "createdAt") VALUES (gen_random_uuid()::text, $1, NOW())',
          [actualRule]
        );
        await msg.reply(
          BOT_WATERMARK +
            `✅ Règle ajoutée: "${actualRule}"`
        );
      } catch (e) {
        console.error("Failed to save rule:", e.message);
        await msg.reply(BOT_WATERMARK + "❌ Erreur lors de l'ajout de la règle.");
      }
      return;
    }
  }

  console.log(`\n[IN]  ${userId}: "${body.slice(0, 80)}"`);

  try {
    await pushMessage(userId, "user", body);

    try {
      await pool.query(
        `UPDATE "LeadStatus" SET reminder_count = 0, last_reminder_at = NULL WHERE phone = $1`,
        [userId]
      );
    } catch (e) {
      console.error("Reset reminder error:", e.message);
    }

    const isBotActive = await getBotActive(userId);
    if (!isBotActive) {
      console.log(
        `[MUTED] Ignored message from ${userId} because they are HUMAN_HANDLED.`
      );
      return;
    }

    if (!pendingBodies.has(userId)) pendingBodies.set(userId, []);
    pendingBodies.get(userId).push(body);

    if (debounceTimers.has(userId)) {
      clearTimeout(debounceTimers.get(userId));
    } else {
      msg.getChat().then(chat => chat.sendStateTyping()).catch(()=>{});
    }

    const processMessageQueue = async () => {
      if (isProcessing.get(userId)) {
        debounceTimers.set(
          userId,
          setTimeout(processMessageQueue, CONFIG.debounceDelay)
        );
        return;
      }

      try {
        debounceTimers.delete(userId);
        isProcessing.set(userId, true);

        const rawUserId = getRawPhone(userId);
        const isTeamMember = TEAM_NUMBERS.includes(rawUserId);

        // Defense in depth: an admin may have taken over during the debounce window.
        if (!(await getBotActive(userId))) {
          console.log(`[RACE-GUARD] Bot muted before LLM call. Aborting for ${userId}`);
          return;
        }

        // Session age is computed inside Postgres (NOW() vs a value stored with NOW())
        // so Node/DB timezone differences on the TIMESTAMP column cannot skew the TTL.
        const SESSION_TTL_SECONDS = 3 * 60 * 60;
        let sessionAgeSeconds = 0;
        try {
          const ageRes = await pool.query(
            'SELECT EXTRACT(EPOCH FROM (NOW() - "updatedAt")) AS age FROM "ConversationState" WHERE phone = $1',
            [userId]
          );
          if (ageRes.rows.length > 0) sessionAgeSeconds = Number(ageRes.rows[0].age) || 0;
        } catch (_) {}
        const sessionExpired = sessionAgeSeconds > SESSION_TTL_SECONDS;

        // Closed deals stay silent, unless the customer comes back after the session TTL.
        if (!isTeamMember) {
          const currentDbStatus = await getLeadStatus(userId);
          if (currentDbStatus === "CLOSED") {
            if (!sessionExpired) return;
            await setLeadStatus(userId, "NEW");
          }
        }

        let chat = null;
        try {
          chat = await msg.getChat();
          await chat.sendStateTyping();
        } catch (e) {
          console.warn("[TYPING WARN] Could not send typing state:", e ? e.message : 'Unknown');
        }

        let convState = {
            intent: null,
            stage: "INITIAL",
            slots: { phone: getMoroccanPhone(rawPhone) },
            flags: {},
            last_bot_text: null,
            last_bot_question_slot: null
        };
        try {
            const stateRes = await pool.query('SELECT state, "updatedAt" FROM "ConversationState" WHERE phone = $1', [userId]);
            if (stateRes.rows.length > 0) {
                const savedState = stateRes.rows[0].state;
                const updatedAt = new Date(stateRes.rows[0].updatedAt).getTime();
                if (Date.now() - updatedAt > 3 * 60 * 60 * 1000) {
                    console.log(`[SESSION TIMEOUT] 3 hours passed. Resetting state and history for ${userId}.`);
                    await pool.query('DELETE FROM "BotMessage" WHERE phone = $1', [userId]);
                } else {
                    convState = savedState || convState;
                }
            }
        } catch(e) {
            await pool.query('CREATE TABLE IF NOT EXISTS "ConversationState" (phone VARCHAR(50) PRIMARY KEY, state JSONB, "updatedAt" TIMESTAMP DEFAULT NOW())').catch(()=>{});
        }

        convState.slots ||= {};
        const validatedSavedPhone = getMoroccanPhone(convState.slots.phone);
        const validatedWhatsAppPhone = getMoroccanPhone(rawPhone);
        if (validatedSavedPhone) convState.slots.phone = validatedSavedPhone;
        else if (validatedWhatsAppPhone) convState.slots.phone = validatedWhatsAppPhone;
        else delete convState.slots.phone;

        
        const allBodies = pendingBodies.get(userId) || [];
        const joinedBody = allBodies.join('\n');
        pendingBodies.delete(userId);
        
        if (!joinedBody.trim() && !activeMessageIds.get(userId)) return;

        const history = await getHistory(userId);
        
        // --- V2 CONVERSATION ENGINE ---
        const { runTurn } = require('./lib/v2/engine');
        const { askAI } = require('./src/services/llm');
        
        const v2Llm = async (prompt, opts = {}) => {
            const messages = [];
            if (opts.system) messages.push({ role: "system", content: opts.system });
            messages.push({ role: "user", content: prompt });
            return askAI(messages, 800, 3, opts);
          };

        const lastMessageId = (activeMessageIds.get(userId) || []).at(-1);
        const saleIdempotencyKey = lastMessageId
          ? crypto.createHash('sha256').update(`${userId}:${lastMessageId}`).digest('hex')
          : null;
        const v2Result = await runTurn(v2Llm, convState, joinedBody, history, BUSINESS_RULES_TEXT, { saleIdempotencyKey });
        
        

        let reply = v2Result.reply;

        if (v2Result.isAppointmentConfirmed) {
          const bookingResult = await notifyAdminV2(userId, v2Result.newState.slots, v2Result.newState.intent);
          if (!bookingResult.ok) {
            v2Result.nextAction = { type: 'handoff', reason: 'intervention_save_failed', slots: [] };
            v2Result.newState.stage = 'HANDOFF';
            reply = render(v2Result.newState, v2Result.nextAction);
          }
        }

        if (v2Result.saleResult?.ok) {
          console.log(`[SALE LOGGED] ${v2Result.newState.slots.brand} ${v2Result.newState.slots.btu} (${v2Result.saleResult.status})`);
          if (v2Result.newState.slots.install_mode === 'purchase_with_installation') {
            const installationSlots = {
              ...v2Result.newState.slots,
              symptom: `Installation du climatiseur ${v2Result.newState.slots.brand} ${v2Result.newState.slots.btu}`,
            };
            const installationResult = await notifyAdminV2(userId, installationSlots, 'installation');
            if (installationResult.ok) {
              const installConfirmation = v2Result.newState.language === 'fr'
                ? " Votre demande d’installation a aussi été transmise à notre équipe."
                : v2Result.newState.language === 'ar-script'
                  ? " كما أرسلنا طلب التركيب إلى فريقنا."
                  : " W talab tarkib tsift l'équipe dyalna bach yns9o m3ak.";
              reply += installConfirmation;
            } else {
              console.error('[PURCHASE INSTALLATION NOT SAVED]', installationResult.reason || installationResult.error || 'unknown');
              reply = render(v2Result.newState, { type: 'handoff', reason: 'installation_booking_failed', slots: [] });
              v2Result.nextAction = { type: 'handoff', reason: 'installation_booking_failed', slots: [] };
              v2Result.newState.stage = 'HANDOFF';
            }
          }
        }

                if (!reply || reply.trim() === "") {
          if (v2Result.nextAction?.type === 'silent') {
              console.error("[EMPTY-GUARD] AI returned an empty message (silent action). Discarding.");
              return;
          } else {
              console.error("[EMPTY-GUARD] AI returned empty on a non-silent action. Falling back to default greeting.");
              reply = "Salam, marhaba bik f DK Clim ! Kifach n9der n3awnek lyouma? (Réparation, Entretien, Installation, Achat)";
          }
        }

        const stillActive = await getBotActive(userId);
        if (!stillActive) {
          console.log(`[RACE-GUARD] Admin replied during AI generation. Discarding bot reply for ${userId}`);
          return;
        }

        await pushMessage(userId, "assistant", reply);

        if (v2Result.nextAction?.type === 'handoff' || v2Result.newState.stage === 'HANDOFF') {
             await setLeadStatus(userId, "HANDED_OFF_TO_APPOINTMENT");
        } else if (v2Result.newState.stage === 'CLOSED') {
             await setLeadStatus(userId, "CLOSED");
        } else {
             await setLeadStatus(userId, "NEW");
        }

        if (chat) {
          try { await chat.clearState(); } catch (_) {}
        }

        try {
          await msg.reply(BOT_WATERMARK + reply);
        } catch (replyErr) {
          await client.sendMessage(userId, BOT_WATERMARK + reply);
        }

        console.log(`[OUT] ${reply.slice(0, 100)}`);
        try { await pool.query('INSERT INTO "ConversationState" (phone, state, "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT (phone) DO UPDATE SET state = EXCLUDED.state, "updatedAt" = NOW()', [userId, v2Result.newState]); } catch (e) {}
        
        if (v2Result.nextAction?.type === 'handoff') {
            notifyHandoff(userId, v2Result.nextAction.reason, joinedBody, v2Result.newState).catch(error => {
                console.error('[HANDOFF NOTIFICATION ERROR]', error.message);
            });
        }

      } catch (innerErr) {
        console.error("[AI DEBOUNCE ERR]", innerErr.message);
      } finally {
          isProcessing.delete(userId);
          const processedIds = activeMessageIds.get(userId) || [];
          if (processedIds.length > 0) {
              try {
                  await pool.query(`UPDATE "ProcessedMessage" SET status = 'COMPLETED' WHERE id = ANY($1)`, [processedIds]);
              } catch(e) { console.error("Failed to mark completed:", e.message); }
              activeMessageIds.delete(userId);
          }
        }
    };

    debounceTimers.set(
      userId,
      setTimeout(processMessageQueue, CONFIG.debounceDelay)
    );
  } catch (err) {
    console.error("[MSG ERR]", err.message);
  }
});

// ---------------------------------------------------------
// Disconnect & Error Handling
// ---------------------------------------------------------
client.on("disconnected", (reason) => {
  console.error("[DISCONNECTED]", reason, "");
  if (reason === "LOGOUT") {
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

// ---------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------
const shutdown = async () => {
  console.log("\n[SHUTDOWN] Closing database and WhatsApp client safely...");
  try {
    await pool.end();
    await client.destroy();
  } catch (e) {
    console.error("Shutdown Error:", e.message);
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("uncaughtException", (err) => {
  const msg = err.message || "";
  if (msg.includes("EBUSY") && msg.includes("lockfile")) return;
  console.error("[UNCAUGHT]", msg);
  if (
    msg.includes("Execution context was destroyed") ||
    msg.includes("TargetCloseError")
  ) {
    console.log("Puppeteer context lost - restarting");
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (msg.includes("EBUSY") && msg.includes("lockfile")) return;
  if (msg.includes("getAlternateUserWid")) return;
  console.error("[UNHANDLED REJECTION]", msg);
});

// ---------------------------------------------------------
// Boot
// ---------------------------------------------------------
(async () => {
  await initDB();
  client.initialize().catch((error) => console.error('[WA INIT ERROR]', error.message));
})();

module.exports = { pool };
