const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const { startWhatsAppBot } = require('./index');

const app = express();
app.use(express.json());

const distPath = path.join(__dirname, 'whatsapp-dashboard', 'dist');
console.log(`[Diagnostic] Checking distPath: ${distPath}`);
console.log(`[Diagnostic] Exists? ${fs.existsSync(distPath)}`);
if (fs.existsSync(distPath)) {
  console.log(`[Diagnostic] Files inside dist:`, fs.readdirSync(distPath));
}

// Render keep-alive ping
app.get('/ping', (req, res) => {
  res.status(200).send('OK - Alive');
});

// Static assets if present
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Root route
app.get('/', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send(`Critical: dist/index.html missing at ${distPath}`);
});

// SPA fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/ping')) {
    const filePath = path.join(distPath, req.path);
    if (fs.existsSync(filePath) && fs.statStatusSafe ? true : fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

app.listen(PORT, () => {
  console.log(`Server running and listening on port ${PORT}`);
  if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
      .then(() => {
        console.log('MongoDB Atlas Connected Successfully');
        startWhatsAppBot('client_session_1');
      })
      .catch((err) => {
        console.error('MongoDB connection failed:', err);
      });
  }
});