if (!process.env.ADMIN_PASSWORD) { console.warn('WARNING: ADMIN_PASSWORD not set. Using default fallback password.'); }
ï»¿"use strict";
require('dotenv').config();

process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message && reason.message.includes('Execution context was destroyed')) {
        console.warn('[PUPPETEER WARNING] Execution context destroyed. Ignoring to prevent crash.');
        return;
    }
    console.error('[UNHANDLED REJECTION]', reason);
});


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Dependencies
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const { Client, LocalAuth } = require("whatsapp-web.js");
const Groq = require("groq-sdk");
const axios = require("axios");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");
const { Pool } = require("pg");

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Constants & Configuration
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BOT_WATERMARK = "\u200B";

// Phone Normalization Utilities
function normalizePhone(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.startsWith("00212")) cleaned = "212" + cleaned.slice(5);
  else if (cleaned.startsWith("0") && cleaned.length === 10)
    cleaned = "212" + cleaned.slice(1);
  else if (!cleaned.startsWith("212") && cleaned.length === 9)
    cleaned = "212" + cleaned;
  return cleaned + "@c.us";
}

function getRawPhone(phoneOrId) {
  if (!phoneOrId) return "";
  const phone = String(phoneOrId).split("@")[0];
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("00212")) cleaned = "212" + cleaned.slice(5);
  else if (cleaned.startsWith("0") && cleaned.length === 10)
    cleaned = "212" + cleaned.slice(1);
  else if (!cleaned.startsWith("212") && cleaned.length === 9)
    cleaned = "212" + cleaned;
  return cleaned;
}

