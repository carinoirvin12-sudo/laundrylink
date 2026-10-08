
const express = require('express');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Machine = require('../models/Machine');
const Payment = require('../models/Payment');

const router = express.Router();

const BUSY_ORDER_STATUSES = ['received', 'washing'];

const ORDER_STATUSES = [
  'received',
  'washing',
  'ready',
  'claimed',
  'cancelled',
];

const isValidId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const toCentavos = (value) =>
  Math.round(Number(value) * 100);

const toPesos = (centavos) =>
  Number((centavos / 100).toFixed(2));

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const populateOrder = (query) =>
  query
    .populate('customer', 'fullName phone address')
    .populate(
      'service',
      'name pricePerKg minCharge turnaroundHours'
    )
    .populate(
      'machine',
      'name type capacityKg status'
    );

// =====================================================
// HELPERS
// =====================================================

// Calculate bulk and loyalty discounts.
// Use only the highest applicable discount.
const calculateOrderPrice = async (
  customerId,
  service,
  weightKg
) => {
  const pricePerKgCentavos = toCentavos(
    service.pricePerKg
  );

  const minimumChargeCentavos = toCentavos(
    service.minCharge
  );

  const subtotalCentavos = Math.max(
    Math.round(weightKg * pricePerKgCentavos),
    minimumChargeCentavos
  );

  const claimedOrders = await Order.countDocuments({
    customer: customerId,
    status: 'claimed',
  });

  let discountPercent = 0;

  if (weightKg >= 10) {
    discountPercent = 10;
  }

  if (claimedOrders >= 5) {
    discountPercent = Math.max(discountPercent, 5);
  }

  const discountCentavos = Math.round(
    subtotalCentavos * (discountPercent / 100)
  );

  const totalCentavos =
    subtotalCentavos - discountCentavos;

  return {
    subtotal: toPesos(subtotalCentavos),
    discountPercent,
    totalPrice: toPesos(totalCentavos),
  };
};

// Check whether a machine can handle an order.
const validateMachine = async (
  machineId,
  weightKg,
  excludedOrderId = null
) => {
  if (!machineId) {
    return {
      error: {
        status: 400,
        message: 'Please select a machine',
      },
    };
  }

  if (!isValidId(machineId)) {
    return {
      error: {
        status: 400,
        message: 'Invalid machine ID',
      },
    };
  }

  const machine = await Machine.findById(machineId);

  if (!machine) {
    return {
      error: {
        status: 404,
        message: 'Machine not found',
      },
    };
  }

  if (machine.status === 'maintenance') {
    return {
      error: {
        status: 409,
        message: 'Machine is under maintenance',
      },
    };
  }

  if (weightKg > machine.capacityKg) {
    return {
      error: {
        status: 409,
        message: 'Order weight exceeds machine capacity',
      },
    };
  }

  const busyFilter = {
    machine: machineId,
    status: {
      $in: BUSY_ORDER_STATUSES,
    },
  };

  if (excludedOrderId) {
    busyFilter._id = {
      $ne: excludedOrderId,
    };
  }

  const busyOrder = await Order.findOne(busyFilter);

  if (busyOrder) {
    return {
      error: {
        status: 409,
        message: 'Machine is currently in use',
      },
    };
  }

  return { machine };
};

// Create order for an existing customer.
const createLaundryOrder = async ({
  customerId,
  serviceId,
  machineId,
  weightKg,
  notes,
}) => {
  if (!isValidId(customerId)) {
    return {
      error: {
        status: 400,
        message: 'Invalid customer ID',
      },
    };
  }

  if (!isValidId(serviceId)) {
    return {
      error: {
        status: 400,
        message: 'Invalid service ID',
      },
    };
  }

  const weight = Number(weightKg);

  if (
    weightKg === null ||
    weightKg === undefined ||
    weightKg === '' ||
    !Number.isFinite(weight) ||
    weight < 1 ||
    weight > 15
  ) {
    return {
      error: {
        status: 400,
        message: 'Weight must be between 1 and 15 kg',
      },
    };
  }

  const customer = await Customer.findById(customerId);

  if (!customer) {
    return {
      error: {
        status: 404,
        message: 'Customer not found',
      },
    };
  }

  const service = await Service.findById(serviceId);

  if (!service) {
    return {
      error: {
        status: 404,
        message: 'Service not found',
      },
    };
  }

  if (!service.isActive) {
    return {
      error: {
        status: 400,
        message: 'Selected service is inactive',
      },
    };
  }

  const machineResult = await validateMachine(
    machineId,
    weight
  );

  if (machineResult.error) {
    return machineResult;
  }

  const pricing = await calculateOrderPrice(
    customerId,
    service,
    weight
  );

  const dueDate = new Date(
    Date.now() +
      service.turnaroundHours * 60 * 60 * 1000
  );

  const order = await Order.create({
    customer: customerId,
    service: serviceId,
    machine: machineId,
    weightKg: weight,
    discountPercent: pricing.discountPercent,
    totalPrice: pricing.totalPrice,
    status: 'received',
    dueDate,
    notes: notes || '',
  });

  const populatedOrder = await populateOrder(
    Order.findById(order._id)
  );

  return {
    order: populatedOrder,
    pricing,
  };
};

