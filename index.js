'use strict';
require('dotenv').config();

// ─────────────────────────────────────────────
// Dependencies
// ─────────────────────────────────────────────
const { Client, LocalAuth } = require('whatsapp-web.js');
const Groq   = require('groq-sdk');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const http   = require('http');
const { execSync } = require('child_process');

// ─────────────────────────────────────────────
// Startup: remove stale Chrome lockfile to prevent EBUSY crash
// ─────────────────────────────────────────────
const LOCKFILE = path.join(__dirname, '.wwebjs_auth', 'session', 'lockfile');
try {
  if (fs.existsSync(LOCKFILE)) {
    fs.rmSync(LOCKFILE, { force: true });
    console.log('🧹 Stale lockfile removed');
  }
} catch (_) { /* ignore */ }

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const CONFIG = {
  groqModel      : 'openai/gpt-oss-120b',
  maxHistory     : 16,           // messages kept per user
  replyMaxTokens : 600,          // keep replies concise
  extractMaxTokens: 400,         // booking extraction call (enough for full JSON)
  qrPort         : 3000,         // QR web server port
  adminWebhookUrl: process.env.ADMIN_WEBHOOK_URL || 'http://localhost:3001/api/webhook/make?token=dkclim-ia-2026',
  adminPhone     : '212619401129@c.us', // The admin's personal number for dynamic learning
};

// ─────────────────────────────────────────────
// HTTP Server  (port 3000)
// Handles: GET /          → QR page
//          POST /notify   → WhatsApp notification after TERMINEE
// ─────────────────────────────────────────────
const QR_HTML_PATH = 'qr.html';
const NOTIFY_TOKEN  = process.env.WEBHOOK_SECRET || 'dkclim-ia-2026';

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${CONFIG.qrPort}`);

  // ── POST /notify ──────────────────────────────
  if (req.method === 'POST' && url.pathname === '/notify') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);

        // Token check
        if (payload.token !== NOTIFY_TOKEN) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Non autorisé' }));
          return;
        }

        const { phone, clientName, reference, technicianName, type,
                workDone, workDoneOther, observations, finalStatus,
                materialsUsed, startTime, endTime } = payload;

        if (!phone) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'phone manquant' }));
          return;
        }

        // Format phone → WhatsApp ID (212XXXXXXXXX@c.us)
        let waPhone = String(phone).replace(/\D/g, '');
        if (waPhone.startsWith('0')) waPhone = '212' + waPhone.slice(1);
        if (!waPhone.startsWith('212')) waPhone = '212' + waPhone;
        const waId = `${waPhone}@c.us`;

        // Build workDone list
        let workList = '';
        try {
          const arr = typeof workDone === 'string' ? JSON.parse(workDone) : (workDone || []);
          if (arr.length > 0) workList = arr.map(w => `  ✔ ${w}`).join('\n');
        } catch { workList = workDone || ''; }
        if (workDoneOther) workList += `\n  ✔ ${workDoneOther}`;

        const conformite = finalStatus ? '✅ Conforme' : '⚠️ Non conforme';
        const horaires   = (startTime && endTime) ? `${startTime} → ${endTime}` : '';

        const message = [
          `🎉 *مرحباً ${clientName || ''}!*`,
          '',
          `تمت خدمتكم بنجاح من طرف فريق *DK Climatisation* 🏆`,
          '',
          `📋 *Référence* : ${reference}`,
          `🔧 *Type*       : ${type || '-'}`,
          `👷 *Technicien* : ${technicianName || '-'}`,
          horaires ? `🕐 *Horaires*   : ${horaires}` : '',
          workList  ? `\n🛠 *Travaux effectués :*\n${workList}` : '',
          materialsUsed ? `\n📦 *Matériaux* : ${materialsUsed}` : '',
          observations  ? `\n📝 *Observations* : ${observations}` : '',
          `\n⭐ *Statut final* : ${conformite}`,
          '',
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `شكراً لثقتكم في DK Clim 🙏`,
          `لأي سؤال أو استفسار: *0612-54-00-85*`,
        ].filter(l => l !== '').join('\n');

        // Send via WhatsApp client (fire-and-forget, don't block response)
        setImmediate(async () => {
          try {
            await client.sendMessage(waId, message);
            console.log(`✅ [NOTIFY] Sent to ${waId} for ${reference}`);
          } catch (e) {
            console.error(`[NOTIFY ERR] Could not send to ${waId}:`, e.message);
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, sentTo: waId }));

      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // ── GET / → QR page ──────────────────────────
  fs.readFile(QR_HTML_PATH, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('QR not generated yet – please wait...');
      return;
    }
    res.writeHead(200, {
      'Content-Type'  : 'text/html; charset=utf-8',
      'Cache-Control' : 'no-store',
    });
    res.end(data);
  });
});

httpServer.listen(CONFIG.qrPort, () => {
  console.log(`🌐  HTTP server → http://localhost:${CONFIG.qrPort}  (QR + /notify)`);
});

