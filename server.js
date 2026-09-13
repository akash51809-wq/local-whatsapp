const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const { app: botApp, startBot } = require('./index');

const app = express();
app.use(express.json());

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

// SPA fallback: every normal browser GET should load React's index.html.
// API/media routes are left to the backend instead of being swallowed by React.
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

// Helpful deployment diagnostic if the frontend build is missing
if (!fs.existsSync(path.join(distPath, 'index.html'))) {
  console.warn('WARNING: whatsapp-dashboard/dist/index.html not found. Run: npm run build');
}

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Unified Server running and listening on 0.0.0.0:${PORT}`);
  startBot();

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
