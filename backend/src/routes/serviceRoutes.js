const express = require('express');
const mongoose = require('mongoose');

const Service = require('../models/Service');
const Order = require('../models/Order');

const router = express.Router();

const isValidId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

// =====================================================
// GET /api/services
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const services = await Service.find().sort({
      createdAt: -1,
    });

    res.status(200).json(services);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/services
// =====================================================
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      pricePerKg,
      minCharge,
      turnaroundHours,
      isActive,
    } = req.body;

    const service = await Service.create({
      name,
      pricePerKg,
      minCharge,
      turnaroundHours,
      isActive,
    });

    res.status(201).json(service);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/services/:id
// =====================================================
router.get('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid service ID',
      });
    }

    const service = await Service.findById(
      req.params.id
    );

    if (!service) {
      return res.status(404).json({
        message: 'Service not found',
      });
    }

    res.status(200).json(service);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/services/:id
// =====================================================
router.put('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid service ID',
      });
    }

    const {
      name,
      pricePerKg,
      minCharge,
      turnaroundHours,
      isActive,
    } = req.body;

    const service =
      await Service.findByIdAndUpdate(
        req.params.id,
        {
          name,
          pricePerKg,
          minCharge,
          turnaroundHours,
          isActive,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!service) {
      return res.status(404).json({
        message: 'Service not found',
      });
    }

    res.status(200).json(service);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/services/:id
// Prevent delete if referenced by an order
// =====================================================
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid service ID',
      });
    }

    const service = await Service.findById(
      req.params.id
    );

    if (!service) {
      return res.status(404).json({
        message: 'Service not found',
      });
    }

    const referencedOrder =
      await Order.exists({
        service: req.params.id,
      });

    if (referencedOrder) {
      return res.status(409).json({
        message:
          'Cannot delete service because it is referenced by an order',
      });
    }

    await Service.findByIdAndDelete(
      req.params.id
    );

    res.status(200).json({
      message: 'Service deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;