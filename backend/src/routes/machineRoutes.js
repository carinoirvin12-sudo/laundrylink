
const express = require('express');
const mongoose = require('mongoose');

const Machine = require('../models/Machine');
const Order = require('../models/Order');

const router = express.Router();

const isValidId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

// Machine is occupied while an assigned order
// is still received or washing.
const BUSY_ORDER_STATUSES = [
  'received',
  'washing',
];

// =====================================================
// GET /api/machines
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const machines = await Machine.find().sort({
      name: 1,
    });

    res.status(200).json(machines);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/machines
// =====================================================
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      type,
      capacityKg,
      status,
    } = req.body;

    const machine = await Machine.create({
      name,
      type,
      capacityKg,
      status,
    });

    res.status(201).json(machine);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/machines/availability
//
// Display states:
// Available
// In Use
// Maintenance
// Insufficient Capacity
//
// Optional:
// ?weightKg=10
// =====================================================
router.get(
  '/availability',
  async (req, res, next) => {
    try {
      const { weightKg } = req.query;

      let requestedWeight = null;

      if (weightKg !== undefined) {
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

      const machines = await Machine.find().sort({
        name: 1,
      });

      const activeOrders = await Order.find({
        status: {
          $in: BUSY_ORDER_STATUSES,
        },
        machine: {
          $ne: null,
        },
      }).select(
        'machine status customer service'
      );

      const busyMachineIds = new Set(
        activeOrders
          .filter((order) => order.machine)
          .map((order) =>
            order.machine.toString()
          )
      );

      const result = machines.map((machine) => {
        const machineId =
          machine._id.toString();

        const isBusy =
          busyMachineIds.has(machineId);

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

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

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

    res.status(200).json(machine);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/machines/:id
//
// Protect active laundry orders:
// - Cannot switch an occupied machine to maintenance
// - Cannot reduce capacity below the active load
// =====================================================
router.put('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid machine ID',
      });
    }

    const {
      name,
      type,
      capacityKg,
      status,
    } = req.body;

    const currentMachine =
      await Machine.findById(req.params.id);

    if (!currentMachine) {
      return res.status(404).json({
        message: 'Machine not found',
      });
    }

    // Find the heaviest active laundry order
    // currently assigned to this machine.
    const activeOrder = await Order.findOne({
      machine: req.params.id,
      status: {
        $in: BUSY_ORDER_STATUSES,
      },
    }).sort({
      weightKg: -1,
    });

    if (activeOrder) {
      // Prevent maintenance while occupied.
      if (status === 'maintenance') {
        return res.status(409).json({
          message:
            'Cannot place machine under maintenance while it is in use',
        });
      }

      // Prevent changing machine capacity
      // to less than the current laundry load.
      if (capacityKg !== undefined) {
        const newCapacity = Number(capacityKg);

        if (
          Number.isFinite(newCapacity) &&
          newCapacity < activeOrder.weightKg
        ) {
          return res.status(409).json({
            message:
              'Machine capacity cannot be lower than its current laundry load',
          });
        }
      }
    }

    // Apply updates with Mongoose validation.
    const machine =
      await Machine.findByIdAndUpdate(
        req.params.id,
        {
          name,
          type,
          capacityKg,
          status,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    res.status(200).json(machine);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/machines/:id
// Prevent delete if referenced by an order
// =====================================================
router.delete('/:id', async (req, res, next) => {
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

    const referencedOrder =
      await Order.exists({
        machine: req.params.id,
      });

    if (referencedOrder) {
      return res.status(409).json({
        message:
          'Cannot delete machine because it is referenced by an order',
      });
    }

    await Machine.findByIdAndDelete(
      req.params.id
    );

    res.status(200).json({
      message:
        'Machine deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
