const express = require('express');
const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

const router = express.Router();

const isValidId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

// =====================================================
// GET /api/customers
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const customers = await Customer.find().sort({
      fullName: 1,
    });

    res.status(200).json(customers);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/customers
// =====================================================
router.post('/', async (req, res, next) => {
  try {
    const {
      fullName,
      phone,
      address,
    } = req.body;

    const customer = await Customer.create({
      fullName,
      phone,
      address,
    });

    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/customers/:id/summary
// =====================================================
router.get('/:id/summary', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid customer ID',
      });
    }

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found',
      });
    }

    const orders = await Order.find({
      customer: id,
    })
      .populate(
        'service',
        'name pricePerKg minCharge turnaroundHours'
      )
      .populate(
        'machine',
        'name type capacityKg status'
      )
      .sort({ createdAt: -1 });

    const orderIds = orders.map(
      (order) => order._id
    );

    const payments = await Payment.find({
      order: {
        $in: orderIds,
      },
    });

    const totalPaid = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    const totalOrderValue = orders
      .filter(
        (order) =>
          order.status !== 'cancelled'
      )
      .reduce(
        (sum, order) =>
          sum + order.totalPrice,
        0
      );

    const claimedOrders = orders.filter(
      (order) =>
        order.status === 'claimed'
    ).length;

    const activeOrders = orders.filter(
      (order) =>
        ![
          'claimed',
          'cancelled',
        ].includes(order.status)
    ).length;

    const cancelledOrders = orders.filter(
      (order) =>
        order.status === 'cancelled'
    ).length;

    const outstandingBalance = Math.max(
      totalOrderValue - totalPaid,
      0
    );

 
res.status(200).json({
  customer,
  summary: {
    totalOrders: orders.length,
    claimedOrders,
    activeOrders,
    cancelledOrders,
    totalOrderValue,
    totalPaid,
    outstandingBalance,

    // Customer loyalty information
    isLoyalCustomer: claimedOrders >= 5,
    loyaltyDiscountPercent: claimedOrders >= 5 ? 5 : 0,
  },
  orders,
});

  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/customers/:id
// =====================================================
router.get('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid customer ID',
      });
    }

    const customer = await Customer.findById(
      req.params.id
    );

    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found',
      });
    }

    res.status(200).json(customer);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/customers/:id
// =====================================================
router.put('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid customer ID',
      });
    }

    const {
      fullName,
      phone,
      address,
    } = req.body;

    const customer =
      await Customer.findByIdAndUpdate(
        req.params.id,
        {
          fullName,
          phone,
          address,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found',
      });
    }

    res.status(200).json(customer);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/customers/:id
// =====================================================
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid customer ID',
      });
    }

    const customer = await Customer.findById(
      req.params.id
    );

    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found',
      });
    }

    const referencedOrder =
      await Order.exists({
        customer: req.params.id,
      });

    if (referencedOrder) {
      return res.status(409).json({
        message:
          'Cannot delete customer because it is referenced by an order',
      });
    }

    await Customer.findByIdAndDelete(
      req.params.id
    );

    res.status(200).json({
      message:
        'Customer deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;