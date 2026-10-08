require('dotenv').config();

const dns = require('dns');
const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Machine = require('../models/Machine');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Clear existing data
    await Payment.deleteMany({});
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Service.deleteMany({});
    await Machine.deleteMany({});

    console.log('Old data cleared');

    // =========================
    // CUSTOMERS
    // =========================
    const customers = await Customer.insertMany([
      {
        fullName: 'Juan Dela Cruz',
        phone: '09171234567',
        email: 'juan@example.com',
        address: 'Angeles City',
      },
      {
        fullName: 'Maria Santos',
        phone: '09181234567',
        email: 'maria@example.com',
        address: 'Mabalacat City',
      },
      {
        fullName: 'Carlo Reyes',
        phone: '09191234567',
        email: 'carlo@example.com',
        address: 'San Fernando',
      },
      {
        fullName: 'Angela Garcia',
        phone: '09201234567',
        email: 'angela@example.com',
        address: 'Porac',
      },
      {
        fullName: 'Miguel Mendoza',
        phone: '09211234567',
        email: 'miguel@example.com',
        address: 'Magalang',
      },
      {
        fullName: 'Sofia Ramos',
        phone: '09221234567',
        email: 'sofia@example.com',
        address: 'Angeles City',
      },
      {
        fullName: 'Daniel Flores',
        phone: '09231234567',
        email: 'daniel@example.com',
        address: 'Mabalacat City',
      },
      {
        fullName: 'Nicole Bautista',
        phone: '09241234567',
        email: 'nicole@example.com',
        address: 'San Fernando',
      },
    ]);

    // =========================
    // SERVICES
    // =========================
    const services = await Service.insertMany([
      {
        name: 'Wash Only',
        pricePerKg: 35,
        minCharge: 100,
        turnaroundHours: 24,
      },
      {
        name: 'Wash and Dry',
        pricePerKg: 50,
        minCharge: 150,
        turnaroundHours: 24,
      },
      {
        name: 'Wash, Dry and Fold',
        pricePerKg: 65,
        minCharge: 180,
        turnaroundHours: 36,
      },
      {
        name: 'Express Laundry',
        pricePerKg: 80,
        minCharge: 200,
        turnaroundHours: 12,
      },
      {
        name: 'Delicate Care',
        pricePerKg: 90,
        minCharge: 250,
        turnaroundHours: 48,
      },
    ]);

    // =========================
    // MACHINES
    // =========================
    const machines = await Machine.insertMany([
      {
        name: 'Washer 1',
        type: 'washer',
        capacityKg: 10,
        status: 'active',
      },
      {
        name: 'Washer 2',
        type: 'washer',
        capacityKg: 15,
        status: 'active',
      },
      {
        name: 'Washer 3',
        type: 'washer',
        capacityKg: 20,
        status: 'maintenance',
      },
      {
        name: 'Dryer 1',
        type: 'dryer',
        capacityKg: 10,
        status: 'active',
      },
      {
        name: 'Dryer 2',
        type: 'dryer',
        capacityKg: 15,
        status: 'active',
      },
      {
        name: 'Dryer 3',
        type: 'dryer',
        capacityKg: 20,
        status: 'active',
      },
    ]);

    // Helper function for dates
    const hoursFromNow = (hours) =>
      new Date(Date.now() + hours * 60 * 60 * 1000);

    // =========================
    // ORDERS
    // =========================
    const orderData = [
      // Customer 1 - several claimed orders
      {
        customer: customers[0]._id,
        service: services[0]._id,
        weightKg: 4,
        discountPercent: 0,
        totalPrice: 140,
        status: 'claimed',
        dueDate: hoursFromNow(-120),
        claimedAt: hoursFromNow(-100),
      },
      {
        customer: customers[0]._id,
        service: services[1]._id,
        weightKg: 5,
        discountPercent: 0,
        totalPrice: 250,
        status: 'claimed',
        dueDate: hoursFromNow(-100),
        claimedAt: hoursFromNow(-80),
      },
      {
        customer: customers[0]._id,
        service: services[2]._id,
        weightKg: 6,
        discountPercent: 0,
        totalPrice: 390,
        status: 'claimed',
        dueDate: hoursFromNow(-90),
        claimedAt: hoursFromNow(-70),
      },
      {
        customer: customers[0]._id,
        service: services[0]._id,
        weightKg: 7,
        discountPercent: 0,
        totalPrice: 245,
        status: 'claimed',
        dueDate: hoursFromNow(-70),
        claimedAt: hoursFromNow(-50),
      },
      {
        customer: customers[0]._id,
        service: services[1]._id,
        weightKg: 8,
        discountPercent: 0,
        totalPrice: 400,
        status: 'claimed',
        dueDate: hoursFromNow(-50),
        claimedAt: hoursFromNow(-30),
      },

      // Current/mixed orders
      {
        customer: customers[0]._id,
        service: services[1]._id,
        weightKg: 6,
        discountPercent: 5,
        totalPrice: 285,
        status: 'received',
        dueDate: hoursFromNow(24),
      },
      {
        customer: customers[1]._id,
        service: services[0]._id,
        machine: machines[0]._id,
        weightKg: 5,
        discountPercent: 0,
        totalPrice: 175,
        status: 'washing',
        dueDate: hoursFromNow(20),
      },
      {
        customer: customers[2]._id,
        service: services[2]._id,
        weightKg: 7,
        discountPercent: 0,
        totalPrice: 455,
        status: 'ready',
        dueDate: hoursFromNow(-10),
      },
      {
        customer: customers[3]._id,
        service: services[3]._id,
        weightKg: 4,
        discountPercent: 0,
        totalPrice: 320,
        status: 'ready',
        dueDate: hoursFromNow(-8),
      },
      {
        customer: customers[4]._id,
        service: services[4]._id,
        weightKg: 3,
        discountPercent: 0,
        totalPrice: 270,
        status: 'received',
        dueDate: hoursFromNow(48),
      },
      {
        customer: customers[5]._id,
        service: services[1]._id,
        weightKg: 10,
        discountPercent: 10,
        totalPrice: 450,
        status: 'received',
        dueDate: hoursFromNow(24),
      },
      {
        customer: customers[6]._id,
        service: services[2]._id,
        weightKg: 12,
        discountPercent: 10,
        totalPrice: 702,
        status: 'received',
        dueDate: hoursFromNow(36),
      },
      {
        customer: customers[7]._id,
        service: services[3]._id,
        weightKg: 10,
        discountPercent: 10,
        totalPrice: 720,
        status: 'ready',
        dueDate: hoursFromNow(-5),
      },
      {
        customer: customers[1]._id,
        service: services[4]._id,
        weightKg: 5,
        discountPercent: 0,
        totalPrice: 450,
        status: 'ready',
        dueDate: hoursFromNow(-24),
      },
      {
        customer: customers[2]._id,
        service: services[0]._id,
        weightKg: 3,
        discountPercent: 0,
        totalPrice: 105,
        status: 'claimed',
        dueDate: hoursFromNow(-30),
        claimedAt: hoursFromNow(-20),
      },
      {
        customer: customers[3]._id,
        service: services[1]._id,
        weightKg: 9,
        discountPercent: 0,
        totalPrice: 450,
        status: 'claimed',
        dueDate: hoursFromNow(-40),
        claimedAt: hoursFromNow(-25),
      },
      {
        customer: customers[4]._id,
        service: services[2]._id,
        weightKg: 10,
        discountPercent: 10,
        totalPrice: 585,
        status: 'claimed',
        dueDate: hoursFromNow(-50),
        claimedAt: hoursFromNow(-30),
      },
      {
        customer: customers[5]._id,
        service: services[3]._id,
        weightKg: 2,
        discountPercent: 0,
        totalPrice: 200,
        status: 'cancelled',
        dueDate: hoursFromNow(12),
      },
      {
        customer: customers[6]._id,
        service: services[0]._id,
        weightKg: 11,
        discountPercent: 10,
        totalPrice: 346.5,
        status: 'received',
        dueDate: hoursFromNow(24),
      },
      {
        customer: customers[7]._id,
        service: services[1]._id,
        weightKg: 4,
        discountPercent: 0,
        totalPrice: 200,
        status: 'received',
        dueDate: hoursFromNow(24),
      },
      {
        customer: customers[1]._id,
        service: services[2]._id,
        weightKg: 8,
        discountPercent: 0,
        totalPrice: 520,
        status: 'ready',
        dueDate: hoursFromNow(-12),
      },
      {
        customer: customers[2]._id,
        service: services[3]._id,
        weightKg: 6,
        discountPercent: 0,
        totalPrice: 480,
        status: 'received',
        dueDate: hoursFromNow(12),
      },
      {
        customer: customers[3]._id,
        service: services[4]._id,
        weightKg: 4,
        discountPercent: 0,
        totalPrice: 360,
        status: 'received',
        dueDate: hoursFromNow(48),
      },
      {
        customer: customers[4]._id,
        service: services[0]._id,
        weightKg: 10,
        discountPercent: 10,
        totalPrice: 315,
        status: 'ready',
        dueDate: hoursFromNow(-6),
      },
      {
        customer: customers[5]._id,
        service: services[1]._id,
        weightKg: 6,
        discountPercent: 0,
        totalPrice: 300,
        status: 'claimed',
        dueDate: hoursFromNow(-30),
        claimedAt: hoursFromNow(-18),
      },
    ];

    const orders = await Order.insertMany(orderData);

    // =========================
    // PAYMENTS
    // =========================
    const payments = await Payment.insertMany([
      {
        order: orders[0]._id,
        amount: 140,
        method: 'cash',
        remarks: 'Fully paid',
      },
      {
        order: orders[1]._id,
        amount: 250,
        method: 'gcash',
        remarks: 'Fully paid',
      },
      {
        order: orders[2]._id,
        amount: 390,
        method: 'cash',
        remarks: 'Fully paid',
      },
      {
        order: orders[3]._id,
        amount: 245,
        method: 'bank',
        remarks: 'Fully paid',
      },
      {
        order: orders[4]._id,
        amount: 400,
        method: 'gcash',
        remarks: 'Fully paid',
      },
      {
        order: orders[7]._id,
        amount: 200,
        method: 'cash',
        remarks: 'Partial payment',
      },
      {
        order: orders[8]._id,
        amount: 320,
        method: 'gcash',
        remarks: 'Fully paid',
      },
      {
        order: orders[12]._id,
        amount: 400,
        method: 'bank',
        remarks: 'Partial payment',
      },
      {
        order: orders[14]._id,
        amount: 105,
        method: 'cash',
        remarks: 'Fully paid',
      },
      {
        order: orders[15]._id,
        amount: 450,
        method: 'gcash',
        remarks: 'Fully paid',
      },
      {
        order: orders[16]._id,
        amount: 585,
        method: 'cash',
        remarks: 'Fully paid',
      },
      {
        order: orders[24]._id,
        amount: 300,
        method: 'gcash',
        remarks: 'Fully paid',
      },
    ]);

    console.log(`${customers.length} customers created`);
    console.log(`${services.length} services created`);
    console.log(`${machines.length} machines created`);
    console.log(`${orders.length} orders created`);
    console.log(`${payments.length} payments created`);

    console.log('LaundryLink database seeded successfully');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedDatabase();