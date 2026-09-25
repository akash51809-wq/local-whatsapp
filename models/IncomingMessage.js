const mongoose = require('mongoose');

const incomingMessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  chatJid: { type: String, required: true, index: true },
  ownerUserId: { type: String, default: null, index: true },
  from: { type: String, default: '' },
  fromMe: { type: Boolean, default: false },
  message: { type: String, default: '' },
  mediaType: { type: String, default: null },
  mediaUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  date: { type: String, default: () => new Date().toISOString(), index: true },
  timestamp: { type: Number, default: () => Date.now(), index: true },
  isRead: { type: Boolean, default: false },
  sessionPhone: { type: String, default: null },
  isGroup: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.models.WAIncomingMessage || mongoose.model('WAIncomingMessage', incomingMessageSchema);
