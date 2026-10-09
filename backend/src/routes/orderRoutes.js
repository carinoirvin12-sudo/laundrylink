
const express = require('express');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Machine = require('../models/Machine');
const Payment = require('../models/Payment');

const router = express.Router();

const ORDER_STATUSES = [
  'received',
  'washing',
  'drying',
  'folding',
  'ready',
  'claimed',
  'cancelled',
];

const TRANSITIONS = {
  received: ['washing', 'cancelled'],
  washing: ['drying'],
  drying: ['folding'],
  folding: ['ready'],
  ready: ['claimed'],
  claimed: [],
  cancelled: [],
};

// Final LaundryLink service priorities.
// Higher number means higher priority.
const PRIORITY_BY_NAME = {
  'Standard Laundry': 1,
  'Priority Laundry': 2,
  'Express Laundry': 3,
};

const isValidId = (id) =>
  typeof id === 'string' &&
  /^[a-fA-F0-9]{24}$/.test(id);

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
    )
    .populate(
      'washer',
      'name type capacityKg status'
    )
    .populate(
      'dryer',
      'name type capacityKg status'
    );

const validWeight = (value) => {
  const weight = Number(value);

  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(weight) &&
    weight >= 1 &&
    weight <= 15
  );
};

const validateNotes = (notes) => {
  if (
    notes !== undefined &&
    notes !== null &&
    typeof notes !== 'string'
  ) {
    throw httpError(400, 'Notes must be a string');
  }

  return typeof notes === 'string'
    ? notes.trim()
    : '';
};

const getPriority = (serviceName) =>
  PRIORITY_BY_NAME[serviceName] || 1;

// =====================================================
// TRANSACTION HELPERS
// =====================================================

// Payment routes use an order-document write.
// We use the same approach to coordinate changes
// to status, cancellation, claiming, and payments.
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
    { session }
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

// Serialize machine assignment operations by writing
// to the machine document inside the transaction.
const lockMachine = async (machineId, session) => {
  const result = await Machine.collection.updateOne(
    {
      _id: new mongoose.Types.ObjectId(machineId),
    },
    {
      $currentDate: {
        updatedAt: true,
      },
    },
    { session }
  );

  if (result.matchedCount === 0) {
    throw httpError(404, 'Machine not found');
  }

  const machine = await Machine.findById(machineId)
    .session(session);

  if (!machine) {
    throw httpError(404, 'Machine not found');
  }

  return machine;
};

// A washer is busy only during washing.
// A dryer is busy only during drying.
// Old "machine" field is supported for legacy orders.
const getMachineBusyFilter = (machineId, type) => {
  if (type === 'washer') {
    return {
      status: 'washing',
      $or: [
        { washer: machineId },
        {
          washer: null,
          machine: machineId,
        },
      ],
    };
  }

  return {
    status: 'drying',
    dryer: machineId,
  };
};

const validateAndReserveMachine = async ({
  machineId,
  expectedType,
  weightKg,
  orderId,
  session,
}) => {
  if (!isValidId(machineId)) {
    throw httpError(
      400,
      `Please select a valid ${expectedType}`
    );
  }

  const machine = await lockMachine(machineId, session);

  if (machine.type !== expectedType) {
    throw httpError(
      400,
      `Selected machine must be a ${expectedType}`
    );
  }

  if (machine.status !== 'active') {
    throw httpError(
      409,
      `${machine.name} is under maintenance`
    );
  }

  if (machine.capacityKg < weightKg) {
    throw httpError(
      409,
      `${machine.name} cannot handle ${weightKg} kg`
    );
  }

  const busyFilter = getMachineBusyFilter(
    machine._id,
    expectedType
  );

  busyFilter._id = {
    $ne: new mongoose.Types.ObjectId(orderId),
  };

  const occupied = await Order.exists(
    busyFilter
  ).session(session);

  if (occupied) {
    throw httpError(
      409,
      `${machine.name} is currently in use`
    );
  }

  return machine;
};

// =====================================================
// PRICING
// Highest applicable discount only.
// Bulk: 10% for 10 kg or more.
// Loyalty: 5% for 5 or more claimed orders.
// =====================================================