// ─────────────────────────────────────────────
// System Prompt  (DK Climatisation commercial agent)
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت المساعد الذكي والمستشار التجاري لشركة "DK Climatisation" (أو DK Clim) الرائدة في مجال التكييف بالمغرب.

🎯 مهمتك: استقبال الزبناء بلباقة، تقديم إجابات دقيقة واحترافية، إعطاء نصائح، ومساعدتهم في طلب المنتجات أو حجز مواعيد للصيانة والتركيب. كن طبيعياً جداً في كلامك وكأنك إنسان حقيقي يدردش على الواتساب.

🏢 معلومات الشركة:
- الاسم: DK Climatisation / DK Clim (تجنب ذكر أي أسماء أخرى).
- العنوان: إقامة 10 عمارة 5 أبراج الأزهر، فرح السلام، الألفة، الدار البيضاء.
- الموقع على الخريطة (Localisation): https://maps.app.goo.gl/XDq9t1xhZkD7WQ3x5 (أرسل هذا الرابط فوراً إذا سأل الزبون عن الموقع أو أين تتواجدون).
- الهاتف/واتساب: 0612-54-00-85
- أوقات العمل: الإثنين–السبت 9h–20h | الطوارئ 7j/7.
- مناطق العمل: الدار البيضاء ونواحيها.

📦 الأجهزة المتوفرة:
• DAIKOOL 9000 BTU Inverter – 3 300 DH | DAIKOOL 12000 BTU Inverter – 4 000 DH
• PROMO: DAIKOOL 9000 BTU – 3 999 DH (شامل التركيب + النحاس + السيبور)
• CIAT 9000 BTU Inverter – 3 800 DH | CIAT 12000 BTU – 4 300 DH
• TCL 9000 BTU ON/OFF – 3 200 DH | TCL 12000 BTU – 4 000 DH
• ماركات أخرى متوفرة: LG، Carrier، ومكيفات مركزية (Gainable).

🔩 الأكسسوارات:
• Télécommandes (تيليكوماند)، أنابيب نحاس، Supports، Gaz (R410A, R32...).

🛠️ الخدمات والتسعيرة:
• التركيب (Installation): ابتداءً من 500 درهم.
• الصيانة والإصلاح (Dépannage).

