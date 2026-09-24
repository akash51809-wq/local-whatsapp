const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 0);

mongoose.connection.on('connected', () => console.log('[MongoDB] Connected'));
mongoose.connection.on('open', () => console.log('[MongoDB] Connection open'));
mongoose.connection.on('disconnected', () => console.error('[MongoDB] Disconnected'));
mongoose.connection.on('reconnected', () => console.log('[MongoDB] Reconnected'));
mongoose.connection.on('error', (err) => console.error('[MongoDB] Connection error:', err?.name || 'Error', err?.message || err));

/* =========================================================
   BAILEYS ADMIN WHATSAPP BRIDGE
   ========================================================= */
try {
  const baileysModulePath = require.resolve('@whiskeysockets/baileys');
  const originalBaileys = require(baileysModulePath);
  const originalMakeWASocket = originalBaileys.default;
  const wrappedBaileys = Object.create(originalBaileys);

  function normalizeIndianWhatsAppNumber(value) {
    let digits = String(value ?? '').trim().replace(/\D/g, '');
    if (digits.startsWith('0091')) digits = digits.slice(4);
    if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length >= 10) return digits;
    throw new Error('Invalid WhatsApp mobile number: ' + value);
  }

  // Robust helper to send message through active Baileys socket
  async function sendAdminText(number, text, retries = 3) {
    let lastError = null;
    let socketWasAvailable = false;

    for (let attempt = 1; attempt <= retries; attempt++) {
      let current = global.__waAdminSocket;
      if (!current || typeof current.sendMessage !== 'function') {
        try {
          const { getSessionByPhoneOrUserId, sessions } = require('./userSessions');
          const adminPhone = process.env.ADMIN_PHONE || '8840457632';
          const match = getSessionByPhoneOrUserId(adminPhone);
          if (match?.session?.socket && match?.session?.status === 'connected') {
            current = match.session.socket;
            global.__waAdminSocket = current;
          } else {
            const userS = sessions?.get('USR59396382');
            if (userS?.socket && userS?.status === 'connected') {
              current = userS.socket;
              global.__waAdminSocket = current;
            }
          }
        } catch (e) {}
      }

      if (current && typeof current.sendMessage === 'function') {
        socketWasAvailable = true;
        try {
          const digits = normalizeIndianWhatsAppNumber(number);
          const jid = `${digits}@s.whatsapp.net`;
          const result = await current.sendMessage(jid, { text: String(text) });
          console.log(`[Auth WhatsApp] Message sent successfully to ${digits}`);
          return result;
        } catch (error) {
          lastError = error;
          console.error(`[Auth WhatsApp] Attempt ${attempt}/${retries} failed:`, error?.message || error);
        }
      } else {
        console.warn(`[Auth WhatsApp] Attempt ${attempt}/${retries}: Admin socket not available (socket=${!!current}, sendMessage=${typeof current?.sendMessage})`);
      }

      if (attempt < retries) {
        console.log(`[Auth WhatsApp] Waiting 2s before retry (${attempt}/${retries})...`);
        await new Promise(res => setTimeout(res, 2000));
      }
    }

    // If the socket was available but sending failed, throw the actual error
    if (socketWasAvailable && lastError) {
      console.error('[Auth WhatsApp] All retries exhausted. Last error:', lastError?.message || lastError);
      throw new Error(`WhatsApp message भेजने में error: ${lastError?.message || 'Unknown error'}`);
    }

    throw new Error('Admin WhatsApp अभी connected नहीं है। कृपया कुछ देर, फिर प्रयास करें।');
  }

  global.__waSendAdminText = sendAdminText;
  console.log('[Baileys bridge] Admin send text helper initialized');
} catch (error) {
  console.error('[Baileys bridge] Setup failed:', error?.message || error);
}

const { router: authRouter, ensureAdminUser } = require('./auth');

let botApp = null;
let botStartup = null;
const originalListen = express.application.listen;
express.application.listen = function (...args) {
  botApp = this;
  const lastArg = args[args.length - 1];
  if (typeof lastArg === 'function') botStartup = lastArg;
  return { close(callback) { if (typeof callback === 'function') callback(); } };
};

try { require('./index'); } finally { express.application.listen = originalListen; }
if (!botApp) throw new Error('WhatsApp backend app could not be loaded from index.js');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
/* =========================================================
   AUTO-PING / KEEP-ALIVE SYSTEM (PREVENT RENDER SLEEP)
========================================================= */

const autoPingStats = {
  enabled: true,
  url: '',
  intervalMinutes: 5,
  lastPingTime: null,
  lastPingStatus: null,
  totalPings: 0,
  failures: 0
};

