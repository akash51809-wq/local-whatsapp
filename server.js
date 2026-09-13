const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const { app: botApp, startBot } = require('./index');

const app = express();
app.use(express.json());

const publicPath = path.join(__dirname, 'public');

// Health check
app.get('/ping', (req, res) => {
  res.status(200).send('OK - Alive');
});

// Mount index.js API routes & media static
app.use(botApp);

// Single static public folder for frontend
app.use(express.static(publicPath));

// SPA fallback for React frontend
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && req.path !== '/ping' && !req.path.startsWith('/media') && !req.path.startsWith('/send-text')) {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

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