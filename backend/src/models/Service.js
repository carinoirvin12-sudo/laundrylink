
const mongoose = require('mongoose');

const hasAtMostTwoDecimals = (value) =>
  Number.isFinite(value) &&
  Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Service name must be at least 2 characters'],
      maxlength: [100, 'Service name cannot exceed 100 characters'],
    },

    pricePerKg: {
      type: Number,
      required: [true, 'Price per kilogram is required'],
      min: [1, 'Price per kilogram must be at least 1'],
      validate: {
        validator: hasAtMostTwoDecimals,
        message: 'Price per kilogram must have at most 2 decimal places',
      },
    },

    minCharge: {
      type: Number,
      default: 0,
      min: [0, 'Minimum charge cannot be negative'],
      validate: {
        validator: hasAtMostTwoDecimals,
        message: 'Minimum charge must have at most 2 decimal places',
      },
    },

    turnaroundHours: {
      type: Number,
      required: [true, 'Turnaround hours is required'],
      min: [1, 'Turnaround hours must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Turnaround hours must be a whole number',
      },
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
