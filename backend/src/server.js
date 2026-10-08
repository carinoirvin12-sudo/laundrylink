require('dotenv').config();

const dns = require('dns');
const mongoose = require('mongoose');
const app = require('./app');

// Node's default DNS resolver is failing SRV lookups on this network.
// Use Google DNS for MongoDB Atlas SRV resolution.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');

    app.listen(PORT, () => {
      console.log(`LaundryLink API running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });