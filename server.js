const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const { startWhatsAppBot } = require('./index');

const app = express();
app.use(express.json());

const distPath = path.join(__dirname, 'whatsapp-dashboard', 'dist');

// Static assets serve karo
app.use(express.static(distPath));

// Ping route
app.get('/ping', (req, res) => {
  res.status(200).send('OK - Alive');
});

// ROOT '/' par sabse pehle React ka index.html bhejo
app.get('/', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('Frontend dist/index.html not found on server disk!');
});

// SPA fallback (React router / page refresh handle karne ke liye)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/ping')) {
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