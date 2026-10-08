const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service is required'],
    },

    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      default: null,
    },

 
weightKg: {
  type: Number,
  required: [true, 'Weight is required'],
  min: [1, 'Weight must be at least 1 kg'],
  max: [15, 'Weight cannot exceed 15 kg'],
},


    discountPercent: {
      type: Number,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
      default: 0,
    },

    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price cannot be negative'],
    },

    status: {
      type: String,
      enum: {
        values: ['received', 'washing', 'ready', 'claimed', 'cancelled'],
        message:
          'Status must be received, washing, ready, claimed, or cancelled',
      },
      default: 'received',
    },

    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },

    claimedAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Order', orderSchema);