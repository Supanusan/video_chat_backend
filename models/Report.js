const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterIp: {
    type: String,
    required: true,
  },
  reportedIp: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    enum: ['inappropriate', 'spam', 'harassment', 'other'],
    default: 'inappropriate'
  },
  resolved: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
