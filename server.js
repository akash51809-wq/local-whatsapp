const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const { startWhatsAppBot } = require('./index');

const app = express();
app.use(express.json());

const distPath = path.join(__dirname, 'whatsapp-dashboard', 'dist');

// 1. Health check
app.get('/ping', (req, res) => {
  res.status(200).send('OK - Alive');
});

// 2. Static files
app.use(express.static(distPath));

// 3. Safe SPA Fallback via pure middleware (zero path-to-regexp crash)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && req.path !== '/ping') {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running and listening on 0.0.0.0:${PORT}`);
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