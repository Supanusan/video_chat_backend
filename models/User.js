const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    unique: true,
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
  reportsReceived: {
    type: Number,
    default: 0,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