🧠 قواعد التواصل (مهم جداً - التزم بها بدقة):
1. في أول رسالة لك مع الزبون، رحب به وعرّف بنفسك كعضو في فريق "DK Climatisation"، واذكر له باختصار الخدمات التي نقدمها (بيع وتركيب المكيفات، الصيانة، وبيع الأكسسوارات). كن طبيعياً ومختصراً ولا تستعمل لوائح مرقمة (Numbered lists).
2. لا تقترح موعداً بشكل هجومي أو من أول رسالة. قدم المعلومات التي طلبها الزبون أولاً، وتجاوب معه. إذا أظهر اهتماماً حقيقياً بخدمة التركيب أو الصيانة، عندها فقط قل "إذا بغيتي نرسلو ليك تقني، خلي ليا سميتك وعنوانك".
3. إذا سأل الزبون عن "تيليكوماند" (Commande/Remote) أو أكسسوار، أخبره أنها متوفرة واطلب منه زيارة المحل، ولا تسأله أبداً عن مساحة الغرفة!
4. لا تستخدم كلمة "مجانية" (Gratuite) لوصف الزيارة. قل "يمكننا إرسال تقني لتشخيص المشكل".
5. إذا كان لدى الزبون عطل (مكيبردش، كيقطر...)، تعاطف معه قليلاً واطلب منه (الاسم، الحي، ورقم الهاتف) لكي يزوره التقني. لا تسأله عن تفاصيل تقنية معقدة.
6. إذا سأل الزبون عن مكيف جديد، اسأله بلطف عن مساحة الغرفة (m²) لتعطيه الجهاز المناسب.
7. تحدث بنفس لغة الزبون: دارجة مغربية، فرنسية، أو عربية. لا تضع خاتمة مثل "تحياتي، فريق DK Clim" في كل رسالة، كن كإنسان يدردش.
8. تجنب إعطاء وعود بأوقات التوصيل (مثل 2-3 أيام) أو أسعار غير مذكورة. إذا طلب الزبون تفاصيل دقيقة أو سأل عن المخزون، قل له ببساطة: 'غادي ندوز ليك شي واحد من فريق الدعم (Support) باش يعطيك التفاصيل'.`;

// ─────────────────────────────────────────────
// AI Clients (Groq + DeepSeek Fallback)
// ─────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function askDeepSeek(messages, maxTokens) {
  const res = await axios.post('https://api.deepseek.com/chat/completions', {
    model: 'deepseek-chat',
    messages,
    max_tokens: maxTokens,
    temperature: 0.4,
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
  return res.data.choices[0].message.content.trim();
}

async function askAI(messages, maxTokens = CONFIG.replyMaxTokens, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model     : CONFIG.groqModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.4,
      });
      const raw = completion.choices[0].message.content ?? '';
      return raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*/g, '').trim();
    } catch (err) {
      if ((err.status === 429 || err.status === 503 || err.status === 402 || err.status === 401) && process.env.DEEPSEEK_API_KEY) {
        console.warn(`[GROQ] Error ${err.status} – Falling back instantly to DeepSeek!`);
        try {
          return await askDeepSeek(messages, maxTokens);
        } catch (dsErr) {
          console.error('[DEEPSEEK FALLBACK ERR]', dsErr.message);
        }
      }
      
      const retry = (err.status === 429 || err.status === 503);
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

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DIRECT_URL
});

const syncedUsers = new Map();   // userId → lastSyncTime

async function getHistory(userId) {
  try {
    const res = await pool.query(
      'SELECT role, content FROM "BotMessage" WHERE phone = $1 ORDER BY "createdAt" DESC LIMIT $2',
      [userId, CONFIG.maxHistory]
    );
    return res.rows.reverse().map(r => ({ role: r.role, content: r.content }));
  } catch(e) {
    console.error('DB Fetch Error:', e.message);
    return [];
  }
}

async function pushMessage(userId, role, content) {
  try {
    await pool.query(
      'INSERT INTO "BotMessage" (id, phone, role, content, "createdAt") VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())',
      [userId, role, content]
    );
  } catch(e) {
    console.error('DB Insert Error:', e.message);
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
    .map(m => `${m.role === 'user' ? 'CLIENT' : 'AGENT'}: ${m.content}`)
    .join('\n');

  const prompt = [
    'Analyse this WhatsApp conversation between a DK Clim sales agent and a client.',
    'If the client provided BOTH their full name AND their address or neighborhood, return ONLY a single-line JSON (no newlines inside values):',
    '{"hasBooking":true,"clientName":"full name","clientAddress":"address or neighborhood","clientContactPhone":"phone or empty","problemReported":"one-line summary","type":"Installation"}',
    'If not enough info yet, return ONLY: {"hasBooking":false}',
    'IMPORTANT: Return ONLY the JSON object, nothing else. No explanation. No markdown.',
    '',
    'CONVERSATION:',
    recentText,
  ].join('\n');

  const raw = await askAI(
    [{ role: 'user', content: prompt }],
    CONFIG.extractMaxTokens
  );

  const match = raw.replace(/\r?\n/g, ' ').match(/\{[^{}]*\}/);
  if (!match) return;

  let data;
  try { data = JSON.parse(match[0]); } catch { return; }

  if (!data.hasBooking || !data.clientName || !data.clientAddress) return;

  const phone = data.clientContactPhone || userId.split('@')[0];
  
  // ── Auto-Assign Technician ──────────────────────────
  let assignedTech = null;
  try {
    const techRes = await pool.query('SELECT name, phone FROM "Technician" WHERE phone IS NOT NULL AND phone != \'\'');
    const technicians = techRes.rows;
    if (technicians.length > 0) {
      assignedTech = technicians[Math.floor(Math.random() * technicians.length)];
    }
  } catch(e) {
    console.error('Failed to fetch technicians', e.message);
  }

  const payload = {
    clientName         : data.clientName.trim(),
    clientAddress      : data.clientAddress.trim(),
    clientContactPhone : phone,
    problemReported    : data.problemReported || 'Demande via WhatsApp Bot',
    type               : data.type || 'Installation',
    technicianName     : assignedTech ? assignedTech.name : 'À assigner (Bot)'
  };

  console.log('\n🎯 [BOOKING DETECTED]', payload);

  try {
    const res = await axios.post(CONFIG.adminWebhookUrl, payload, { timeout: 6000 });
    if (res.data?.success) {
      syncedUsers.set(userId, Date.now());
      console.log('✅ [ADMIN SYNC] Intervention:', res.data.data?.reference);
      
      // ── Send Notification to Technician ────────────────
      if (assignedTech) {
        let techPhone = assignedTech.phone.replace(/\D/g, '');
        if (techPhone.startsWith('0')) techPhone = '212' + techPhone.slice(1);
        const techChatId = techPhone + '@c.us';
        
        const notifMsg = `🚨 *NOUVELLE INTERVENTION ASSIGNÉE* 🚨\n\n` +
          `👤 *Client:* ${payload.clientName}\n` +
          `📍 *Adresse:* ${payload.clientAddress}\n` +
          `📞 *Téléphone:* ${payload.clientContactPhone}\n` +
          `🔧 *Problème/Type:* ${payload.problemReported} (${payload.type})\n\n` +
          `_Merci de contacter le client pour confirmer l'heure de visite._`;
          
        client.sendMessage(techChatId, notifMsg).catch(err => console.error('Failed to notify tech:', err));
      }
    }
  } catch (err) {
    console.error('[ADMIN SYNC FAILED]', err.message);
  }
}

