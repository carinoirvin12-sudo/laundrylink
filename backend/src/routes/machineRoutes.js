
const express = require('express');
const mongoose = require('mongoose');

const Machine = require('../models/Machine');
const Order = require('../models/Order');

const router = express.Router();

// =====================================================
// HELPERS
// =====================================================

const isValidId = (id) =>
  typeof id === 'string' &&
  /^[a-fA-F0-9]{24}$/.test(id);

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const validateMachineInput = (body, partial = false) => {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw httpError(400, 'Invalid machine data');
  }

  const allowedFields = [
    'name',
    'type',
    'capacityKg',
    'status',
  ];

  for (const key of Object.keys(body)) {
    if (!allowedFields.includes(key)) {
      throw httpError(400, `Unknown field: ${key}`);
    }
  }

  if (partial && Object.keys(body).length === 0) {
    throw httpError(400, 'No fields to update');
  }

  // NAME
  if (!partial || body.name !== undefined) {
    if (
      typeof body.name !== 'string' ||
      body.name.trim().length < 2 ||
      body.name.trim().length > 100
    ) {
      throw httpError(
        400,
        'Machine name must contain 2 to 100 characters'
      );
    }
  }

  // TYPE
  if (!partial || body.type !== undefined) {
    if (!['washer', 'dryer'].includes(body.type)) {
      throw httpError(
        400,
        'Machine type must be washer or dryer'
      );
    }
  }

  // CAPACITY
  if (!partial || body.capacityKg !== undefined) {
    if (
      typeof body.capacityKg !== 'number' ||
      !Number.isFinite(body.capacityKg) ||
      body.capacityKg < 1 ||
      body.capacityKg > 15
    ) {
      throw httpError(
        400,
        'Machine capacity must be between 1 and 15 kg'
      );
    }
  }

  // STATUS
  if (body.status !== undefined) {
    if (
      !['active', 'maintenance'].includes(body.status)
    ) {
      throw httpError(
        400,
        'Machine status must be active or maintenance'
      );
    }
  }
};

// =====================================================
// MACHINE OCCUPANCY
//
// Washer is busy only during washing.
// Dryer is busy only during drying.
//
// Legacy "machine" field is supported for old
// washer assignments.
//
// Received, folding, ready, claimed and cancelled
// do not occupy a machine.
// =====================================================

const getBusyOrderFilter = (machine) => {
  if (machine.type === 'washer') {
    return {
      status: 'washing',
      $or: [
        { washer: machine._id },
        {
          washer: null,
          machine: machine._id,
        },
      ],
    };
  }

  return {
    status: 'drying',
    dryer: machine._id,
  };
};

const getMachineHistoryFilter = (machineId) => ({
  $or: [
    { machine: machineId },
    { washer: machineId },
    { dryer: machineId },
  ],
});

// Serializes machine updates with assignments
// in orderRoutes.js.
//
// Requires MongoDB transaction support.
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
    {
      session,
    }
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

// =====================================================
// GET /api/machines
// =====================================================

