const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const { startWhatsAppBot } = require('./index');

const app = express();
app.use(express.json());

// 📁 Static folder serve karne ke liye (dashboard UI)
app.use(express.static(path.join(__dirname, 'whatsapp-dashboard')));

// Render free-tier keep-alive ping route
app.get('/ping', (req, res) => {
  res.status(200).send('OK - Alive');
});

// Root '/' kholne par dashboard.html load karne ke liye
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'whatsapp-dashboard', 'index.html'));
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Safe check for URI
if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI is undefined. Check your .env file path or variables.');
}

// Connect MongoDB and start WhatsApp bot
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