const express = require('express');

const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Machine = require('../models/Machine');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

const router = express.Router();

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
        dueDate: {
          $lt: now,
        },
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

    const totalRevenue =
      paymentResult.length > 0
        ? paymentResult[0].totalRevenue
        : 0;

    res.status(200).json({
      customers: {
        total: totalCustomers,
      },

      services: {
        total: totalServices,
        active: activeServices,
        inactive:
          totalServices - activeServices,
      },

      machines: {
        total: totalMachines,
        active:
          totalMachines -
          maintenanceMachines,
        maintenance:
          maintenanceMachines,
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
// Revenue report based on payment paidAt date
// =====================================================
router.get('/revenue', async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const filter = {};

    if (from || to) {
      filter.paidAt = {};

      if (from) {
        const fromDate = new Date(from);

        if (Number.isNaN(fromDate.getTime())) {
          return res.status(400).json({
            message: 'Invalid from date',
          });
        }

        filter.paidAt.$gte = fromDate;
      }

      if (to) {
        const toDate = new Date(to);

        if (Number.isNaN(toDate.getTime())) {
          return res.status(400).json({
            message: 'Invalid to date',
          });
        }

        if (
          /^\d{4}-\d{2}-\d{2}$/.test(to)
        ) {
          toDate.setHours(
            23,
            59,
            59,
            999
          );
        }

        filter.paidAt.$lte = toDate;
      }

      if (
        filter.paidAt.$gte &&
        filter.paidAt.$lte &&
        filter.paidAt.$gte >
          filter.paidAt.$lte
      ) {
        return res.status(400).json({
          message:
            'From date cannot be later than to date',
        });
      }
    }

    const payments = await Payment.find(
      filter
    )
      .populate({
        path: 'order',
        select:
          'customer service totalPrice status',
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
      .sort({
        paidAt: -1,
      });

    const totalRevenue = payments.reduce(
      (sum, payment) =>
        sum + payment.amount,
      0
    );

    const paymentCount = payments.length;

    const byMethod = {
      cash: 0,
      gcash: 0,
      bank: 0,
    };

    payments.forEach((payment) => {
      if (
        Object.prototype.hasOwnProperty.call(
          byMethod,
          payment.method
        )
      ) {
        byMethod[payment.method] +=
          payment.amount;
      }
    });

    res.status(200).json({
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