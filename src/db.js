const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'progress.db');
const db = new Database(DB_PATH);

// WAL mode keeps writes fast and safe even if the trainer's laptop loses
// power mid-checkbox-click — this file is the only copy of the data.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    registration_number TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS item_completions (
    registration_number TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('backend', 'frontend')),
    item_number INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    PRIMARY KEY (registration_number, category, item_number),
    FOREIGN KEY (registration_number) REFERENCES students(registration_number)
  );
`);

// Migration for databases created before automated grading existed — plain
// CREATE TABLE IF NOT EXISTS above is a no-op against an already-existing
// table, so an older progress.db needs the new column added explicitly.
// Rows migrated in with verified = 0 read as "not tested yet" everywhere
// downstream, which is correct: that data was self-reported via the old
// manual checkboxes, not confirmed by npm run self-check.
const completionColumns = db.prepare('PRAGMA table_info(item_completions)').all().map((c) => c.name);
if (!completionColumns.includes('verified')) {
  db.exec('ALTER TABLE item_completions ADD COLUMN verified INTEGER NOT NULL DEFAULT 0');
}

module.exports = db;