// ─────────────────────────────────────────────
// WhatsApp Client
// ─────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1047399436-alpha.html',
  },
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
    ],
  },
});

// QR Code → write to file + open browser once
let qrBrowserOpened = false;
client.on('qr', (qr) => {
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

  fs.writeFileSync(QR_HTML_PATH, html, 'utf8');
  console.log('\n🔑 New QR generated →', `http://localhost:${CONFIG.qrPort}`);

  if (!qrBrowserOpened) {
    try { execSync('start qr.html'); } catch (_) { /* no-op on headless */ }
    qrBrowserOpened = true;
  }
});

client.on('ready', () => {
  console.log('✅ WhatsApp connected & ready!');
});

// ─────────────────────────────────────────────
// Dynamic System Prompt (Base + DB Rules)
// ─────────────────────────────────────────────
async function getSystemPrompt() {
  let prompt = SYSTEM_PROMPT;
  try {
    const res = await pool.query('SELECT rule FROM "BotRule" ORDER BY "createdAt" ASC');
    if (res.rows.length > 0) {
      prompt += '\n\n**تعليمات جديدة ومهمة جداً (يجب أن تطبقها دائماً وتتجاهل أي تعليمات سابقة تخالفها):**\n';
      for (const row of res.rows) {
        prompt += `- ${row.rule}\n`;
      }
    }
  } catch (e) {
    console.error('Failed to fetch rules:', e.message);
  }
  return prompt;
}

