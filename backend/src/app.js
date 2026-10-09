
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

// Custom request logger
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
  // Log complete details on the server for debugging.
  console.error(
    `[${new Date().toISOString()}]`,
    error
  );

  // MongoDB duplicate key error
  if (error.code === 11000) {
    const field =
      Object.keys(error.keyPattern || {})[0] ||
      'field';

    return res.status(409).json({
      message: `${field} already exists`,
    });
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const messages = Object.values(
      error.errors || {}
    ).map((item) => item.message);

    return res.status(400).json({
      message:
        messages[0] || 'Validation failed',
    });
  }

  // Mongoose cast error
  if (error.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid ID or value',
    });
  }

  // Only use valid HTTP error status codes.
  const statusCode =
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 599
      ? error.status
      : 500;

  // Hide internal error details from API consumers.
  return res.status(statusCode).json({
    message:
      statusCode >= 500
        ? 'Internal server error'
        : error.message || 'Request failed',
  });
});

module.exports = app;
