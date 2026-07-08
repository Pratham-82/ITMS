const mongoose = require('mongoose');

const GlobalUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  tenantId: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
}, { 
  timestamps: true,
  bypassTenantPlugin: true // Keeps this model registry in the central database
});

module.exports = mongoose.model('GlobalUser', GlobalUserSchema);