const DEFAULT_ADMINS = (
  process.env.ADMIN_NUMBERS
    ? process.env.ADMIN_NUMBERS.split(",")
    : ["212669247744", "212619401129", "280998453498053"]
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
  adminPassword: process.env.ADMIN_PASSWORD || 'dkclim2026',
  debounceDelay: 7000,
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Startup: remove stale Chrome lockfile
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LOCKFILE = path.join(__dirname, ".wwebjs_auth", "session", "lockfile");
try {
  if (fs.existsSync(LOCKFILE)) {
    fs.rmSync(LOCKFILE, { force: true });
    console.log("ðŸ§¹ Stale lockfile removed");
  }
} catch (_) {
  /* ignore */
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Database Connection & Error Handling
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const dbConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: dbConnectionString,
  ssl:
    dbConnectionString &&
    (dbConnectionString.includes("sslmode=require") ||
      process.env.NODE_ENV === "production")
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on("error", (err) => {
  console.error("[PG POOL ERROR]", err.message);
});

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
      CREATE TABLE IF NOT EXISTS "Inventory" (
        id SERIAL PRIMARY KEY,
        brand VARCHAR(50),
        btu VARCHAR(50),
        stock_quantity INT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "SalesLog" (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT NOW(),
        brand VARCHAR(50),
        btu VARCHAR(50),
        customer_name VARCHAR(100),
        customer_phone VARCHAR(50),
        status VARCHAR(20) DEFAULT 'PENDING'
      );
    `);
    
    const invCheck = await pool.query('SELECT COUNT(*) FROM "Inventory"');
    if (parseInt(invCheck.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO "Inventory" (brand, btu, stock_quantity) VALUES
        ('Carrier', '12000_BTU', 10),
        ('Carrier', '9000_BTU', 15),
        ('CIAT', '9000_BTU', 5),
        ('CIAT', '12000_BTU', 5),
        ('Daikool', '12000_BTU', 8),
        ('Daikool', '9000_BTU', 8),
        ('TCL', '9000_BTU', 10),
        ('TCL', '12000_BTU', 10)
      `);
      console.log('[DB] Seeded mock inventory.');
    }

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
      `âœ… DB schema verified and initialized. Active admins: ${TEAM_NUMBERS.length}`
    );
  } catch (e) {
    console.error("DB Init Error:", e.message);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HTTP Server (Unified Router)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const QR_HTML_PATH = "qr.html";

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${CONFIG.qrPort}`);
  const pathname = url.pathname;

  // â”€â”€ GET /version â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (req.method === "GET" && pathname === "/version") {
    const authHeader =
      req.headers["authorization"] || url.searchParams.get("token");
    if (
      authHeader !== CONFIG.notifyToken &&
      authHeader !== `Bearer ${CONFIG.notifyToken}`
    ) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Non autorisÃ©" }));
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

  // â”€â”€ POST /notify â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          res.end(JSON.stringify({ success: false, error: "Non autorisÃ©" }));
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

        const waId = normalizePhone(phone);
        if (!waId || waId.length <= 5 || !waId.endsWith("@c.us")) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: false,
              error: "NumÃ©ro de tÃ©lÃ©phone invalide",
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
          if (arr.length > 0) workList = arr.map((w) => `  âœ” ${w}`).join("\n");
        } catch {
          workList = workDone || "";
        }
        if (workDoneOther) workList += `\n  âœ” ${workDoneOther}`;

        const conformite = finalStatus ? "âœ… Conforme" : "âš ï¸ Non conforme";
        const horaires =
          startTime && endTime ? `${startTime} â†’ ${endTime}` : "";

        const message = [
          `ðŸŽ‰ *Ù…Ø±Ø­Ø¨Ø§Ù‹ ${clientName || ""}!*`,
          "",
          `ØªÙ…Øª Ø®Ø¯Ù…ØªÙƒÙ… Ø¨Ù†Ø¬Ø§Ø­ Ù…Ù† Ø·Ø±Ù ÙØ±ÙŠÙ‚ *DK Climatisation* ðŸ†`,
          "",
          `ðŸ“‹ *RÃ©fÃ©rence* : ${reference}`,
          `ðŸ”§ *Type*       : ${type || "-"}`,
          `ðŸ‘· *Technicien* : ${technicianName || "-"}`,
          horaires ? `ðŸ• *Horaires*   : ${horaires}` : "",
          workList ? `\nðŸ›  *Travaux effectuÃ©s :*\n${workList}` : "",
          materialsUsed ? `\nðŸ“¦ *MatÃ©riaux* : ${materialsUsed}` : "",
          observations ? `\nðŸ“ *Observations* : ${observations}` : "",
          `\nâ­ *Statut final* : ${conformite}`,
          "",
          `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`,
          `Ø´ÙƒØ±Ø§Ù‹ Ù„Ø«Ù‚ØªÙƒÙ… ÙÙŠ DK Clim ðŸ™`,
          `Ù„Ø£ÙŠ Ø³Ø¤Ø§Ù„ Ø£Ùˆ Ø§Ø³ØªÙØ³Ø§Ø±: 0612540085`,
        ]
          .filter((l) => l !== "")
          .join("\n");

        setImmediate(async () => {
          try {
            await client.sendMessage(waId, BOT_WATERMARK + message);
            console.log(`âœ… [NOTIFY] Sent to ${waId} for ${reference}`);
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

  // â”€â”€ GET / â†’ QR page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  fs.readFile(QR_HTML_PATH, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("QR not generated yet â€“ please wait...");
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
  console.log(
    `ðŸŒ  HTTP server â†’ http://localhost:${CONFIG.qrPort}  (QR + /notify)`
  );
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// System Prompt (DK Clim Commercial Agent)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Database Helpers & Repositories
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  const isConditional =
    /(Ù…Ù†ÙŠÙ† ØªÙˆØµÙ„Ù†Ø§|Ù…Ù† Ø¨Ø¹Ø¯ Ù…Ø§ ØªÙˆØµÙ„Ù†Ø§|once we have|dÃ¨s que nous aurons reÃ§u|si vous souhaitez.*transmettre|Ø¨Ø§Ø´ Ù†Ù‚Ø¯Ø±.*Ù†Ø´ÙˆÙÙˆ|pour que nous puissions.*transmettre)/i.test(
      text
    );

  const appointmentRegex =
    /(nous allons v[Ã©Ã¨e]rifier.*service rendez-vous|transmis.*service rendez-vous|transmettre.*service rendez-vous|demande a .t. transmise.*rendez-vous|ØºØ§Ø¯ÙŠ Ù†Ø´ÙˆÙÙˆ Ù…Ø¹ Ù‚Ø³Ù… Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯|ØªÙ… ØªØ­ÙˆÙŠÙ„.*Ù‚Ø³Ù… Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯|Ù†Ø£ÙƒØ¯Ùˆ Ù…Ø¹Ø§Ùƒ Ø£Ù‚Ø±Ø¨ Ù…ÙˆØ¹Ø¯|Ù†Ø¯ÙˆØ²ÙˆÙ‡Ù… Ù„Ù‚Ø³Ù… Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯|Ù†ØµÙŠÙØ·.*Ù‚Ø³Ù… Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯|ØªØ³Ø¬Ù„Ùˆ.*Ù‚Ø³Ù… Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯|ØªØ³Ø¬Ù„Ø§Øª.*Ù‚Ø³Ù… Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯|service rendez-vous)/i;

  const commercialRegex =
    /(transmis.*service commercial|transf.rer.*service commercial|demande a .t. transmise.*commercial|ØªÙ… ØªØ­ÙˆÙŠÙ„.*Ù…ØµÙ„Ø­Ø© Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª|ØªÙ… Ø¥Ø±Ø³Ø§Ù„.*Ù…ØµÙ„Ø­Ø© Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª)/i;

  if (appointmentRegex.test(text) && !isConditional) {
    return "HANDED_OFF_TO_APPOINTMENT";
  }
  if (commercialRegex.test(text) && !isConditional) {
    return "HANDED_OFF_TO_COMMERCIAL";
  }

  return null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Admin Dashboard Sync (DK Clim Next.js App)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.log("âŒ [VALIDATION FAILED] Missing phone or time. Intervention aborted.");
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
      console.log("âŒ [VALIDATION FAILED] Duplicate intervention detected deterministically. Aborting.");
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
    technicianName: assignedTech ? assignedTech.name : "Ã€ assigner (Bot)",
  };

  console.log("\nðŸŽ¯ [BOOKING DETECTED]", payload);

  try {
    const res = await axios.post(CONFIG.adminWebhookUrl, payload, {
      headers: {
        Authorization: `Bearer ${CONFIG.notifyToken}`,
        "Content-Type": "application/json",
      },
      timeout: 6000,
    });
    if (res.data?.success) {
      
      console.log("âœ… [ADMIN SYNC] Intervention:", res.data.data?.reference);

      if (assignedTech && assignedTech.phone) {
        const techChatId = normalizePhone(assignedTech.phone);
        let timeSuffix = `_Merci de contacter le client pour confirmer l'heure de visite._`;
        if (payload.proposedTime) {
          timeSuffix = `ðŸ• *CrÃ©neau proposÃ©:* ${payload.proposedTime} â€” Ã€ CONFIRMER\n\n_Merci de contacter le client pour confirmer la disponibilitÃ© du crÃ©neau._`;
        }

        const notifMsg =
          `ðŸš¨ *NOUVELLE INTERVENTION ASSIGNÃ‰E* ðŸš¨\n\n` +
          `ðŸ‘¤ *Client:* ${payload.clientName}\n` +
          `ðŸ“ *Adresse:* ${payload.clientAddress}\n` +
          `ðŸ“ž *TÃ©lÃ©phone:* ${payload.clientContactPhone}\n` +
          `ðŸ”§ *ProblÃ¨me/Type:* ${payload.problemReported} (${payload.type})\n\n` +
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// WhatsApp Client Setup
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
    qr
  )}`;
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="20">
  <title>DK Clim â€“ Scan QR</title>
  <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#0b1b24;color:#fff}</style>
</head>
<body>
  <h2>ðŸ“± Scannez avec WhatsApp</h2>
  <img src="${imgUrl}" alt="QR Code" width="360">
  <p style="opacity:.6">La page se rafraÃ®chit automatiquement toutes les 20 secondes.</p>
</body>
</html>`;

  fs.writeFileSync(QR_HTML_PATH, html, "utf8");
  console.log("\nðŸ”‘ New QR generated â†’", `http://localhost:${CONFIG.qrPort}`);

  if (!qrBrowserOpened) {
    if (process.platform === "win32" && process.env.NODE_ENV !== "production") {
      try {
        execSync("start qr.html");
      } catch (_) {
        /* ignore */
      }
    }
    qrBrowserOpened = true;
  }
});

client.on("ready", async () => {
  console.log("âœ… WhatsApp Client is READY!");
  qrBrowserOpened = true;
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Dynamic System Prompt (Base + DB Rules)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Message State & Queues
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const debounceTimers = new Map();
const isProcessing = new Map();

client.on("message_create", async (msg) => {
  try {
    if (!msg.fromMe) return;
    // Ignore group messages and broadcast channels
    if (!msg.to || msg.to === "status@broadcast" || msg.to.includes("@g.us")) return;

    let rawPhone = getRawPhone(msg.to);
    try {
      const contact = await client.getContactById(msg.to); // msg.getContact() would return the bot's own account for fromMe messages
      if (contact && contact.number) rawPhone = contact.number;
    } catch (e) {
      console.warn("[WARN] getContact failed in message_create, falling back to msg.to");
    }
    const userId = normalizePhone(rawPhone);
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

async function notifyAdminV2(userId, slots) {
  const payload = {
    clientName: slots.name || "Inconnu",
    clientAddress: slots.address || "Inconnu",
    clientContactPhone: slots.phone || userId,
    proposedTime: slots.day ? `${slots.day} ${slots.time_window_or_hour || ''}` : "N/A",
    problemReported: slots.symptom || "Demande via V2 Bot",
    type: slots.ac_type || "Inconnu",
    technicianName: "Ã€ assigner (V2 Bot)",
  };

  console.log("\nâœ… [V2 BOOKING DETECTED]", payload);
  try {
    const crypto = require('crypto');
    const payloadString = JSON.stringify(payload);
    const secret = process.env.WEBHOOK_SECRET || 'dkclim-dev-secret';
    const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    const res = await axios.post(CONFIG.adminWebhookUrl, payloadString, {
      headers: {
        "x-webhook-signature": signature,
        "Content-Type": "application/json",
      },
      timeout: 6000,
    });
    console.log("ðŸŸ¢ [ADMIN SYNC] Webhook success:", res.data?.data?.reference || "OK");
  } catch (err) {
    console.error("ðŸ”´ [WEBHOOK ERROR]", err.response?.data || err.message);
  }

  let assignedTech = null;
  try {
    const techRes = await pool.query("SELECT name, phone FROM \"Technician\" WHERE phone IS NOT NULL AND phone != ''");
    if (techRes.rows.length > 0) {
      assignedTech = techRes.rows[Math.floor(Math.random() * techRes.rows.length)];
    }
  } catch (e) {}

  if (assignedTech && assignedTech.phone) {
    const techChatId = normalizePhone(assignedTech.phone);
    let timeSuffix = '_Merci de contacter le client pour confirmer l\'heure de visite._';
    if (payload.proposedTime !== "N/A") {
      timeSuffix = `ðŸ•’ *CrÃ©neau proposÃ©:* ${payload.proposedTime} - Ã€ CONFIRMER\n\n_Merci de contacter le client pour confirmer la disponibilitÃ© du crÃ©neau.`;
    }

    const notifMsg =
      'ðŸ› ï¸ *NOUVELLE INTERVENTION ASSIGNÃ‰E (V2)* ðŸ› ï¸\n\n' +
      'ðŸ‘¤ *Client:* ' + payload.clientName + '\n' +
      'ðŸ“ *Adresse:* ' + payload.clientAddress + '\n' +
      'ðŸ“ž *TÃ©lÃ©phone:* ' + payload.clientContactPhone + '\n' +
      'ðŸ”§ *ProblÃ¨me/Type:* ' + payload.problemReported + ' (' + payload.type + ')\n\n' +
      timeSuffix;

    client.sendMessage(techChatId, BOT_WATERMARK + notifMsg).catch((err) => console.error("Failed to notify tech:", err.message));
  }
}

const activeMessageIds = new Map();
const pendingBodies = new Map();
const handoffCooldowns = new Map();

async function notifyHandoff(userId, reason, turnBody) {
    const now = Date.now();
    const last = handoffCooldowns.get(userId) || 0;
    if (now - last < 10 * 60 * 1000) return;
    handoffCooldowns.set(userId, now);
    
    const adminMsg = `?[HANDOFF ALERT]
User: ${userId}
Reason: ${reason}
Last Msg: ${turnBody}`;
    for (const admin of TEAM_NUMBERS) {
        try {
            await client.sendMessage(normalizePhone(admin), adminMsg);
        } catch(e) {}
    }
}

const lastMediaReply = new Map();

client.on("message", async (msg) => {
  if (msg.from === "status@broadcast" || msg.from.includes("@g.us")) return;

  let rawPhone = getRawPhone(msg.from);
  try {
    const contact = await msg.getContact();
    if (contact && contact.number) rawPhone = contact.number;
  } catch (e) {}
  const userId = normalizePhone(rawPhone);

  // ðŸš¨ PERSISTENT DATABASE DUPLICATE PROTECTION ðŸš¨
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
  pendingBodies.get(userId).push(body);

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
        fs.writeFileSync("admins.json", JSON.stringify(TEAM_NUMBERS));
      } catch (_) {}
      await msg.reply(
        BOT_WATERMARK +
          "âœ… ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± ØµØ­ÙŠØ­Ø©! ØªÙ…Øª Ø¥Ø¶Ø§ÙØªÙƒ ÙƒØ£Ø¯Ù…Ù† Ø¨Ù†Ø¬Ø§Ø­. Ø§Ù„Ø¨ÙˆØª Ø¯Ø§Ø¨Ø§ ÙƒÙŠØ¹Ø±ÙÙƒ."
      );
    } else {
      await msg.reply(BOT_WATERMARK + "âœ… Ù†ØªØ§ Ø¯ÙŠØ¬Ø§ Ø±Ø§Ùƒ Ù…Ø³Ø¬Ù„ ÙƒØ£Ø¯Ù…Ù†!");
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
            "âœ… URGENCE : Tous les clients de la base de donnÃ©es ont Ã©tÃ© rÃ©activÃ©s (is_bot_active = true)."
        );
      } catch (e) {
        await msg.reply(BOT_WATERMARK + "âŒ Erreur DB: " + e.message);
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
            "âœ… PURGE EFFECTUÃ‰E : Tous les anciens clients sont exclus des futures relances (reminder_count = 1)."
        );
      } catch (e) {
        await msg.reply(BOT_WATERMARK + "âŒ Erreur DB: " + e.message);
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
      BOT_WATERMARK + "Ù…Ø±Ø­Ø¨Ø§ØŒ Ø´ÙŠ ÙˆØ§Ø­Ø¯ Ù…Ù† Ø§Ù„ÙØ±ÙŠÙ‚ ØºØ§Ø¯ÙŠ ÙŠØ³Ù…Ø¹ Ø§Ù„Ø£ÙˆØ¯ÙŠÙˆ Ø¯ÙŠØ§Ù„Ùƒ ÙˆÙŠØ¬Ø§ÙˆØ¨Ùƒ ÙØ£Ù‚Ø±Ø¨ ÙˆÙ‚Øª.\n\nBonjour, un membre de notre Ã©quipe Ã©coutera votre audio et vous rÃ©pondra dans les plus brefs dÃ©lais."
    );
    return;
  }

  ï»¿// Media handler
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
          BOT_WATERMARK + "Ù…Ø±Ø­Ø¨Ø§ Ø¨ÙƒØŒ Ø³ÙŠÙ‚ÙˆÙ… Ø£Ø­Ø¯ Ø£Ø¹Ø¶Ø§Ø¡ Ø§Ù„ÙØ±ÙŠÙ‚ Ø§Ù„ØªÙ‚Ù†ÙŠ Ø¨Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ù…Ù„ÙØ§Øª ÙˆØ§Ù„Ø±Ø¯ Ø¹Ù„ÙŠÙƒ ÙÙŠ Ø£Ù‚Ø±Ø¨ ÙˆÙ‚Øª.\n\nBonjour, notre Ã©quipe technique examinera ceci et vous rÃ©pondra dans les plus brefs dÃ©lais."
        );
      }
      return;
    } else {
      body = `[SYSTEM: L'utilisateur a envoyÃ© une image/vidÃ©o avec ce texte. Tu ne peux pas voir l'image. Ignore l'image et rÃ©ponds UNIQUEMENT au texte de l'utilisateur.] ${body}`;
    }
  }

  if (body.length > 1000) {
    body = body.substring(0, 1000) + "... (ØªÙ… Ù‚Ø·Ø¹ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ù„Ø£Ù†Ù‡Ø§ Ø·ÙˆÙŠÙ„Ø© Ø¬Ø¯Ø§Ù‹)";
  }

  if (!body.trim()) return;

  // Admin dynamic learning & control
  if (isAdmin) {
    if (body.toLowerCase() === "Ù…Ø³Ø­" || body.toLowerCase() === "clear") {
      await pool.query('DELETE FROM "BotRule"');
      await msg.reply(
        BOT_WATERMARK +
          "âœ… ØªÙ… Ù…Ø³Ø­ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„Ø¥Ø¶Ø§ÙÙŠØ©. Ø§Ù„Ø¨ÙˆØª Ø¯Ø§Ø¨Ø§ Ø±Ø¬Ø¹ Ù„Ù„Ø­Ø§Ù„Ø© Ø§Ù„Ø£ØµÙ„ÙŠØ© Ø¯ÙŠØ§Ù„Ùˆ."
      );
      return;
    }

    if (body.toLowerCase().startsWith("/mute")) {
      const parts = body.split(" ");
      if (parts.length < 2 || !parts[1].trim()) {
        await msg.reply(
          BOT_WATERMARK + "âŒ Format invalide. Utilisez /mute <numero>"
        );
        return;
      }
      const targetPhone = normalizePhone(parts[1].trim());
      await setBotActive(targetPhone, false);
      await msg.reply(BOT_WATERMARK + `âœ… Bot muted for ${targetPhone}`);
      return;
    }

    if (body.toLowerCase().startsWith("/unmute")) {
      const parts = body.split(" ");
      if (parts.length < 2 || !parts[1].trim()) {
        await msg.reply(
          BOT_WATERMARK + "âŒ Format invalide. Utilisez /unmute <numero>"
        );
        return;
      }
      const targetPhone = normalizePhone(parts[1].trim());
      await setBotActive(targetPhone, true);
      await msg.reply(BOT_WATERMARK + `âœ… Bot unmuted for ${targetPhone}`);
      return;
    }

    const lowerBody = body.toLowerCase();
    if (
      lowerBody.startsWith("Ù‚Ø§Ø¹Ø¯Ø©:") ||
      lowerBody.startsWith("rule:") ||
      lowerBody.startsWith("ØªØ¹Ù„Ù…:")
    ) {
      const actualRule = body.substring(body.indexOf(":") + 1).trim();
      try {
        await pool.query(
          'INSERT INTO "BotRule" (id, rule, "createdAt") VALUES (gen_random_uuid()::text, $1, NOW())',
          [actualRule]
        );
        await msg.reply(
          BOT_WATERMARK +
            'âœ… Ø­ÙØ¸Øª Ù‡Ø§Ø¯ Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø©! Ø§Ù„Ø¨ÙˆØª ØºØ§Ø¯ÙŠ ÙŠÙˆÙ„ÙŠ ÙŠØ·Ø¨Ù‚Ù‡Ø§ Ù…Ø¹ Ø£ÙŠ ÙƒÙ„ÙŠØ§Ù† Ø¬Ø¯ÙŠØ¯ Ù…Ù† Ø¯Ø§Ø¨Ø§ Ø§Ù„ÙÙˆÙ‚.\n\n_(Ø¨Ø§Ø´ ØªÙ…Ø³Ø­ ÙƒØ§Ø¹ Ø§Ù„Ù‚ÙˆØ§Ø¹Ø¯ØŒ ØµÙŠÙØ· Ù„ÙŠØ§ ÙƒÙ„Ù…Ø© "Ù…Ø³Ø­")_'
        );
      } catch (e) {
        console.error("Failed to save rule:", e.message);
        await msg.reply(BOT_WATERMARK + "âŒ ÙˆÙ‚Ø¹ Ø´ÙŠ Ø®Ø·Ø£ ÙÙ€ Ø§Ù„Ø³ÙŠØ±ÙØ±.");
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
            slots: {},
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

        
        const allBodies = pendingBodies.get(userId) || [];
        const joinedBody = allBodies.join('\n');
        pendingBodies.delete(userId);
        
        if (!joinedBody.trim() && !activeMessageIds.get(userId)) return;

        const history = await getHistory(userId);
        
        // --- V2 CONVERSATION ENGINE ---
        const { runTurn } = require('./lib/v2/engine');
        const { askAI } = require('./src/services/llm');
        
        let businessRulesText = "";
        try {
          const bRules = require('./src/config/business.json');
          businessRulesText = JSON.stringify(bRules, null, 2);
        } catch(e) {}

        const v2Llm = async (prompt, opts = {}) => {
            const text = await askAI([{ role: "user", content: prompt }], 800, 3, opts);
            return { text, tokens: Math.round(prompt.length / 4) + Math.round(String(text).length / 4) };
          };

        const v2Result = await runTurn(v2Llm, convState, joinedBody, history, businessRulesText);
        
        try {
            await pool.query('INSERT INTO "ConversationState" (phone, state, "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT (phone) DO UPDATE SET state = EXCLUDED.state, "updatedAt" = NOW()', [userId, v2Result.newState]);
        } catch(e) {}

        let reply = v2Result.reply;

        if (!reply || reply.trim() === "") {
          console.error(`[EMPTY-GUARD] AI returned an empty message. Discarding.`);
          return;
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
        
        if (v2Result.nextAction?.type === 'recap') {
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Disconnect & Error Handling
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
client.on("disconnected", (reason) => {
  console.error("[DISCONNECTED]", reason, "â€“ exiting for restart");
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Graceful Shutdown
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.log("Puppeteer context lost â€“ exiting for restart");
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (msg.includes("EBUSY") && msg.includes("lockfile")) return;
  if (msg.includes("getAlternateUserWid")) return;
  console.error("[UNHANDLED REJECTION]", msg);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Boot
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
(async () => {
  await initDB();
  client.initialize();
})();











module.exports = { pool };







