const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const { startWhatsAppBot } = require('./index');

const app = express();
app.use(express.json());

const distPath = path.join(__dirname, 'whatsapp-dashboard', 'dist');

// Check and serve static files from dist folder
if (fs.existsSync(distPath)) {
  console.log(`[Frontend] Serving static files from ${distPath}`);
  app.use(express.static(distPath));
} else {
  console.warn(`[WARNING] Dist folder not found at ${distPath}.`);
}

// Render free-tier keep-alive ping route
app.get('/ping', (req, res) => {
  res.status(200).send('OK - Alive');
});

// Safe SPA fallback middleware (bypasses path-to-regexp wildcard crash)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/ping') && !req.path.startsWith('/api')) {
    const filePath = path.join(distPath, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    } else {
      return res.status(404).send('Frontend build index.html not found. Ensure build command runs `npm run build`.');
    }
  }
  next();
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI is undefined. Check your environment variables.');
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB Atlas Connected Successfully');
    startWhatsAppBot('client_session_1');
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err);
  });

app.listen(PORT, () => {
  console.log(`Server running and listening on port ${PORT}`);
});