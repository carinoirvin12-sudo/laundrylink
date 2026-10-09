
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

const toCentavos = (amount) =>
  Math.round(Number(amount) * 100);

const toPesos = (centavos) =>
  Number((centavos / 100).toFixed(2));

const PRIORITY_BY_NAME = {
  'Standard Laundry': 1,
  'Priority Laundry': 2,
  'Express Laundry': 3,
};

const getPriority = (serviceName) =>
  PRIORITY_BY_NAME[serviceName] || 1;

// Philippine Standard Time = UTC+8.
// Converts YYYY-MM-DD in Manila to UTC timestamps.
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

  const MANILA_OFFSET_MS =
    8 * 60 * 60 * 1000;

  const startOfDayUTC =
    calendarDate.getTime() -
    MANILA_OFFSET_MS;

  if (endOfDay) {
    return new Date(
      startOfDayUTC +
        24 * 60 * 60 * 1000 -
        1
    );
  }

  return new Date(startOfDayUTC);
};

// =====================================================
// GET /api/stats/summary
//
// Dashboard overview:
// - Customers
// - Services
// - Machines
// - Laundry workflow statuses
// - Overdue pickups
// - Overdue processing
// - Revenue
// =====================================================

router.get('/summary', async (req, res, next) => {
  try {
    const now = new Date();

    const [
      totalCustomers,
      totalServices,
      activeServices,
      machines,
      totalOrders,
      receivedOrders,
      washingOrders,
      dryingOrders,
      foldingOrders,
      readyOrders,
      claimedOrders,
      cancelledOrders,
      overduePickups,
      overdueProcessing,
      washingAssignments,
      dryingAssignments,
      paymentResult,
    ] = await Promise.all([
      Customer.countDocuments(),

      Service.countDocuments(),

      Service.countDocuments({
        isActive: true,
      }),

      Machine.find()
        .select('_id name type status')
        .lean(),

      Order.countDocuments(),

      Order.countDocuments({
        status: 'received',
      }),

      Order.countDocuments({
        status: 'washing',
      }),

      Order.countDocuments({
        status: 'drying',
      }),

      Order.countDocuments({
        status: 'folding',
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

      // Ready orders that missed their due date
      // and have not yet been claimed.
      Order.countDocuments({
        status: 'ready',
        dueDate: { $lt: now },
        claimedAt: null,
      }),

      // Orders still being processed after
      // their target due date.
      Order.countDocuments({
        status: {
          $in: [
            'received',
            'washing',
            'drying',
            'folding',
          ],
        },
        dueDate: { $lt: now },
      }),

      Order.find({
        status: 'washing',
      })
        .select('washer machine')
        .lean(),

      Order.find({
        status: 'drying',
      })
        .select('dryer')
        .lean(),

      Payment.find()
        .select('amount')
        .lean(),
    ]);

    // ==========================================
    // MACHINE AVAILABILITY
    // ==========================================

    const busyWasherIds = new Set();

    for (const order of washingAssignments) {
      const washerId =
        order.washer || order.machine;

      if (washerId) {
        busyWasherIds.add(
          washerId.toString()
        );
      }
    }

    const busyDryerIds = new Set();

    for (const order of dryingAssignments) {
      if (order.dryer) {
        busyDryerIds.add(
          order.dryer.toString()
        );
      }
    }

    let availableMachines = 0;
    let inUseMachines = 0;
    let maintenanceMachines = 0;

    let washerCount = 0;
    let dryerCount = 0;

    for (const machine of machines) {
      if (machine.type === 'washer') {
        washerCount += 1;
      }

      if (machine.type === 'dryer') {
        dryerCount += 1;
      }

      if (machine.status === 'maintenance') {
        maintenanceMachines += 1;
        continue;
      }

      const id = machine._id.toString();

      const isBusy =
        machine.type === 'washer'
          ? busyWasherIds.has(id)
          : busyDryerIds.has(id);

      if (isBusy) {
        inUseMachines += 1;
      } else {
        availableMachines += 1;
      }
    }

    // ==========================================
    // REVENUE
    // ==========================================

    // Sum integer centavos to avoid
    // floating-point accumulation errors.
    const totalRevenueCentavos =
      paymentResult.reduce(
        (sum, payment) =>
          sum + toCentavos(payment.amount),
        0
      );

    const totalRevenue = toPesos(
      totalRevenueCentavos
    );

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
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
        total: machines.length,
        active:
          machines.length -
          maintenanceMachines,
        maintenance: maintenanceMachines,

        available: availableMachines,
        inUse: inUseMachines,

        washers: washerCount,
        dryers: dryerCount,
      },

      orders: {
        total: totalOrders,

        received: receivedOrders,
        washing: washingOrders,
        drying: dryingOrders,
        folding: foldingOrders,
        ready: readyOrders,
        claimed: claimedOrders,
        cancelled: cancelledOrders,

        active:
          receivedOrders +
          washingOrders +
          dryingOrders +
          foldingOrders +
          readyOrders,

        // Backward compatibility with
        // the original dashboard.
        overdue: overduePickups,

        overduePickups,
        overdueProcessing,
      },

      priorityQueue: {
        waiting: receivedOrders,
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
// GET /api/stats/priority-queue
//
// Waiting orders in priority order:
// 1. Express Laundry
// 2. Priority Laundry
// 3. Standard Laundry
//
// FIFO within the same priority.
//
// This is a read-only queue view.
// It does not automatically start a machine.
// =====================================================

router.get(
  '/priority-queue',
  async (req, res, next) => {
    try {
      const orders = await Order.find({
        status: 'received',
      })
        .populate(
          'customer',
          'fullName phone'
        )
        .populate(
          'service',
          'name turnaroundHours'
        )
        .sort({ createdAt: 1 });

      const sortedOrders = orders.sort(
        (a, b) => {
          const priorityA = getPriority(
            a.service?.name
          );

          const priorityB = getPriority(
            b.service?.name
          );

          if (priorityA !== priorityB) {
            return priorityB - priorityA;
          }

          const timeDifference =
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime();

          if (timeDifference !== 0) {
            return timeDifference;
          }

          return a._id
            .toString()
            .localeCompare(
              b._id.toString()
            );
        }
      );

      return res.status(200).json(
        sortedOrders
      );
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// GET /api/stats/revenue?from=&to=
//
// Revenue based on actual payments.
//
// Date-only filters use Philippine time.
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

    if (
      (from !== undefined &&
        (
          typeof from !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(from)
        )) ||
      (to !== undefined &&
        (
          typeof to !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(to)
        ))
    ) {
      return res.status(400).json({
        message:
          'Dates must use YYYY-MM-DD format',
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
      fromDate.getTime() >
        toDate.getTime()
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

    // ==========================================
    // PAYMENT RECORDS
    // ==========================================

    const payments = await Payment.find(filter)
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
      .sort({ paidAt: -1 });

    // ==========================================
    // REVENUE CALCULATION
    // ==========================================

    const totalRevenueCentavos =
      payments.reduce(
        (sum, payment) =>
          sum + toCentavos(payment.amount),
        0
      );

    const totalRevenue = toPesos(
      totalRevenueCentavos
    );

    const paymentCount = payments.length;

    // ==========================================
    // PAYMENT METHOD BREAKDOWN
    // ==========================================

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
      cash: toPesos(
        byMethodCentavos.cash
      ),

      gcash: toPesos(
        byMethodCentavos.gcash
      ),

      bank: toPesos(
        byMethodCentavos.bank
      ),
    };

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
