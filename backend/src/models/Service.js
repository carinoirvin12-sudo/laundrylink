const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      unique: true,
      trim: true,
    },

    pricePerKg: {
      type: Number,
      required: [true, 'Price per kilogram is required'],
      min: [1, 'Price per kilogram must be at least 1'],
    },

    minCharge: {
      type: Number,
      min: [0, 'Minimum charge cannot be negative'],
      default: 0,
    },

    turnaroundHours: {
      type: Number,
      required: [true, 'Turnaround hours is required'],
      min: [1, 'Turnaround hours must be at least 1'],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Service', serviceSchema);