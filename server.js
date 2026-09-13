const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const { startWhatsAppBot } = require('./index');

const app = express();
app.use(express.json());

const distPath = path.join(__dirname, 'whatsapp-dashboard', 'dist');

// Check karo ki dist folder ban gaya hai ya nahi
if (fs.existsSync(distPath)) {
  console.log(`[Frontend] Serving static files from ${distPath}`);
  app.use(express.static(distPath));
} else {
  console.warn(`[WARNING] Dist folder not found at ${distPath}. Run build first!`);
}

// Render free-tier keep-alive ping route
app.get('/ping', (req, res) => {
  res.status(200).send('OK - Alive');
});

// SPA catch-all fallback route
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend dist/index.html not found! Ensure build command ran `npm run build` inside whatsapp-dashboard.');
  }
});