function getAutoPingUrl() {
  if (process.env.AUTOPING_URL) return process.env.AUTOPING_URL.trim();
  if (process.env.RENDER_EXTERNAL_URL) return `${process.env.RENDER_EXTERNAL_URL.trim().replace(/\/$/, '')}/ping`;
  if (process.env.APP_URL) return `${process.env.APP_URL.trim().replace(/\/$/, '')}/ping`;
  return 'https://local-whatsapp.onrender.com/ping';
}

async function performAutoPing() {
  const pingUrl = getAutoPingUrl();
  autoPingStats.url = pingUrl;
  autoPingStats.totalPings += 1;
  const started = Date.now();

  try {
    const res = await fetch(pingUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'WA-Control-AutoPing/1.0 (Keep-Alive)'
      },
      signal: AbortSignal.timeout(15000)
    });
    const elapsed = Date.now() - started;
    autoPingStats.lastPingTime = new Date().toISOString();
    autoPingStats.lastPingStatus = `${res.status} ${res.statusText} (${elapsed}ms)`;
    console.log(`[AutoPing] Keep-Alive Ping -> ${pingUrl} [${autoPingStats.lastPingStatus}]`);
  } catch (err) {
    autoPingStats.failures += 1;
    autoPingStats.lastPingTime = new Date().toISOString();
    autoPingStats.lastPingStatus = `Error: ${err.message}`;
    console.warn(`[AutoPing] Keep-Alive Ping to ${pingUrl} failed:`, err.message);
  }
}

function startAutoPing() {
  const minutes = Math.max(1, Number(process.env.AUTOPING_INTERVAL_MINUTES || 5));
  autoPingStats.intervalMinutes = minutes;
  autoPingStats.url = getAutoPingUrl();

  console.log(`[AutoPing] Render Keep-Alive active. Pinging ${autoPingStats.url} every ${minutes} minute(s).`);

  // First ping after 30 seconds
  setTimeout(performAutoPing, 30000);

  // Then recurring ping every intervalMinutes
  setInterval(performAutoPing, minutes * 60 * 1000);
}

const distPath = path.join(__dirname, 'whatsapp-dashboard', 'dist');

app.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'alive',
    message: 'OK - Alive',
    serverTime: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    autoping: {
      enabled: autoPingStats.enabled,
      interval: `${autoPingStats.intervalMinutes}m`,
      lastPingTime: autoPingStats.lastPingTime,
      lastPingStatus: autoPingStats.lastPingStatus,
      totalPings: autoPingStats.totalPings
    }
  });
});

app.get('/api/system/autoping', (req, res) => {
  res.json({
    success: true,
    stats: autoPingStats,
    targetUrl: getAutoPingUrl()
  });
});

app.post('/api/system/autoping/trigger', async (req, res) => {
  await performAutoPing();
  res.json({
    success: true,
    stats: autoPingStats
  });
});

app.use('/api/settings/company', express.json({ limit: '15mb' }));
app.use(authRouter);
app.use(botApp);
app.use(express.static(distPath, { index: false }));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/media') && !req.path.startsWith('/send-text') && req.path !== '/ping') {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

const PORT = process.env.PORT || 10000;
const MONGO_URI = String(process.env.MONGO_URI || '').trim();

async function startServer() {
  if (!MONGO_URI) {
    console.error('FATAL: MONGO_URI is not configured.');
    process.exit(1);
  }

  const encryptionKey = process.env.SESSION_ENCRYPTION_KEY ? String(process.env.SESSION_ENCRYPTION_KEY).trim() : '';
  if (!encryptionKey || encryptionKey.length < 16) {
    console.error('FATAL: SESSION_ENCRYPTION_KEY is missing or too short (min 16 chars). Required for secure WhatsApp credentials storage.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 20000,
      maxPoolSize: 10,
    });

    console.log('MongoDB Atlas Connected Successfully');
    await ensureAdminUser();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Unified Server running and listening on 0.0.0.0:${PORT}`);
      if (botStartup) {
        try { botStartup(); } catch (err) { console.error('WhatsApp bot startup failed:', err); }
      }
      try {
        const { restoreAllSessions, startUserSessionWatchdog } = require('./userSessions');
        restoreAllSessions().catch(e => console.error('[UserSessions] Restore error:', e));
        if (typeof startUserSessionWatchdog === 'function') {
          startUserSessionWatchdog();
        }
      } catch (err) {
        console.error('[UserSessions] Load error:', err);
      }
      // Start Auto-Ping keep-alive to keep Render awake 24/7
      try {
        startAutoPing();
      } catch (pingErr) {
        console.error('[AutoPing] Initialization error:', pingErr);
      }
    });
  } catch (err) {
    console.error('FATAL: MongoDB connection failed:', err?.message || err);
    process.exit(1);
  }
}

startServer();