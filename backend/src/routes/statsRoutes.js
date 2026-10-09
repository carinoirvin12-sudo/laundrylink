
const express = require('express');

const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Machine = require('../models/Machine');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

const router = express.Router();

// =====================================================
// HELPERS
// =====================================================

// Use centavos to avoid floating-point errors.
const toCentavos = (amount) =>
  Math.round(Number(amount) * 100);

const toPesos = (centavos) =>
  Number((centavos / 100).toFixed(2));

// Convert a YYYY-MM-DD Philippine calendar date
// to its equivalent UTC timestamp.
//
// Example:
// 2026-10-09 00:00 in the Philippines
// equals 2026-10-08 16:00 UTC.
const parseManilaDate = (value, endOfDay = false) => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Validate that the calendar date actually exists.
  const calendarDate = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  // Philippine Standard Time is UTC+8.
  const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

  const startOfDayUTC =
    calendarDate.getTime() - MANILA_OFFSET_MS;

  if (endOfDay) {
    return new Date(
      startOfDayUTC + 24 * 60 * 60 * 1000 - 1
    );
  }

  return new Date(startOfDayUTC);
};

// =====================================================
// GET /api/stats/summary
// Dashboard statistics
// =====================================================

router.get('/summary', async (req, res, next) => {
  try {
    const now = new Date();

    const [
      totalCustomers,
      totalServices,
      activeServices,
      totalMachines,
      maintenanceMachines,
      totalOrders,
      receivedOrders,
      washingOrders,
      readyOrders,
      claimedOrders,
      cancelledOrders,
      overdueOrders,
      paymentResult,
    ] = await Promise.all([
      Customer.countDocuments(),

      Service.countDocuments(),

      Service.countDocuments({
        isActive: true,
      }),

      Machine.countDocuments(),

      Machine.countDocuments({
        status: 'maintenance',
      }),

      Order.countDocuments(),

      Order.countDocuments({
        status: 'received',
      }),

      Order.countDocuments({
        status: 'washing',
      }),

      Order.countDocuments({
        status: 'ready',
      }),

      Order.countDocuments({
        status: 'claimed',
      }),

      Order.countDocuments({
        status: 'cancelled',
      }),

      Order.countDocuments({
        status: 'ready',
        dueDate: { $lt: now },
        claimedAt: null,
      }),

      Payment.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$amount',
            },
          },
        },
      ]),
    ]);

    const rawRevenue =
      paymentResult.length > 0
        ? paymentResult[0].totalRevenue
        : 0;

    const totalRevenue = toPesos(
      toCentavos(rawRevenue)
    );

    return res.status(200).json({
      customers: {
        total: totalCustomers,
      },

      services: {
        total: totalServices,
        active: activeServices,
        inactive: totalServices - activeServices,
      },

      machines: {
        total: totalMachines,
        active: totalMachines - maintenanceMachines,
        maintenance: maintenanceMachines,
      },

      orders: {
        total: totalOrders,
        received: receivedOrders,
        washing: washingOrders,
        ready: readyOrders,
        claimed: claimedOrders,
        cancelled: cancelledOrders,
        overdue: overdueOrders,
      },

      revenue: {
        total: totalRevenue,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/stats/revenue?from=&to=
//
// Revenue report based on payment.paidAt.
//
// Date-only filters use Philippine Standard Time.
//
// Examples:
// /api/stats/revenue
// /api/stats/revenue?from=2026-10-01
// /api/stats/revenue?to=2026-10-09
// /api/stats/revenue?from=2026-10-01&to=2026-10-09
// =====================================================

router.get('/revenue', async (req, res, next) => {
  try {
    const { from, to } = req.query;

    // Reject unsupported date formats rather than
    // silently returning incorrect financial results.
    if (
      (from !== undefined &&
        (typeof from !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(from))) ||
      (to !== undefined &&
        (typeof to !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(to)))
    ) {
      return res.status(400).json({
        message: 'Dates must use YYYY-MM-DD format',
      });
    }

    const fromDate =
      from !== undefined
        ? parseManilaDate(from)
        : null;

    const toDate =
      to !== undefined
        ? parseManilaDate(to, true)
        : null;

    if (from !== undefined && !fromDate) {
      return res.status(400).json({
        message: 'Invalid from date',
      });
    }

    if (to !== undefined && !toDate) {
      return res.status(400).json({
        message: 'Invalid to date',
      });
    }

    if (
      fromDate &&
      toDate &&
      fromDate.getTime() > toDate.getTime()
    ) {
      return res.status(400).json({
        message:
          'From date cannot be later than to date',
      });
    }

    const filter = {};

    if (fromDate || toDate) {
      filter.paidAt = {};

      if (fromDate) {
        filter.paidAt.$gte = fromDate;
      }

      if (toDate) {
        filter.paidAt.$lte = toDate;
      }
    }

    // Get payments within the requested period.
    const payments = await Payment.find(filter)
      .populate({
        path: 'order',
        select: 'customer service totalPrice status',
        populate: [
          {
            path: 'customer',
            select: 'fullName',
          },
          {
            path: 'service',
            select: 'name',
          },
        ],
      })
      .sort({ paidAt: -1 });

    // =================================================
    // REVENUE CALCULATIONS
    // =================================================

    // Sum integer centavos for accurate totals.
    const totalRevenueCentavos = payments.reduce(
      (sum, payment) =>
        sum + toCentavos(payment.amount),
      0
    );

    const totalRevenue = toPesos(
      totalRevenueCentavos
    );

    const paymentCount = payments.length;

    // Payment method breakdown, also in centavos.
    const byMethodCentavos = {
      cash: 0,
      gcash: 0,
      bank: 0,
    };

    payments.forEach((payment) => {
      if (
        Object.prototype.hasOwnProperty.call(
          byMethodCentavos,
          payment.method
        )
      ) {
        byMethodCentavos[payment.method] +=
          toCentavos(payment.amount);
      }
    });

    const byMethod = {
      cash: toPesos(byMethodCentavos.cash),
      gcash: toPesos(byMethodCentavos.gcash),
      bank: toPesos(byMethodCentavos.bank),
    };

    // =================================================
    // API RESPONSE
    // =================================================

    return res.status(200).json({
      filters: {
        from: from || null,
        to: to || null,
      },

      totalRevenue,

      paymentCount,

      byMethod,

      payments,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
