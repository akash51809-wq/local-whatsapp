const mongoose = require('mongoose');

const messageReportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  date: { type: String, required: true, index: true },
  ownerUserId: { type: String, default: null, index: true },
  from: { type: String, default: '' },
  to: { type: String, default: '' },
  message: { type: String, default: '' },
  status: { type: String, default: 'sent', index: true },
  session: { type: String, default: '' },
  type: { type: String, default: 'text' },
  source: { type: String, default: 'web' },
  recipient: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.models.WAMessageReport || mongoose.model('WAMessageReport', messageReportSchema);