const calculateOrderPrice = async (
  customerId,
  service,
  weightKg
) => {
  const pricePerKgCentavos = toCentavos(
    service.pricePerKg
  );

  const minChargeCentavos = toCentavos(
    service.minCharge || 0
  );

  const subtotalCentavos = Math.max(
    Math.round(weightKg * pricePerKgCentavos),
    minChargeCentavos
  );

  const claimedOrders = await Order.countDocuments({
    customer: customerId,
    status: 'claimed',
  });

 let discountPercent = 0;

// 5% Bulk Discount for 10 kg and above
if (weightKg >= 10) {
  discountPercent += 5;
}

// 5% Loyalty Discount for customers with
// at least 5 claimed orders
if (claimedOrders >= 5) {
  discountPercent += 5;
}

  const discountCentavos = Math.round(
    subtotalCentavos * discountPercent / 100
  );

  return {
    subtotal: toPesos(subtotalCentavos),
    discountPercent,
    totalPrice: toPesos(
      subtotalCentavos - discountCentavos
    ),
  };
};

// =====================================================
// ORDER CREATION
// No machine required at creation.
// Assign a washer when washing begins.
// Assign a dryer when drying begins.
// =====================================================

const createLaundryOrder = async ({
  customerId,
  serviceId,
  weightKg,
  notes,
}) => {
  if (!isValidId(customerId)) {
    throw httpError(400, 'Invalid customer ID');
  }

  if (!isValidId(serviceId)) {
    throw httpError(400, 'Invalid service ID');
  }

  if (!validWeight(weightKg)) {
    throw httpError(
      400,
      'Weight must be between 1 and 15 kg'
    );
  }

  const cleanNotes = validateNotes(notes);
  const weight = Number(weightKg);

  const [customer, service] = await Promise.all([
    Customer.findById(customerId),
    Service.findById(serviceId),
  ]);

  if (!customer) {
    throw httpError(404, 'Customer not found');
  }

  if (!service) {
    throw httpError(404, 'Service not found');
  }

  if (!service.isActive) {
    throw httpError(
      400,
      'Selected service is inactive'
    );
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
    machine: null,
    washer: null,
    dryer: null,
    weightKg: weight,
    discountPercent: pricing.discountPercent,
    totalPrice: pricing.totalPrice,
    status: 'received',
    dueDate,
    notes: cleanNotes,
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

    return res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/orders/pos
// New or existing customer.
// =====================================================

router.post('/pos', async (req, res, next) => {
  let createdCustomer = null;

  try {
    const {
      customerType,
      customer,
      customerId,
      service,
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
    } else {
      if (!isValidId(customerId)) {
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
      customerId: selectedCustomerId.toString(),
      serviceId: service,
      weightKg,
      notes,
    });

    return res.status(201).json({
      message: 'Laundry order created successfully',
      customerCreated: customerType === 'new',
      order: result.order,
      pricing: result.pricing,
    });
  } catch (error) {
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
// Existing customer.
// =====================================================

router.post('/', async (req, res, next) => {
  try {
    const result = await createLaundryOrder({
      customerId: req.body.customer,
      serviceId: req.body.service,
      weightKg: req.body.weightKg,
      notes: req.body.notes,
    });

    return res.status(201).json({
      order: result.order,
      pricing: result.pricing,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/orders/quote
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

    if (!validWeight(weightKg)) {
      return res.status(400).json({
        message: 'Weight must be between 1 and 15 kg',
      });
    }

    const [customer, service] = await Promise.all([
      Customer.findById(customerId),
      Service.findById(serviceId),
    ]);

    if (!customer) {
      return res.status(404).json({
        message: 'Customer not found',
      });
    }

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

    const weight = Number(weightKg);

    const pricing = await calculateOrderPrice(
      customerId,
      service,
      weight
    );

    const dueDate = new Date(
      Date.now() +
        service.turnaroundHours * 60 * 60 * 1000
    );

    return res.status(200).json({
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
// GET /api/orders/queue
// Priority scheduling display.
// Does not automatically start machines.
// =====================================================

router.get('/queue', async (req, res, next) => {
  try {
    const orders = await populateOrder(
      Order.find({ status: 'received' })
        .sort({ createdAt: 1 })
    );

    orders.sort((a, b) => {
      const priorityA = getPriority(
        a.service?.name
      );
      const priorityB = getPriority(
        b.service?.name
      );

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      return (
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
      );
    });

    return res.status(200).json(orders);
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

    return res.status(200).json(orders);
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
      if (
        typeof status !== 'string' ||
        !ORDER_STATUSES.includes(status)
      ) {
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
        filter.createdAt.$gte > filter.createdAt.$lte
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

    return res.status(200).json(orders);
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

    return res.status(200).json({
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
//
// received -> washing  (select washer)
// washing  -> drying   (select dryer)
// drying   -> folding
// folding  -> ready
// ready    -> claimed  (must be fully paid)
//
// received -> cancelled (no payments)
//
// Expected examples:
//
// { "status": "washing", "washer": "ID" }
// { "status": "drying", "dryer": "ID" }
// { "status": "folding" }
// { "status": "ready" }
// { "status": "claimed" }
// =====================================================

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    const {
      status,
      washer,
      dryer,
      machine,
    } = req.body;

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Invalid order status',
      });
    }

    const session = await mongoose.startSession();

    let updatedOrderId;

    try {
      await session.withTransaction(async () => {
        const order = await lockOrder(id, session);

        if (!TRANSITIONS[order.status].includes(status)) {
          throw httpError(
            409,
            `Cannot change order status from ${order.status} to ${status}`
          );
        }

        // ==========================================
        // CANCEL
        // ==========================================

        if (status === 'cancelled') {
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
        }

        // ==========================================
        // START WASHING
        // ==========================================

        if (status === 'washing') {
          const selectedWasher = washer || machine;

          await validateAndReserveMachine({
            machineId: selectedWasher,
            expectedType: 'washer',
            weightKg: order.weightKg,
            orderId: order._id,
            session,
          });

          // Queue rule:
          // Higher priority waiting orders go first.
          // Equal priority uses oldest order first.
          const waitingOrders = await Order.find({
            status: 'received',
          })
            .populate('service', 'name')
            .sort({ createdAt: 1 })
            .session(session);

          const currentService = await Service.findById(
            order.service
          ).session(session);

          const currentPriority = getPriority(
            currentService?.name
          );

          const higherPriorityWaiting =
            waitingOrders.find((waitingOrder) => {
              if (
                waitingOrder._id.toString() ===
                order._id.toString()
              ) {
                return false;
              }

              const waitingPriority = getPriority(
                waitingOrder.service?.name
              );

              if (waitingPriority > currentPriority) {
                return true;
              }

              return (
                waitingPriority === currentPriority &&
                (
                  new Date(waitingOrder.createdAt).getTime() <
                    new Date(order.createdAt).getTime() ||
                  (
                    new Date(waitingOrder.createdAt).getTime() ===
                      new Date(order.createdAt).getTime() &&
                    waitingOrder._id.toString() <
                      order._id.toString()
                  )
                )
              );
            });

          if (higherPriorityWaiting) {
            throw httpError(
              409,
              'A higher-priority or earlier laundry order is waiting. Process it first.'
            );
          }

          order.washer = selectedWasher;
          order.machine = selectedWasher;
          order.washingStartedAt = new Date();
          order.status = 'washing';
        }

        // ==========================================
        // START DRYING
        // ==========================================

        if (status === 'drying') {
          await validateAndReserveMachine({
            machineId: dryer,
            expectedType: 'dryer',
            weightKg: order.weightKg,
            orderId: order._id,
            session,
          });

          // The washer is no longer busy once
          // order status changes to drying.
          order.dryer = dryer;
          order.dryingStartedAt = new Date();
          order.status = 'drying';
        }

        // ==========================================
        // START FOLDING
        // ==========================================

        if (status === 'folding') {
          // The dryer is released automatically
          // when status changes to folding.
          order.foldingStartedAt = new Date();
          order.status = 'folding';
        }

        // ==========================================
        // READY FOR PICKUP
        // ==========================================

        if (status === 'ready') {
          order.readyAt = new Date();
          order.status = 'ready';
        }

        // ==========================================
        // CLAIM ORDER
        // ==========================================

        if (status === 'claimed') {
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
        }

        await order.save({ session });

        updatedOrderId = order._id;
      });
    } catch (error) {
      if (error.status === 409 && error.details) {
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
      Order.findById(updatedOrderId)
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

    return res.status(200).json(order);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/orders/:id
// Edit notes only.
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

    if (
      Object.keys(req.body).some(
        (key) => key !== 'notes'
      )
    ) {
      return res.status(400).json({
        message: 'Only order notes can be edited',
      });
    }

    if (req.body.notes === undefined) {
      return res.status(400).json({
        message: 'Please provide notes to update',
      });
    }

    order.notes = validateNotes(req.body.notes);

    await order.save();

    return res.status(200).json(order);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/orders/:id
//
// Only received or cancelled orders without
// payments may be deleted.
//
// Uses the same order lock as payment operations.
// =====================================================

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      });
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const order = await lockOrder(id, session);

        if (
          !['received', 'cancelled'].includes(
            order.status
          )
        ) {
          throw httpError(
            409,
            'Only received or cancelled orders can be deleted'
          );
        }

        const paymentExists = await Payment.exists({
          order: order._id,
        }).session(session);

        if (paymentExists) {
          throw httpError(
            409,
            'Cannot delete an order with recorded payments'
          );
        }

        await Order.findByIdAndDelete(
          order._id
        ).session(session);
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      message: 'Order deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
