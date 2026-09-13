const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');

// index.js is currently a self-starting Express application. Capture its
// Express app and startup callback without allowing it to open a second port.
let botApp = null;
let botStartup = null;
const originalListen = express.application.listen;

express.application.listen = function (...args) {
  botApp = this;
  const lastArg = args[args.length - 1];
  if (typeof lastArg === 'function') {
    botStartup = lastArg;
  }

  // Return a harmless placeholder so index.js does not bind its own port.
  return {
    close(callback) {
      if (typeof callback === 'function') callback();
    }
  };
};

try {
  require('./index');
} finally {
  express.application.listen = originalListen;
}

if (!botApp) {
  throw new Error('WhatsApp backend app could not be loaded from index.js');
}

const app = express();
app.use(express.json({ limit: '100mb' }));

// React/Vite production build
const distPath = path.join(__dirname, 'whatsapp-dashboard', 'dist');

// Health check
app.get('/ping', (req, res) => {
  res.status(200).send('OK - Alive');
});

// Mount WhatsApp/API routes first
app.use(botApp);

// Serve the compiled React frontend
app.use(express.static(distPath));

// SPA fallback: normal browser GET requests load React's index.html.
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/media') &&
    !req.path.startsWith('/send-text') &&
    req.path !== '/ping'
  ) {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

if (!fs.existsSync(path.join(distPath, 'index.html'))) {
  console.warn('WARNING: whatsapp-dashboard/dist/index.html not found. Run: npm run build');
}

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Unified Server running and listening on 0.0.0.0:${PORT}`);

  // Start the existing Baileys bot only after the unified Render server is live.
  if (botStartup) {
    try {
      botStartup();
    } catch (err) {
      console.error('WhatsApp bot startup failed:', err);
    }
  }

  if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
      .then(() => {
        console.log('MongoDB Atlas Connected Successfully');
      })
      .catch((err) => {
        console.error('MongoDB connection failed:', err);
      });
  }
});