router.get('/', async (req, res, next) => {
  try {
    const machines = await Machine.find().sort({
      name: 1,
    });

    return res.status(200).json(machines);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/machines/availability
//
// Optional:
// ?weightKg=10
// ?type=washer
// ?type=dryer
//
// Returns:
// - isBusy
// - isAvailable
// - hasCapacity
// - availabilityStatus
// - displayStatus
// =====================================================

router.get('/availability', async (req, res, next) => {
  try {
    const { weightKg, type } = req.query;

    let requestedWeight = null;

    if (weightKg !== undefined) {
      if (
        typeof weightKg !== 'string' ||
        weightKg.trim() === ''
      ) {
        return res.status(400).json({
          message: 'Invalid weight',
        });
      }

      requestedWeight = Number(weightKg);

      if (
        !Number.isFinite(requestedWeight) ||
        requestedWeight < 1 ||
        requestedWeight > 15
      ) {
        return res.status(400).json({
          message:
            'Weight must be between 1 and 15 kg',
        });
      }
    }

    if (
      type !== undefined &&
      type !== 'washer' &&
      type !== 'dryer'
    ) {
      return res.status(400).json({
        message:
          'Machine type must be washer or dryer',
      });
    }

    const machineFilter = {};

    if (type) {
      machineFilter.type = type;
    }

    const [machines, washingOrders, dryingOrders] =
      await Promise.all([
        Machine.find(machineFilter).sort({
          name: 1,
        }),

        Order.find({
          status: 'washing',
        }).select('washer machine'),

        Order.find({
          status: 'drying',
          dryer: { $ne: null },
        }).select('dryer'),
      ]);

    // Washer occupancy.
    const busyWasherIds = new Set();

    washingOrders.forEach((order) => {
      const washerId = order.washer || order.machine;

      if (washerId) {
        busyWasherIds.add(washerId.toString());
      }
    });

    // Dryer occupancy.
    const busyDryerIds = new Set();

    dryingOrders.forEach((order) => {
      if (order.dryer) {
        busyDryerIds.add(order.dryer.toString());
      }
    });

    const result = machines.map((machine) => {
      const machineId = machine._id.toString();

      const isBusy =
        machine.type === 'washer'
          ? busyWasherIds.has(machineId)
          : busyDryerIds.has(machineId);

      const isMaintenance =
        machine.status === 'maintenance';

      const hasCapacity =
        requestedWeight === null ||
        machine.capacityKg >= requestedWeight;

      const isAvailable =
        !isBusy &&
        !isMaintenance &&
        hasCapacity;

      let availabilityStatus = 'available';
      let displayStatus = 'Available';

      if (isMaintenance) {
        availabilityStatus = 'maintenance';
        displayStatus = 'Maintenance';
      } else if (isBusy) {
        availabilityStatus = 'in-use';
        displayStatus = 'In Use';
      } else if (!hasCapacity) {
        availabilityStatus =
          'insufficient-capacity';
        displayStatus =
          'Insufficient Capacity';
      }

      return {
        ...machine.toObject(),
        isBusy,
        isAvailable,
        hasCapacity,
        availabilityStatus,
        displayStatus,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/machines
// =====================================================

router.post('/', async (req, res, next) => {
  try {
    validateMachineInput(req.body);

    const machine = await Machine.create({
      name: req.body.name.trim(),
      type: req.body.type,
      capacityKg: req.body.capacityKg,
      status: req.body.status ?? 'active',
    });

    return res.status(201).json(machine);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/machines/:id
// =====================================================

router.get('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid machine ID',
      });
    }

    const machine = await Machine.findById(
      req.params.id
    );

    if (!machine) {
      return res.status(404).json({
        message: 'Machine not found',
      });
    }

    return res.status(200).json(machine);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/machines/:id
//
// - Validate input
// - Block maintenance while machine is in use
// - Block capacity reduction below active load
// - Preserve machine type if used in order history
// - Coordinate with order assignment transactions
// =====================================================

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid machine ID',
      });
    }

    validateMachineInput(req.body, true);

    const session = await mongoose.startSession();

    let updatedMachineId;

    try {
      await session.withTransaction(async () => {
        const machine = await lockMachine(
          id,
          session
        );

        const busyFilter =
          getBusyOrderFilter(machine);

        const activeOrder = await Order.findOne(
          busyFilter
        )
          .sort({ weightKg: -1 })
          .session(session);

        if (activeOrder) {
          if (
            req.body.status === 'maintenance'
          ) {
            throw httpError(
              409,
              'Cannot place machine under maintenance while it is in use'
            );
          }

          if (
            req.body.capacityKg !== undefined &&
            req.body.capacityKg <
              activeOrder.weightKg
          ) {
            throw httpError(
              409,
              'Machine capacity cannot be lower than its current laundry load'
            );
          }
        }

        if (
          req.body.type !== undefined &&
          req.body.type !== machine.type
        ) {
          const usedInOrder = await Order.exists(
            getMachineHistoryFilter(machine._id)
          ).session(session);

          if (usedInOrder) {
            throw httpError(
              409,
              'Cannot change machine type because it has existing order history'
            );
          }
        }

        // Apply the validated fields.
        if (req.body.name !== undefined) {
          machine.name = req.body.name.trim();
        }

        if (req.body.type !== undefined) {
          machine.type = req.body.type;
        }

        if (
          req.body.capacityKg !== undefined
        ) {
          machine.capacityKg =
            req.body.capacityKg;
        }

        if (req.body.status !== undefined) {
          machine.status = req.body.status;
        }

        await machine.save({ session });

        updatedMachineId = machine._id;
      });
    } finally {
      await session.endSession();
    }

    const updatedMachine = await Machine.findById(
      updatedMachineId
    );

    return res.status(200).json(updatedMachine);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/machines/:id
//
// Unused machines may be deleted.
// Machines with order history cannot be deleted.
//
// Uses the same machine lock as order assignment.
// =====================================================

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid machine ID',
      });
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const machine = await lockMachine(
          id,
          session
        );

        const usedInOrder = await Order.exists(
          getMachineHistoryFilter(machine._id)
        ).session(session);

        if (usedInOrder) {
          throw httpError(
            409,
            'This machine cannot be deleted because it has laundry order history. Keep it for transaction records.'
          );
        }

        await Machine.findByIdAndDelete(
          machine._id
        ).session(session);
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      message: 'Unused machine deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
