
require('dotenv').config();

const dns = require('dns');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Machine = require('../models/Machine');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const collections = [
  { name: 'customers', model: Customer },
  { name: 'services', model: Service },
  { name: 'machines', model: Machine },
  { name: 'orders', model: Order },
  { name: 'payments', model: Payment },
];

async function backupAndClear() {
  if (!process.argv.includes('--confirm-reset')) {
    console.log(
      'No database changes made. Use --confirm-reset to backup and clear the database.'
    );
    return;
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from .env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  console.log('MongoDB connected.');

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const backupDir = path.join(
    __dirname,
    '../../backups',
    timestamp
  );

  fs.mkdirSync(backupDir, { recursive: true });

  const backupData = {};

  console.log('\nCreating database backup...');

  for (const collection of collections) {
    const records = await collection.model
      .find({})
      .lean();

    backupData[collection.name] = records;

    const filePath = path.join(
      backupDir,
      `${collection.name}.json`
    );

    fs.writeFileSync(
      filePath,
      JSON.stringify(records, null, 2),
      'utf8'
    );

    const verified = JSON.parse(
      fs.readFileSync(filePath, 'utf8')
    );

    if (verified.length !== records.length) {
      throw new Error(
        `Backup verification failed: ${collection.name}`
      );
    }

    console.log(
      `${collection.name}: ${records.length} records backed up`
    );
  }

  console.log('\nVerifying database has not changed...');

  for (const collection of collections) {
    const currentCount =
      await collection.model.countDocuments();

    if (
      currentCount !==
      backupData[collection.name].length
    ) {
      throw new Error(
        `Database changed during backup: ${collection.name}. Reset cancelled.`
      );
    }
  }

  console.log('\nBackup verified.');
  console.log(`Backup folder: ${backupDir}`);

  console.log('\nClearing collections...');

  // Delete dependent records first.
  const deletionOrder = [
    Payment,
    Order,
    Customer,
    Service,
    Machine,
  ];

  for (const model of deletionOrder) {
    const result = await model.deleteMany({});

    console.log(
      `${model.modelName}: ${result.deletedCount} records deleted`
    );
  }

  console.log('\nVerifying empty database...');

  for (const collection of collections) {
    const count =
      await collection.model.countDocuments();

    if (count !== 0) {
      throw new Error(
        `${collection.name} still contains ${count} records`
      );
    }
  }

  console.log('\nSUCCESS!');
  console.log('LaundryLink database is now empty.');
  console.log(`Backup saved at: ${backupDir}`);
}

backupAndClear()
  .catch((error) => {
    console.error('Cleanup failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
