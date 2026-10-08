const express = require('express');
const cors = require('cors');

const customerRoutes = require('./routes/customerRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const machineRoutes = require('./routes/machineRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const statsRoutes = require('./routes/statsRoutes');

const app = express();

// =====================================================
// GLOBAL MIDDLEWARE
// =====================================================
app.use(cors());
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );

  next();
});

// =====================================================
// ROOT
// =====================================================
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'LaundryLink API is running',
  });
});

// =====================================================
// API ROUTES
// =====================================================
app.use('/api/customers', customerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stats', statsRoutes);

// =====================================================
// JSON 404 HANDLER
// =====================================================
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
  });
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================
app.use((error, req, res, next) => {
  console.error(error);

  // MongoDB duplicate key error
  if (error.code === 11000) {
    const field =
      Object.keys(
        error.keyPattern || {}
      )[0] || 'field';

    return res.status(409).json({
      message: `${field} already exists`,
    });
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const messages = Object.values(
      error.errors
    ).map((item) => item.message);

    return res.status(400).json({
      message:
        messages[0] ||
        'Validation failed',
    });
  }

  // Mongoose cast error
  if (error.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid ID or value',
    });
  }

  res.status(
    error.status || 500
  ).json({
    message:
      error.message ||
      'Internal server error',
  });
});

module.exports = app;