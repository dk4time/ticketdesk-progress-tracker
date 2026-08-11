const mongoose = require('mongoose');

// One row per (student, item) — mirrors the old SQLite item_completions
// table exactly, including its PRIMARY KEY, so upserts stay idempotent.
const itemCompletionSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: true },
  category: { type: String, required: true, enum: ['backend', 'frontend'] },
  itemNumber: { type: Number, required: true },
  completed: { type: Boolean, required: true, default: false },
  verified: { type: Boolean, required: true, default: false },
  completedAt: { type: Date, default: null }
});

itemCompletionSchema.index(
  { registrationNumber: 1, category: 1, itemNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model('ItemCompletion', itemCompletionSchema);
