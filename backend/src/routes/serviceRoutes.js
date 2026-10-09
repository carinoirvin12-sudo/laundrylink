
const express = require('express');
const mongoose = require('mongoose');

const Service = require('../models/Service');
const Order = require('../models/Order');

const router = express.Router();

const isValidId = (id) =>
  mongoose.isValidObjectId(id);

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const validateServiceInput = (body, partial = false) => {
  const allowedFields = [
    'name',
    'pricePerKg',
    'minCharge',
    'turnaroundHours',
    'isActive',
  ];

  for (const key of Object.keys(body)) {
    if (!allowedFields.includes(key)) {
      throw httpError(400, `Unknown field: ${key}`);
    }
  }

  if (!partial || body.name !== undefined) {
    if (
      typeof body.name !== 'string' ||
      body.name.trim().length < 2 ||
      body.name.trim().length > 100
    ) {
      throw httpError(
        400,
        'Service name must contain 2 to 100 characters'
      );
    }
  }

  for (const key of ['pricePerKg', 'minCharge']) {
    if (body[key] === undefined) {
      if (!partial && key === 'pricePerKg') {
        throw httpError(400, 'Price per kilogram is required');
      }
      continue;
    }

    const value = body[key];

    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < (key === 'pricePerKg' ? 1 : 0) ||
      Math.abs(value * 100 - Math.round(value * 100)) >
        0.000001
    ) {
      throw httpError(
        400,
        `${key} must be a valid amount with at most 2 decimal places`
      );
    }
  }

  if (!partial || body.turnaroundHours !== undefined) {
    if (
      !Number.isInteger(body.turnaroundHours) ||
      body.turnaroundHours < 1
    ) {
      throw httpError(
        400,
        'Turnaround hours must be a positive whole number'
      );
    }
  }

  if (
    body.isActive !== undefined &&
    typeof body.isActive !== 'boolean'
  ) {
    throw httpError(400, 'isActive must be a boolean');
  }
};

// =====================================================
// GET /api/services
// Optional: ?active=true
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.active !== undefined) {
      if (
        req.query.active !== 'true' &&
        req.query.active !== 'false'
      ) {
        return res.status(400).json({
          message: 'active must be true or false',
        });
      }

      filter.isActive = req.query.active === 'true';
    }

    const services = await Service.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json(services);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/services
// =====================================================
router.post('/', async (req, res, next) => {
  try {
    validateServiceInput(req.body);

    const service = await Service.create({
      name: req.body.name.trim(),
      pricePerKg: req.body.pricePerKg,
      minCharge: req.body.minCharge ?? 0,
      turnaroundHours: req.body.turnaroundHours,
      isActive: req.body.isActive ?? true,
    });

    return res.status(201).json(service);
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

    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        message: 'Service not found',
      });
    }

    return res.status(200).json(service);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/services/:id
// Supports partial updates, including isActive.
// =====================================================
router.put('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid service ID',
      });
    }

    validateServiceInput(req.body, true);

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: 'No fields to update',
      });
    }

    const changes = { ...req.body };

    if (changes.name !== undefined) {
      changes.name = changes.name.trim();
    }

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: changes },
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

    return res.status(200).json(service);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/services/:id
//
// If unused: delete permanently.
// If referenced by orders: archive by setting
// isActive to false while preserving history.
// =====================================================
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid service ID',
      });
    }

    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        message: 'Service not found',
      });
    }

    const referencedOrder = await Order.exists({
      service: service._id,
    });

    if (referencedOrder) {
      if (!service.isActive) {
        return res.status(200).json({
          message:
            'This service is already inactive and is kept for order history.',
          archived: true,
          service,
        });
      }

      service.isActive = false;
      await service.save();

      return res.status(200).json({
        message:
          'Service archived successfully. It was used in previous orders, so its history was preserved.',
        archived: true,
        service,
      });
    }

    await Service.findByIdAndDelete(service._id);

    return res.status(200).json({
      message: 'Unused service deleted successfully',
      archived: false,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
