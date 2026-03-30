const mongoose = require('mongoose');
const logger = require('../utils/logger');

let hasListeners = false;

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set');
  }

  if (!hasListeners) {
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('connected', () => {
      logger.info('Connected to MongoDB');
    });
    hasListeners = true;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(mongoUri);
  return mongoose.connection;
}

module.exports = connectDB;
