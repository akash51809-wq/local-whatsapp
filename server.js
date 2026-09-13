const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');

try {
  const baileys = require('@whiskeysockets/baileys');
  const originalMakeWASocket = baileys.default;
  if (typeof originalMakeWASocket === 'function') {
    baileys.default = function wrappedMakeWASocket(...args) {
      const socket = originalMakeWASocket(...args);
      global.__waAdminSocket = socket;

      global.__waSendAdminText = async (number, text) => {
        const current = global.__waAdminSocket;
        if (!current) throw new Error('Admin WhatsApp अभी connected नहीं है');

        let digits = String(number || '').replace(/\D/g, '');
        // Signup receives a 10-digit Indian mobile number. WhatsApp JID needs country code.
        if (/^[6-9]\d{9}$/.test(digits)) digits = `91${digits}`;
        if (!/^91[6-9]\d{9}$/.test(digits)) {
          throw new Error('Invalid Indian WhatsApp mobile number');
        }

        const jid = `${digits}@s.whatsapp.net`;
        console.log(`[Auth WhatsApp] Sending message to ${jid}`);
        const result = await current.sendMessage(jid, { text: String(text) });
        console.log(`[Auth WhatsApp] Message sent to ${digits}`);
        return result;
      };

      if (socket?.ev?.on) {
        socket.ev.on('connection.update', async (update) => {
          try {
            const { connection } = update || {};
            const { recordAdminWhatsAppSession } = require('./auth');
            let phone = null;
            try {
              phone = socket?.user?.id
                ? String(socket.user.id).split(':')[0].replace(/\D/g, '')
                : null;
            } catch {}

            if (connection === 'open') {
              global.__waAdminConnected = true;
              await recordAdminWhatsAppSession({ status: 'connected', phone });
              console.log('[Auth WhatsApp] Admin WhatsApp is READY for OTP delivery');
            } else if (connection === 'close') {
              global.__waAdminConnected = false;
              await recordAdminWhatsAppSession({ status: 'disconnected', phone });
            } else if (connection === 'connecting') {
              global.__waAdminConnected = false;
              await recordAdminWhatsAppSession({ status: 'connecting', phone });
            }
          } catch (err) {
            console.error('Admin WhatsApp session tracking error:', err.message);
          }
        });
      }
      return socket;
    };
  }

  const originalAuthState = baileys.useMultiFileAuthState;
  if (typeof originalAuthState === 'function') {
    baileys.useMultiFileAuthState = function wrappedAuthState(folder, ...args) {
      const requested = String(folder || '');
      if (requested === 'auth_info' || requested.endsWith('/auth_info') || requested.endsWith('\\auth_info')) {
        folder = process.env.ADMIN_WHATSAPP_SESSION_DIR || requested;
      }
      return originalAuthState(folder, ...args);
    };
  }
} catch (error) {
  console.error('Baileys bridge setup failed:', error.message);
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
const MONGO_URI = process.env.MONGO_URI;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Unified Server running and listening on 0.0.0.0:${PORT}`);
  if (botStartup) {
    try { botStartup(); } catch (err) { console.error('WhatsApp bot startup failed:', err); }
  }
  if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
      .then(async () => {
        console.log('MongoDB Atlas Connected Successfully');
        await ensureAdminUser();
        console.log('MongoDB authentication system ready');
      })
      .catch((err) => console.error('MongoDB connection failed:', err));
  } else {
    console.warn('MONGO_URI is not configured. Signup/login database features require MongoDB.');
  }
});
