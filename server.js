const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const { startWhatsAppBot } = require('./index');

const app = express();
app.use(express.json());

const distPath = path.join(__dirname, 'whatsapp-dashboard', 'dist');

// Static files first
app.use(express.static(distPath));

// Health check / ping
app.get('/ping', (req, res) => {
  res.status(200).send('OK - Alive');
});

// Explicit root '/'
app.get('/', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('index.html missing');
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path === '/ping') return;
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('index.html missing');
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