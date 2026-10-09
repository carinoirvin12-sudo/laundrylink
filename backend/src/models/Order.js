
const mongoose = require('mongoose');

const hasAtMostTwoDecimals = (value) =>
  Number.isFinite(value) &&
  Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;

const orderSchema = new mongoose.Schema(
  {
    // ==========================================
    // CUSTOMER AND SERVICE
    // ==========================================

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

    // ==========================================
    // MACHINE ASSIGNMENTS
    // ==========================================

    // Legacy field retained for compatibility.
    // The new workflow uses washer and dryer.
    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      default: null,
    },

    washer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      default: null,
    },

    dryer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      default: null,
    },

    // ==========================================
    // LAUNDRY DETAILS
    // ==========================================

    weightKg: {
      type: Number,
      required: [true, 'Weight is required'],
      min: [1, 'Weight must be at least 1 kg'],
      max: [15, 'Weight cannot exceed 15 kg'],
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },

    // ==========================================
    // PRICING
    // ==========================================

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
      validate: {
        validator: hasAtMostTwoDecimals,
        message:
          'Total price must have at most 2 decimal places',
      },
    },

    // ==========================================
    // ORDER WORKFLOW
    // ==========================================

    status: {
      type: String,
      enum: {
        values: [
          'received',
          'washing',
          'drying',
          'folding',
          'ready',
          'claimed',
          'cancelled',
        ],
        message: 'Invalid laundry order status',
      },
      default: 'received',
    },

    // ==========================================
    // WORKFLOW TIMESTAMPS
    // ==========================================

    washingStartedAt: {
      type: Date,
      default: null,
    },

    dryingStartedAt: {
      type: Date,
      default: null,
    },

    foldingStartedAt: {
      type: Date,
      default: null,
    },

    readyAt: {
      type: Date,
      default: null,
    },

    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },

    claimedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Used for sorting orders by service and due date.
orderSchema.index({
  status: 1,
  dueDate: 1,
});

module.exports = mongoose.model('Order', orderSchema);