// =====================================================
// GET /api/orders
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const orders = await populateOrder(
      Order.find().sort({ createdAt: -1 })
    );

    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/orders/pos
// Create an order with a new or existing customer.
// =====================================================
router.post('/pos', async (req, res, next) => {
  let createdCustomer = null;

  try {
    const {
      customerType,
      customer,
      customerId,
      service,
      machine,
      weightKg,
      notes,
    } = req.body;

    if (!['new', 'existing'].includes(customerType)) {
      return res.status(400).json({
        message:
          'Customer type must be new or existing',
      });
    }

    let selectedCustomerId;

    if (customerType === 'new') {
      if (
        !customer ||
        typeof customer.fullName !== 'string' ||
        typeof customer.phone !== 'string' ||
        !customer.fullName.trim() ||
        !customer.phone.trim()
      ) {
        return res.status(400).json({
          message:
            'Customer name and phone number are required',
        });
      }

      const duplicatePhone = await Customer.findOne({
        phone: customer.phone.trim(),
      });

      if (duplicatePhone) {
        return res.status(409).json({
          message:
            'A customer with this phone number already exists. Please use Existing Customer.',
          customerId: duplicatePhone._id,
        });
      }

      createdCustomer = await Customer.create({
        fullName: customer.fullName.trim(),
        phone: customer.phone.trim(),
        address:
          typeof customer.address === 'string'
            ? customer.address.trim()
            : '',
      });

      selectedCustomerId = createdCustomer._id;
    }

    if (customerType === 'existing') {
      if (!customerId || !isValidId(customerId)) {
        return res.status(400).json({
          message:
            'Please select a valid existing customer',
        });
      }

      const existingCustomer =
        await Customer.findById(customerId);

      if (!existingCustomer) {
        return res.status(404).json({
          message: 'Customer not found',
        });
      }

      selectedCustomerId = existingCustomer._id;
    }

    const result = await createLaundryOrder({
      customerId: selectedCustomerId,
      serviceId: service,
      machineId: machine,
      weightKg,
      notes,
    });

    if (result.error) {
      if (createdCustomer) {
        await Customer.findByIdAndDelete(
          createdCustomer._id
        );
        createdCustomer = null;
      }

      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }

    res.status(201).json({
      message: 'Laundry order created successfully',
      customerCreated: customerType === 'new',
      order: result.order,
      pricing: result.pricing,
    });
  } catch (error) {
    // Best-effort cleanup if the new customer
    // was created but order creation failed.
    if (createdCustomer) {
      try {
        const hasOrder = await Order.exists({
          customer: createdCustomer._id,
        });

        if (!hasOrder) {
          await Customer.findByIdAndDelete(
            createdCustomer._id
          );
        }
      } catch (cleanupError) {
        console.error(
          'POS customer cleanup failed:',
          cleanupError
        );
      }
    }

    next(error);
  }
});

