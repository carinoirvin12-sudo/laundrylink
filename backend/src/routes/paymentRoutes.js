
const express = require('express');
const mongoose = require('mongoose');

const Payment = require('../models/Payment');
const Order = require('../models/Order');

const router = express.Router();

const isValidId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

// Convert peso amounts to centavos.
const toCentavos = (amount) =>
  Math.round(Number(amount) * 100);

const toPesos = (centavos) =>
  Number((centavos / 100).toFixed(2));

// Create errors handled by centralized middleware.
const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// Lock the order document during payment operations.
// This coordinates with the transaction-based
// claiming and cancellation logic in orderRoutes.js.
const lockOrder = async (orderId, session) => {
  const result = await Order.collection.updateOne(
    {
      _id: new mongoose.Types.ObjectId(orderId),
    },
    {
      $currentDate: {
        updatedAt: true,
      },
    },
    {
      session,
    }
  );

  if (result.matchedCount === 0) {
    throw httpError(404, 'Order not found');
  }

  const order = await Order.findById(orderId)
    .session(session);

  if (!order) {
    throw httpError(404, 'Order not found');
  }

  return order;
};

// =====================================================
// GET /api/payments
// =====================================================

router.get('/', async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .populate({
        path: 'order',
        populate: {
          path: 'customer',
          select: 'fullName phone',
        },
      })
      .sort({ paidAt: -1 });

    return res.status(200).json(payments);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/payments
//
// - Validate payment input
// - Block payments to cancelled/claimed orders
// - Prevent overpayment
// - Support partial/full payments
// - Use a MongoDB transaction
// =====================================================

router.post('/', async (req, res, next) => {
  try {
    const {
      order: orderId,
      amount,
      method,
      remarks,
    } = req.body;

    // Validate order ID.
    if (!isValidId(orderId)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    // Accept only actual JSON numbers.
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount < 1
    ) {
      return res.status(400).json({
        message:
          'Payment amount must be a valid number of at least 1',
      });
    }

    // Convert to centavos for accurate comparisons.
    const paymentCentavos = toCentavos(amount);

    // Maximum 2 decimal places.
    if (
      Math.abs(amount * 100 - paymentCentavos) >
      0.000001
    ) {
      return res.status(400).json({
        message:
          'Payment amount must have at most 2 decimal places',
      });
    }

    // Validate payment method.
    if (
      typeof method !== 'string' ||
      !['cash', 'gcash', 'bank'].includes(method)
    ) {
      return res.status(400).json({
        message:
          'Payment method must be cash, gcash, or bank',
      });
    }

    // Validate optional remarks.
    if (
      remarks !== undefined &&
      remarks !== null &&
      typeof remarks !== 'string'
    ) {
      return res.status(400).json({
        message: 'Remarks must be a string',
      });
    }

    const cleanRemarks =
      typeof remarks === 'string'
        ? remarks.trim()
        : '';

    const session = await mongoose.startSession();

    try {
      let responseData;

      await session.withTransaction(async () => {
        // Lock the order before checking its balance.
        const order = await lockOrder(
          orderId,
          session
        );

        // Block payments to cancelled orders.
        if (order.status === 'cancelled') {
          throw httpError(
            409,
            'Cannot add payment to a cancelled order'
          );
        }

        // Block payments to claimed orders.
        if (order.status === 'claimed') {
          throw httpError(
            409,
            'Cannot add payment to a claimed order'
          );
        }

        // Retrieve existing payments.
        const previousPayments = await Payment.find({
          order: orderId,
        }).session(session);

        const totalPaidCentavos =
          previousPayments.reduce(
            (sum, payment) =>
              sum + toCentavos(payment.amount),
            0
          );

        const totalPriceCentavos =
          toCentavos(order.totalPrice);

        const balanceCentavos =
          totalPriceCentavos - totalPaidCentavos;

        // Prevent payments on fully paid orders.
        if (balanceCentavos <= 0) {
          throw httpError(
            400,
            'Order is already fully paid'
          );
        }

        // Prevent overpayment.
        if (paymentCentavos > balanceCentavos) {
          throw httpError(
            400,
            'Payment exceeds remaining balance'
          );
        }

        // Create payment within the transaction.
        const createdPayments =
          await Payment.create(
            [
              {
                order: orderId,
                amount: toPesos(paymentCentavos),
                method,
                remarks: cleanRemarks,
              },
            ],
            {
              session,
            }
          );

        const payment = createdPayments[0];

        const newTotalPaidCentavos =
          totalPaidCentavos + paymentCentavos;

        const newBalanceCentavos =
          totalPriceCentavos - newTotalPaidCentavos;

        responseData = {
          payment,
          totalPrice: toPesos(totalPriceCentavos),
          totalPaid: toPesos(newTotalPaidCentavos),
          balance: toPesos(newBalanceCentavos),
          paymentStatus:
            newBalanceCentavos === 0
              ? 'paid'
              : 'partial',
        };
      });

      return res.status(201).json(responseData);
    } finally {
      await session.endSession();
    }
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/payments/:id
// =====================================================

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid payment ID',
      });
    }

    const payment = await Payment.findById(id)
      .populate({
        path: 'order',
        populate: {
          path: 'customer',
          select: 'fullName phone',
        },
      });

    if (!payment) {
      return res.status(404).json({
        message: 'Payment not found',
      });
    }

    return res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/payments/:id
//
// - Validate payment ID
// - Protect claimed-order payment history
// - Use transaction and order locking
// =====================================================

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid payment ID',
      });
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const payment = await Payment.findById(id)
          .session(session);

        if (!payment) {
          throw httpError(
            404,
            'Payment not found'
          );
        }

        if (!payment.order) {
          throw httpError(
            409,
            'Payment has no associated order'
          );
        }

        // Lock the related order.
        const order = await lockOrder(
          payment.order.toString(),
          session
        );

        // Claimed transactions must keep
        // their payment history.
        if (order.status === 'claimed') {
          throw httpError(
            409,
            'Cannot delete payment because the order is already claimed'
          );
        }

        // Delete payment within the transaction.
        const deletedPayment =
          await Payment.findByIdAndDelete(id)
            .session(session);

        if (!deletedPayment) {
          throw httpError(
            404,
            'Payment not found'
          );
        }
      });

      return res.status(200).json({
        message: 'Payment deleted successfully',
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
