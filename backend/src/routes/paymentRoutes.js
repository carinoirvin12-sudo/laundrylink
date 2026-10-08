
const express = require('express');
const mongoose = require('mongoose');

const Payment = require('../models/Payment');
const Order = require('../models/Order');

const router = express.Router();

const isValidId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

// Convert peso amounts to centavos for calculations.
const toCentavos = (amount) =>
  Math.round(Number(amount) * 100);

const toPesos = (centavos) =>
  Number((centavos / 100).toFixed(2));

// Create an error that the centralized error handler
// can convert to the correct HTTP response.
const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// Update the order document inside a transaction.
// Concurrent payment requests for the same order
// will conflict and be retried or rejected by MongoDB.
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

  return Order.findById(orderId).session(session);
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

    res.status(200).json(payments);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/payments
//
// Add a payment using a MongoDB transaction.
// Prevent:
// - Invalid payment amounts
// - Payments to cancelled orders
// - Payments to claimed orders
// - Overpayment
// - Concurrent overpayment
// =====================================================
router.post('/', async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const {
      order: orderId,
      amount,
      method,
      remarks,
    } = req.body;

    if (!isValidId(orderId)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    const paymentAmount = Number(amount);

    if (
      amount === null ||
      amount === undefined ||
      amount === '' ||
      !Number.isFinite(paymentAmount) ||
      paymentAmount < 1
    ) {
      return res.status(400).json({
        message:
          'Payment amount must be at least 1',
      });
    }

    const paymentCentavos =
      toCentavos(paymentAmount);

    if (
      Math.abs(
        paymentAmount * 100 - paymentCentavos
      ) > 0.000001
    ) {
      return res.status(400).json({
        message:
          'Payment amount must have at most 2 decimal places',
      });
    }

    let responseData;

    await session.withTransaction(async () => {
      // Serialize writes for this order.
      const order = await lockOrder(
        orderId,
        session
      );

      if (order.status === 'cancelled') {
        throw httpError(
          409,
          'Cannot add payment to a cancelled order'
        );
      }

      if (order.status === 'claimed') {
        throw httpError(
          409,
          'Cannot add payment to a claimed order'
        );
      }

      // Read payments within the same transaction.
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

      if (balanceCentavos <= 0) {
        throw httpError(
          400,
          'Order is already fully paid'
        );
      }

      if (paymentCentavos > balanceCentavos) {
        throw httpError(
          400,
          'Payment exceeds remaining balance'
        );
      }

      // The payment and order update belong to
      // one atomic transaction.
      const createdPayments =
        await Payment.create(
          [
            {
              order: orderId,
              amount: toPesos(paymentCentavos),
              method,
              remarks: remarks || '',
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
        totalPriceCentavos -
        newTotalPaidCentavos;

      responseData = {
        payment,
        totalPrice: toPesos(
          totalPriceCentavos
        ),
        totalPaid: toPesos(
          newTotalPaidCentavos
        ),
        balance: toPesos(
          newBalanceCentavos
        ),
        paymentStatus:
          newBalanceCentavos === 0
            ? 'paid'
            : 'partial',
      };
    });

    res.status(201).json(responseData);
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

// =====================================================
// GET /api/payments/:id
// =====================================================
router.get('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid payment ID',
      });
    }

    const payment = await Payment.findById(
      req.params.id
    ).populate({
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

    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/payments/:id
//
// Do not allow deletion of payments belonging
// to claimed orders.
// =====================================================
router.delete('/:id', async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid payment ID',
      });
    }

    await session.withTransaction(async () => {
      const payment = await Payment.findById(
        req.params.id
      ).session(session);

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

      // Lock the related order before deleting.
      const order = await lockOrder(
        payment.order.toString(),
        session
      );

      if (order.status === 'claimed') {
        throw httpError(
          409,
          'Cannot delete payment because the order is already claimed'
        );
      }

      await Payment.findByIdAndDelete(
        req.params.id
      ).session(session);
    });

    res.status(200).json({
      message:
        'Payment deleted successfully',
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

module.exports = router;
