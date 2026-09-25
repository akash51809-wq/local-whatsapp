const mongoose = require('mongoose');

const apiSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },
  token: { type: String, default: '' },
  isEnabled: { type: Boolean, default: true },
  webhookUrl: { type: String, default: '' },
  webhookEnabled: { type: Boolean, default: false },
  totalSent: { type: Number, default: 0 },
  lastUsed: { type: Date, default: null }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.models.WAApiSettings || mongoose.model('WAApiSettings', apiSettingsSchema);
