
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },

    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [1, 'Payment amount must be at least 1'],

      // Allow only valid peso amounts
      // with a maximum of 2 decimal places.
      validate: {
        validator: function (value) {
          if (!Number.isFinite(value)) {
            return false;
          }

          const centavos = value * 100;

          return (
            Math.abs(
              centavos - Math.round(centavos)
            ) < 0.0000001
          );
        },
        message:
          'Payment amount must have at most 2 decimal places',
      },
    },

    method: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: ['cash', 'gcash', 'bank'],
        message:
          'Payment method must be cash, gcash, or bank',
      },
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },

    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'Payment',
  paymentSchema
);