// ─────────────────────────────────────────────
// Message Handler
// ─────────────────────────────────────────────
client.on('message', async (msg) => {
  // Only respond to private chats (ignore groups and status broadcasts)
  if (msg.from === 'status@broadcast' || msg.from.includes('@g.us')) return;

  const userId = msg.from;
  const body = msg.body?.trim();
  if (!body) return;
  
  // ── Admin Learning Mode ──────────────────────────
  if (userId === CONFIG.adminPhone || userId === '191396711506131@lid' || userId === '212669247744@c.us') {
    if (body.toLowerCase().startsWith('مسح') || body.toLowerCase().startsWith('clear')) {
      await pool.query('DELETE FROM "BotRule"');
      await msg.reply('✅ تم مسح جميع القواعد الإضافية. البوت دابا رجع للحالة الأصلية ديالو.');
      return;
    }
    
    try {
      await pool.query('INSERT INTO "BotRule" (id, rule, "createdAt") VALUES (gen_random_uuid()::text, $1, NOW())', [body]);
      await msg.reply('✅ حفظت هاد المعلومة! البوت غادي يولي يطبقها مع أي كليان جديد من دابا الفوق.\n\n_(باش تمسح كاع القواعد اللي علمتيه، صيفط ليا كلمة "مسح")_');
    } catch (e) {
      console.error('Failed to save rule', e.message);
      await msg.reply('❌ وقع شي خطأ فـ السيرفر.');
    }
    return;
  }

  console.log(`\n[IN]  ${userId}: "${body.slice(0, 80)}"`);

  try {
    await pushMessage(userId, 'user', body);
    
    // ── UX Enhancement: Show typing indicator ────────────────
    let chat = null;
    try {
      chat = await msg.getChat();
      await chat.sendStateTyping();
    } catch (e) {
      console.warn('[TYPING WARN] Could not send typing state:', e.message);
    }

    // Fetch history ONCE (includes the message we just pushed)
    const history = await getHistory(userId);

    const messages = [
      { role: 'system', content: await getSystemPrompt() },
      ...history,
    ];

    const reply = await askAI(messages);
    await pushMessage(userId, 'assistant', reply);

    if (chat) {
      try { await chat.clearState(); } catch (e) {} // Stop typing
    }
    
    await msg.reply(reply);

    console.log(`[OUT] ${reply.slice(0, 100)}`);
    
    // Background: sync booking to admin (use history already fetched to avoid extra DB call)
    syncToAdmin(history, userId).catch(err => {
      console.error('[SYNC ERR]', err.message);
    });

  } catch (err) {
    console.error('[MSG ERR]', err.message);
    await msg.reply('عذراً، وقع مشكل تقني. حاول مرة أخرى من بعد.').catch(() => {});
  }
});

// ─────────────────────────────────────────────
// Disconnect & Error Handling  (PM2 restarts cleanly)
// ─────────────────────────────────────────────
client.on('disconnected', (reason) => {
  console.error('[DISCONNECTED]', reason, '– exiting for PM2 restart');
  if (reason === 'LOGOUT' || reason === 'NAVIGATION') {
    try {
      console.log('User logged out. Clearing auth cache...');
      fs.rmSync(path.join(__dirname, '.wwebjs_auth'), { recursive: true, force: true });
      fs.rmSync(path.join(__dirname, '.wwebjs_cache'), { recursive: true, force: true });
    } catch (e) {
      console.error('Failed to clear cache:', e.message);
    }
  }
  process.exit(1);
});

// ─────────────────────────────────────────────
// Graceful Shutdown (Level-Up)
// ─────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n[SHUTDOWN] Closing database and WhatsApp client safely...');
  try {
    await pool.end();
    await client.destroy();
  } catch(e) {
    console.error('Shutdown Error:', e.message);
  }
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  const msg = err.message || '';
  // EBUSY lockfile is harmless — Chromium async cleanup, never crash for it
  if (msg.includes('EBUSY') && msg.includes('lockfile')) return;
  console.error('[UNCAUGHT]', msg);
  if (msg.includes('Execution context was destroyed') ||
      msg.includes('TargetCloseError')) {
    console.log('Puppeteer context lost – exiting for PM2 restart');
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  // EBUSY on lockfile is harmless — Chrome cleans up async, ignore it
  if (msg.includes('EBUSY') && msg.includes('lockfile')) return;
  console.error('[UNHANDLED REJECTION]', msg);
});

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
client.initialize();