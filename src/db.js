const mongoose = require('mongoose');

// All persistence now lives in MongoDB Atlas rather than on Render's local
// disk — a Render Disk only survives as long as that specific service
// instance does, and doesn't protect against a plan change, a service
// recreate, or a move to a different host. Atlas is external to Render
// entirely, so none of that can take student progress with it.
async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy .env.example to .env and fill in your ' +
        'MongoDB Atlas connection string before starting the server.'
    );
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');
}

module.exports = { connect };
