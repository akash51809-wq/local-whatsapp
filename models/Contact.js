const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: null },
  notify: { type: String, default: null },
  verifiedName: { type: String, default: null },
  phone: { type: String, default: null, index: true },
  lid: { type: String, default: null, index: true },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  strict: false
});

module.exports = mongoose.models.WAContact || mongoose.model('WAContact', contactSchema);
