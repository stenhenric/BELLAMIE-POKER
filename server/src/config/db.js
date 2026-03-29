const mongoose = require('mongoose');

let hasErrorListener = false;

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set');
  }

  if (!hasErrorListener) {
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message);
    });
    hasErrorListener = true;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  return mongoose.connection;
}

module.exports = connectDB;
