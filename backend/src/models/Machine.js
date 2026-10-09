
const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Machine name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Machine name must be at least 2 characters'],
      maxlength: [100, 'Machine name cannot exceed 100 characters'],
    },

    type: {
      type: String,
      required: [true, 'Machine type is required'],
      enum: {
        values: ['washer', 'dryer'],
        message: 'Machine type must be washer or dryer',
      },
    },

    capacityKg: {
      type: Number,
      required: [true, 'Machine capacity is required'],
      min: [1, 'Machine capacity must be at least 1 kg'],
      max: [15, 'Machine capacity cannot exceed 15 kg'],
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'maintenance'],
        message: 'Machine status must be active or maintenance',
      },
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Machine', machineSchema);