// =====================================================
// POST /api/orders
// Existing customer order creation.
// =====================================================
router.post('/', async (req, res, next) => {
  try {
    const {
      customer,
      service,
      machine,
      weightKg,
      notes,
    } = req.body;

    const result = await createLaundryOrder({
      customerId: customer,
      serviceId: service,
      machineId: machine,
      weightKg,
      notes,
    });

    if (result.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }

    res.status(201).json({
      order: result.order,
      pricing: result.pricing,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/orders/quote
// Preview order pricing before creating the order.
// =====================================================
router.post('/quote', async (req, res, next) => {
  try {
    const {
      customer: customerId,
      service: serviceId,
      weightKg,
    } = req.body;

    if (!isValidId(customerId)) {
      return res.status(400).json({
        message: 'Invalid customer ID',
      });
    }

    if (!isValidId(serviceId)) {
      return res.status(400).json({
        message: 'Invalid service ID',
      });
    }

    const weight = Number(weightKg);

    if (
      weightKg === null ||
      weightKg === undefined ||
      weightKg === '' ||
      !Number.isFinite(weight) ||
      weight < 1 ||
      weight > 15
    ) {
      return res.status(400).json({
        message: 'Weight must be between 1 and 15 kg',
      });
    }

    const customer = await Customer.findById(
      customerId
    );

    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found',
      });
    }

    const service = await Service.findById(
      serviceId
    );

    if (!service) {
      return res.status(404).json({
        message: 'Service not found',
      });
    }

    if (!service.isActive) {
      return res.status(400).json({
        message: 'Selected service is inactive',
      });
    }

    const pricing = await calculateOrderPrice(
      customerId,
      service,
      weight
    );

    const dueDate = new Date(
      Date.now() +
        service.turnaroundHours * 60 * 60 * 1000
    );

    res.status(200).json({
      customer: {
        id: customer._id,
        fullName: customer.fullName,
      },
      service: {
        id: service._id,
        name: service.name,
        pricePerKg: service.pricePerKg,
        minCharge: service.minCharge,
        turnaroundHours: service.turnaroundHours,
      },
      weightKg: weight,
      ...pricing,
      dueDate,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/orders/overdue
// =====================================================
router.get('/overdue', async (req, res, next) => {
  try {
    const orders = await populateOrder(
      Order.find({
        status: 'ready',
        dueDate: { $lt: new Date() },
        claimedAt: null,
      }).sort({ dueDate: 1 })
    );

    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/orders/search
// =====================================================
router.get('/search', async (req, res, next) => {
  try {
    const {
      status,
      customer,
      service,
      from,
      to,
      sort,
    } = req.query;

    const filter = {};

    if (status) {
      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({
          message: 'Invalid order status',
        });
      }

      filter.status = status;
    }

    if (customer) {
      if (!isValidId(customer)) {
        return res.status(400).json({
          message: 'Invalid customer ID',
        });
      }

      filter.customer = customer;
    }

    if (service) {
      if (!isValidId(service)) {
        return res.status(400).json({
          message: 'Invalid service ID',
        });
      }

      filter.service = service;
    }

    if (from || to) {
      filter.createdAt = {};

      if (from) {
        const fromDate = new Date(from);

        if (Number.isNaN(fromDate.getTime())) {
          return res.status(400).json({
            message: 'Invalid from date',
          });
        }

        filter.createdAt.$gte = fromDate;
      }

      if (to) {
        const toDate = new Date(to);

        if (Number.isNaN(toDate.getTime())) {
          return res.status(400).json({
            message: 'Invalid to date',
          });
        }

        if (
          typeof to === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(to)
        ) {
          toDate.setUTCHours(23, 59, 59, 999);
        }

        filter.createdAt.$lte = toDate;
      }

      if (
        filter.createdAt.$gte &&
        filter.createdAt.$lte &&
        filter.createdAt.$gte >
          filter.createdAt.$lte
      ) {
        return res.status(400).json({
          message:
            'From date cannot be later than to date',
        });
      }
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      dueSoon: { dueDate: 1 },
      dueLatest: { dueDate: -1 },
      priceHigh: { totalPrice: -1 },
      priceLow: { totalPrice: 1 },
    };

    if (sort && !sortOptions[sort]) {
      return res.status(400).json({
        message: 'Invalid sort option',
      });
    }

    const orders = await populateOrder(
      Order.find(filter).sort(
        sortOptions[sort] || sortOptions.newest
      )
    );

    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/orders/:id/balance
// =====================================================
router.get('/:id/balance', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    const payments = await Payment.find({
      order: id,
    }).sort({ paidAt: -1 });

    const totalPriceCentavos = toCentavos(
      order.totalPrice
    );

    const totalPaidCentavos = payments.reduce(
      (sum, payment) =>
        sum + toCentavos(payment.amount),
      0
    );

    const balanceCentavos = Math.max(
      totalPriceCentavos - totalPaidCentavos,
      0
    );

    let paymentStatus = 'unpaid';

    if (totalPaidCentavos >= totalPriceCentavos) {
      paymentStatus = 'paid';
    } else if (totalPaidCentavos > 0) {
      paymentStatus = 'partial';
    }

    res.status(200).json({
      orderId: order._id,
      totalPrice: toPesos(totalPriceCentavos),
      totalPaid: toPesos(totalPaidCentavos),
      balance: toPesos(balanceCentavos),
      paymentStatus,
      payments,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// PATCH /api/orders/:id/status
// =====================================================

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, machine: machineId } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Invalid order status',
      });
    }

    const transitions = {
      received: ['washing', 'cancelled'],
      washing: ['ready'],
      ready: ['claimed'],
      claimed: [],
      cancelled: [],
    };

    // CANCEL ORDER
    // Cancellation and payment operations use
    // transactions that write-lock the same order.
    if (status === 'cancelled') {
      const session = await mongoose.startSession();

      let cancelledOrderId;

      try {
        await session.withTransaction(async () => {
          const lockResult =
            await Order.collection.updateOne(
              {
                _id: new mongoose.Types.ObjectId(id),
              },
              {
                $currentDate: {
                  updatedAt: true,
                },
              },
              { session }
            );

          if (lockResult.matchedCount === 0) {
            throw httpError(404, 'Order not found');
          }

          const order = await Order.findById(id)
            .session(session);

          if (
            !transitions[order.status].includes(
              'cancelled'
            )
          ) {
            throw httpError(
              409,
              `Cannot change order status from ${order.status} to cancelled`
            );
          }

          const existingPayment = await Payment.exists({
            order: order._id,
          }).session(session);

          if (existingPayment) {
            throw httpError(
              409,
              'Cannot cancel an order with recorded payments'
            );
          }

          order.status = 'cancelled';

          await order.save({ session });

          cancelledOrderId = order._id;
        });
      } finally {
        await session.endSession();
      }

      const updatedOrder = await populateOrder(
        Order.findById(cancelledOrderId)
      );

      return res.status(200).json(updatedOrder);
    }

    // CLAIM ORDER
    // Must be Ready and fully paid.
    if (status === 'claimed') {
      const session = await mongoose.startSession();

      let claimedOrderId;

      try {
        await session.withTransaction(async () => {
          const lockResult =
            await Order.collection.updateOne(
              {
                _id: new mongoose.Types.ObjectId(id),
              },
              {
                $currentDate: {
                  updatedAt: true,
                },
              },
              { session }
            );

          if (lockResult.matchedCount === 0) {
            throw httpError(404, 'Order not found');
          }

          const order = await Order.findById(id)
            .session(session);

          if (
            !transitions[order.status].includes(
              'claimed'
            )
          ) {
            throw httpError(
              409,
              `Cannot change order status from ${order.status} to claimed`
            );
          }

          const payments = await Payment.find({
            order: order._id,
          }).session(session);

          const totalPaidCentavos = payments.reduce(
            (sum, payment) =>
              sum + toCentavos(payment.amount),
            0
          );

          const totalPriceCentavos = toCentavos(
            order.totalPrice
          );

          const balanceCentavos =
            totalPriceCentavos - totalPaidCentavos;

          if (balanceCentavos > 0) {
            const error = httpError(
              409,
              'Order cannot be claimed until fully paid'
            );

            error.details = {
              totalPrice: toPesos(totalPriceCentavos),
              totalPaid: toPesos(totalPaidCentavos),
              balance: toPesos(balanceCentavos),
            };

            throw error;
          }

          if (balanceCentavos < 0) {
            throw httpError(
              409,
              'Order payment total exceeds its price'
            );
          }

          order.status = 'claimed';
          order.claimedAt = new Date();

          await order.save({ session });

          claimedOrderId = order._id;
        });
      } catch (error) {
        if (
          error.status === 409 &&
          error.details
        ) {
          return res.status(409).json({
            message: error.message,
            ...error.details,
          });
        }

        throw error;
      } finally {
        await session.endSession();
      }

      const updatedOrder = await populateOrder(
        Order.findById(claimedOrderId)
      );

      return res.status(200).json(updatedOrder);
    }

    // OTHER STATUS TRANSITIONS
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    if (
      !transitions[order.status].includes(status)
    ) {
      return res.status(409).json({
        message:
          `Cannot change order status from ${order.status} to ${status}`,
      });
    }

    if (status === 'washing') {
      const selectedMachineId =
        machineId || order.machine;

      const machineResult = await validateMachine(
        selectedMachineId,
        order.weightKg,
        order._id
      );

      if (machineResult.error) {
        return res
          .status(machineResult.error.status)
          .json({
            message: machineResult.error.message,
          });
      }

      order.machine = selectedMachineId;
    }

    order.status = status;

    await order.save();

    const updatedOrder = await populateOrder(
      Order.findById(order._id)
    );

    return res.status(200).json(updatedOrder);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/orders/:id
// =====================================================
router.get('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    const order = await populateOrder(
      Order.findById(req.params.id)
    );

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/orders/:id
// Edit order notes.
// =====================================================
router.put('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    const { notes } = req.body;

    if (notes !== undefined) {
      if (typeof notes !== 'string') {
        return res.status(400).json({
          message: 'Notes must be a string',
        });
      }

      order.notes = notes;
    }

    await order.save();

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/orders/:id
// Protect financial and operational history.
// =====================================================
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    if (
      ['washing', 'ready', 'claimed'].includes(
        order.status
      )
    ) {
      return res.status(409).json({
        message:
          'Cannot delete an order that is washing, ready, or claimed',
      });
    }

    const paymentExists = await Payment.exists({
      order: order._id,
    });

    if (paymentExists) {
      return res.status(409).json({
        message:
          'Cannot delete an order that has payment records',
      });
    }

    await Order.findByIdAndDelete(order._id);

    res.status(200).json({
      message: 'Order deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
