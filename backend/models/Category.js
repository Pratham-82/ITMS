const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const FieldSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'number', 'select'],
    default: 'text'
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [
    {
      type: String,
      trim: true
    }
  ]
});

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a category name'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  fields: [FieldSchema],
  ticketTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketType'
  }],
  calendar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessCalendar',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = createTenantModelProxy('Category', CategorySchema);
