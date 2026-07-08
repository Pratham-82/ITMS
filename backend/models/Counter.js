const mongoose = require('mongoose');
const createTenantModelProxy = require('./tenantModelHelper');

const CounterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  seq: {
    type: Number,
    default: 1000
  }
}, { bypassTenantPlugin: true });

module.exports = createTenantModelProxy('Counter', CounterSchema);
