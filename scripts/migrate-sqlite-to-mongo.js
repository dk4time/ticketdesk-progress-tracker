require('dotenv').config();

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const mongoose = require('mongoose');

const db = require('../src/db');
const Student = require('../src/models/Student');
const ItemCompletion = require('../src/models/ItemCompletion');

// One-off migration off the old data/progress.db (better-sqlite3) into the
// MongoDB Atlas cluster now configured via MONGODB_URI. Run once, from
// wherever the live data/progress.db actually lives (Render's Shell tab
// against the still-attached Disk, if migrating a deployed instance) —
// see README.md's "Cutover runbook" for the full procedure.
//
// Intentionally does not set lockedIp on any migrated student: the old
// SQLite schema has no concept of an IP lock, so every migrated student
// starts unlocked and gets locked to whichever IP their next
// `npm run self-check` run reports from, same as a brand-new student would.
//
// Both writes below use $setOnInsert (insert-only, never overwrite) rather
// than $set, and are safe to re-run. That matters because the app is
// already live on Mongo by the time this runs (see the cutover runbook in
// README.md) — if a student posts a fresh self-check result in the window
// between deploy and running this script, $set would clobber that fresh
// row with stale data from the old SQLite snapshot; $setOnInsert leaves it
// alone and only backfills rows Mongo doesn't have yet.
async function main() {
  const dbPath = path.join(__dirname, '..', 'data', 'progress.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`No SQLite database found at ${dbPath} — nothing to migrate.`);
    process.exit(1);
  }

  const sqlite = new Database(dbPath, { readonly: true });
  const students = sqlite.prepare('SELECT * FROM students').all();
  const completions = sqlite.prepare('SELECT * FROM item_completions').all();
  sqlite.close();

  console.log(`Read ${students.length} student(s) and ${completions.length} completion row(s) from SQLite.`);

  await db.connect();

  let studentsWritten = 0;
  for (const s of students) {
    await Student.updateOne(
      { registrationNumber: s.registration_number },
      {
        $setOnInsert: {
          registrationNumber: s.registration_number,
          createdAt: new Date(s.created_at),
          updatedAt: new Date(s.updated_at)
        }
      },
      { upsert: true, timestamps: false }
    );
    studentsWritten += 1;
  }

  let completionsWritten = 0;
  for (const c of completions) {
    await ItemCompletion.updateOne(
      {
        registrationNumber: c.registration_number,
        category: c.category,
        itemNumber: c.item_number
      },
      {
        $setOnInsert: {
          completed: !!c.completed,
          verified: !!c.verified,
          completedAt: c.completed_at ? new Date(c.completed_at) : null
        }
      },
      { upsert: true }
    );
    completionsWritten += 1;
  }

  console.log(`Migrated ${studentsWritten} student(s) and ${completionsWritten} completion row(s) into MongoDB.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
