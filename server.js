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
   =========================================================
   The dashboard and signup flow must use the SAME Baileys socket.
   The important source of truth is socket.user: when Baileys has an
   authenticated user, the session is ready for sending. Do not depend
   only on a separate boolean because a connection.update event can be
   missed/reordered during reconnects.
*/
try {
  const baileysModulePath = require.resolve('@whiskeysockets/baileys');
  const originalBaileys = require(baileysModulePath);
  const originalMakeWASocket = originalBaileys.default;
  const originalAuthState = originalBaileys.useMultiFileAuthState;
  const wrappedBaileys = Object.create(originalBaileys);

  function normalizeIndianWhatsAppNumber(value) {
    let digits = String(value ?? '').trim().replace(/\D/g, '');

    // 10 digit Indian mobile -> 91XXXXXXXXXX
    if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;

    // +91XXXXXXXXXX / 91XXXXXXXXXX -> keep exactly 12 digits
    if (/^91[6-9]\d{9}$/.test(digits)) return digits;

    // 0091XXXXXXXXXX -> 91XXXXXXXXXX
    if (/^0091[6-9]\d{9}$/.test(digits)) return digits.slice(2);

    throw new Error('Invalid Indian WhatsApp mobile number');
  }

  if (typeof originalMakeWASocket === 'function') {
    wrappedBaileys.default = function wrappedMakeWASocket(...args) {
      const socket = originalMakeWASocket(...args);
      global.__waAdminSocket = socket;

      // Keep this helper tied directly to the socket. We intentionally do
      // NOT require a separate connected boolean here.
      global.__waSendAdminText = async (number, text) => {
        const current = global.__waAdminSocket;

        if (!current || !current.user) {
          throw new Error('Admin WhatsApp अभी connected नहीं है। पहले Admin WhatsApp scan करें।');
        }

        const digits = normalizeIndianWhatsAppNumber(number);
        const jid = `${digits}@s.whatsapp.net`;

        console.log(`[Auth WhatsApp] Admin socket ready: ${current.user.id}`);
        console.log(`[Auth WhatsApp] Sending message to ${jid}`);

        try {
          const result = await current.sendMessage(jid, { text: String(text) });
          console.log(`[Auth WhatsApp] Message sent successfully to ${digits}`);
          return result;
        } catch (error) {
          console.error(`[Auth WhatsApp] Send failed to ${jid}:`, error?.message || error);
          throw error;
        }
      };

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
              if (phone && /^91[6-9]\d{9}$/.test(phone)) {
                phone = `+${phone}`;
              }
            } catch {}

            if (connection === 'open') {
              console.log(`[Auth WhatsApp] Connection OPEN. Admin account: ${phone || 'unknown'}`);
              await recordAdminWhatsAppSession({ status: 'connected', phone });
              console.log('[Auth WhatsApp] Admin WhatsApp is READY for OTP delivery');
            } else if (connection === 'close') {
              await recordAdminWhatsAppSession({ status: 'disconnected', phone });
              console.log('[Auth WhatsApp] Admin WhatsApp connection closed; Baileys may reconnect.');
            } else if (connection === 'connecting') {
              await recordAdminWhatsAppSession({ status: 'connecting', phone });
            }
          } catch (err) {
            console.error('Admin WhatsApp session tracking error:', err?.message || err);
          }
        });
      }

      return socket;
    };
  }

  if (typeof originalAuthState === 'function') {
    wrappedBaileys.useMultiFileAuthState = function wrappedAuthState(folder, ...args) {
      const requested = String(folder || '');
      if (requested === 'auth_info' || requested.endsWith('/auth_info') || requested.endsWith('\\auth_info')) {
        folder = process.env.ADMIN_WHATSAPP_SESSION_DIR || requested;
      }
      return originalAuthState(folder, ...args);
    };
  }

  require.cache[baileysModulePath].exports = wrappedBaileys;
  console.log('[Baileys bridge] Admin socket/auth wrappers installed');
} catch (error) {
  console.error('Baileys bridge setup failed:', error?.message || error);
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

if (!fs.existsSync(path.join(distPath, 'index.html'))) console.warn('WARNING: whatsapp-dashboard/dist/index.html not found. Run: npm run build');

const PORT = process.env.PORT || 10000;
const MONGO_URI = String(process.env.MONGO_URI || '').trim();

async function startServer() {
  if (!MONGO_URI) {
    console.error('FATAL: MONGO_URI is not configured. Authentication cannot start.');
    process.exit(1);
  }

  console.log('[MongoDB] Starting connection...');
  console.log(`[MongoDB] URI configured: ${MONGO_URI.startsWith('mongodb+srv://') ? 'yes (mongodb+srv)' : 'yes'}`);

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 20000,
      maxPoolSize: 10,
    });

    if (mongoose.connection.readyState !== 1) throw new Error(`MongoDB connected call completed but readyState=${mongoose.connection.readyState}`);

    console.log('MongoDB Atlas Connected Successfully');
    console.log(`[MongoDB] Host: ${mongoose.connection.host || 'unknown'}`);
    console.log(`[MongoDB] Database: ${mongoose.connection.name || 'unknown'}`);

    await ensureAdminUser();
    console.log('MongoDB authentication system ready');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Unified Server running and listening on 0.0.0.0:${PORT}`);
      if (botStartup) {
        try { botStartup(); } catch (err) { console.error('WhatsApp bot startup failed:', err); }
      }
    });
  } catch (err) {
    console.error('FATAL: MongoDB connection failed. Signup/Login cannot work.');
    console.error(`[MongoDB] Error name: ${err?.name || 'unknown'}`);
    console.error(`[MongoDB] Error code: ${err?.code ?? 'none'}`);
    console.error(`[MongoDB] Error message: ${err?.message || err}`);
    if (err?.reason) console.error('[MongoDB] Server selection reason:', err.reason?.message || err.reason);
    console.error('[MongoDB] Check Render MONGO_URI, MongoDB user/password, Atlas Network Access, and database-user permissions.');
    process.exit(1);
  }
}

startServer();