const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  data: { type: Object, required: true },
});

module.exports = mongoose.model('SessionAuth', sessionSchema);