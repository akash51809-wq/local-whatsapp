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
    if (/^0091[6-9]\d{9}$/.test(digits)) digits = digits.slice(2);
    if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
    if (/^91[6-9]\d{9}$/.test(digits)) return digits;
    throw new Error('Invalid Indian WhatsApp mobile number');
  }

  // Robust helper to send message through active Baileys socket
  async function sendAdminText(number, text, retries = 3) {
    let lastError = null;
    let socketWasAvailable = false;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const current = global.__waAdminSocket;

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

  if (typeof originalMakeWASocket === 'function') {
    wrappedBaileys.default = function wrappedMakeWASocket(...args) {
      const socket = originalMakeWASocket(...args);

      global.__waAdminSocket = socket;
      global.__waSendAdminText = sendAdminText;

      console.log('[Baileys bridge] Admin socket instance captured');

      if (socket?.ev?.on) {
        socket.ev.on('connection.update', async (update) => {
          try {
            const { connection } = update || {};
            const { recordAdminWhatsAppSession } = require('./auth');

            let phone = null;
            try {
              phone = socket?.user?.id
                ? String(socket.user.id).split(':')[0].split('@')[0].replace(/\D/g, '')
                : null;
              if (phone && /^91[6-9]\d{9}$/.test(phone)) phone = `+${phone}`;
            } catch {}

            if (connection === 'open') {
              global.__waAdminSocket = socket;
              global.__waSendAdminText = sendAdminText;
              console.log(`[Auth WhatsApp] Connection OPEN. Admin account: ${phone || 'unknown'}`);
              await recordAdminWhatsAppSession({ status: 'connected', phone });
            } else if (connection === 'close') {
              await recordAdminWhatsAppSession({ status: 'disconnected', phone });
            } else if (connection === 'connecting') {
              await recordAdminWhatsAppSession({ status: 'connecting', phone });
            }
          } catch (err) {
            console.error('[Auth WhatsApp] Session tracking error:', err?.message || err);
          }
        });
      }

      return socket;
    };
  }

  const { useMongoAuthState } = require('./mongoAuthState');
  wrappedBaileys.useMongoAuthState = useMongoAuthState;

  require.cache[baileysModulePath].exports = wrappedBaileys;
  global.__waSendAdminText = sendAdminText;
  console.log('[Baileys bridge] Admin socket/auth wrappers installed');
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
app.use(express.json({ limit: '100mb' }));
const distPath = path.join(__dirname, 'whatsapp-dashboard', 'dist');

app.get('/ping', (req, res) => res.status(200).send('OK - Alive'));
app.use(authRouter);
app.use(botApp);
app.use(express.static(distPath, { index: false }));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/media') && !req.path.startsWith('/send-text') && req.path !== '/ping') {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf8');
      const signupScript = `\n<script>\n(function(){function addSignup(){var card=document.querySelector('.login-card');if(!card||card.querySelector('[data-signup-link]'))return;var btn=document.createElement('button');btn.type='button';btn.setAttribute('data-signup-link','1');btn.textContent='Create new account';btn.style.cssText='width:100%;margin-top:10px;padding:11px 14px;border:1px solid #d9dee8;border-radius:10px;background:#fff;color:#128c7e;font-weight:700;cursor:pointer;';btn.onclick=function(){location.href='/signup.html'};card.appendChild(btn)}new MutationObserver(addSignup).observe(document.documentElement,{childList:true,subtree:true});setTimeout(addSignup,300)})();\n</script>\n`;
      if (html.includes('</body>')) html = html.replace('</body>', signupScript + '</body>'); else html += signupScript;
      return res.type('html').send(html);
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
    });
  } catch (err) {
    console.error('FATAL: MongoDB connection failed:', err?.message || err);
    process.exit(1);
  }
}

startServer();