const db = require('./db');
const { BACKEND_ITEMS, FRONTEND_ITEMS } = require('./items');

const BACKEND_TOTAL = BACKEND_ITEMS.length;
const FRONTEND_TOTAL = FRONTEND_ITEMS.length;

function nowIso() {
  return new Date().toISOString();
}

// Registration numbers are normalized so the same student can't end up as
// two different rows across Day 1 and Day 2 just because of stray
// whitespace or letter case.
function normalizeRegNumber(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

const insertStudentStmt = db.prepare(`
  INSERT INTO students (registration_number, created_at, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(registration_number) DO NOTHING
`);

const touchStudentStmt = db.prepare(`
  UPDATE students SET updated_at = ? WHERE registration_number = ?
`);

const getStudentStmt = db.prepare(`
  SELECT * FROM students WHERE registration_number = ?
`);

const getCompletionsStmt = db.prepare(`
  SELECT category, item_number, completed, verified, completed_at
  FROM item_completions
  WHERE registration_number = ?
`);

// Sets verified = 1 unconditionally on every write — this statement is only
// ever reached from POST /api/verify (see routes/verify.js), which is the
// one place completion state is allowed to change now that the student-facing
// checkboxes are gone. completed_at is cleared on a failing result so a
// previously-passed-then-regressed item doesn't keep a stale pass timestamp.
const upsertVerifiedCompletionStmt = db.prepare(`
  INSERT INTO item_completions (registration_number, category, item_number, completed, verified, completed_at)
  VALUES (@registration_number, @category, @item_number, @completed, 1, @completed_at)
  ON CONFLICT(registration_number, category, item_number)
  DO UPDATE SET completed = excluded.completed, verified = 1, completed_at = excluded.completed_at
`);

const deleteCompletionsStmt = db.prepare(`
  DELETE FROM item_completions WHERE registration_number = ?
`);

const deleteStudentStmt = db.prepare(`
  DELETE FROM students WHERE registration_number = ?
`);

const deleteStudentTxn = db.transaction((registrationNumber) => {
  deleteCompletionsStmt.run(registrationNumber);
  return deleteStudentStmt.run(registrationNumber);
});

// backend_completed / frontend_completed only count rows that are BOTH
// completed and verified — an item can only reach completed = 1 via
// POST /api/verify now, but this also means pre-migration rows left behind
// by the old manual checkboxes (completed = 1, verified = 0) never get
// counted as progress. total_verified is a separate, pass-or-fail count of
// how many items have actually been run through npm run self-check at all,
// surfaced on the dashboard as the "Verified" column.
const listWithCountsStmt = db.prepare(`
  SELECT
    s.registration_number AS registration_number,
    s.created_at AS created_at,
    s.updated_at AS updated_at,
    COALESCE(SUM(CASE WHEN ic.category = 'backend' AND ic.completed = 1 AND ic.verified = 1 THEN 1 ELSE 0 END), 0) AS backend_completed,
    COALESCE(SUM(CASE WHEN ic.category = 'frontend' AND ic.completed = 1 AND ic.verified = 1 THEN 1 ELSE 0 END), 0) AS frontend_completed,
    COALESCE(SUM(CASE WHEN ic.verified = 1 THEN 1 ELSE 0 END), 0) AS total_verified
  FROM students s
  LEFT JOIN item_completions ic ON ic.registration_number = s.registration_number
  GROUP BY s.registration_number
  ORDER BY s.registration_number ASC
`);

function isValidCategory(category) {
  return category === 'backend' || category === 'frontend';
}

function isValidItemNumber(category, itemNumber) {
  const list = category === 'backend' ? BACKEND_ITEMS : FRONTEND_ITEMS;
  return list.some((item) => item.number === itemNumber);
}

function ensureStudent(registrationNumber) {
  const ts = nowIso();
  insertStudentStmt.run(registrationNumber, ts, ts);
  return getStudentStmt.get(registrationNumber);
}

// status is the single field the read-only UI renders from: 'not_tested'
// until a self-check run has actually verified the item, then 'passed' or
// 'failed' — completed alone is never trusted without verified = 1.
function statusOf(state) {
  if (!state || !state.verified) return 'not_tested';
  return state.completed ? 'passed' : 'failed';
}

function buildItemsView(registrationNumber) {
  const rows = getCompletionsStmt.all(registrationNumber);
  const completedMap = new Map();
  for (const row of rows) {
    completedMap.set(`${row.category}:${row.item_number}`, {
      completed: !!row.completed,
      verified: !!row.verified,
      completed_at: row.completed_at
    });
  }

  const mapItems = (items, category) =>
    items.map((item) => {
      const state = completedMap.get(`${category}:${item.number}`);
      const status = statusOf(state);
      return {
        number: item.number,
        text: item.text,
        // completed only ever reads true once status is genuinely 'passed'
        // (verified AND completed) — a stray completed = 1 left over from a
        // pre-migration manual checkbox, with verified still 0, must not
        // count here.
        completed: status === 'passed',
        verified: state ? state.verified : false,
        status,
        completed_at: state ? state.completed_at : null
      };
    });

  const backend = mapItems(BACKEND_ITEMS, 'backend');
  const frontend = mapItems(FRONTEND_ITEMS, 'frontend');
  const backendCompleted = backend.filter((i) => i.completed).length;
  const frontendCompleted = frontend.filter((i) => i.completed).length;

  return {
    backend,
    frontend,
    counts: {
      backend: { completed: backendCompleted, total: BACKEND_TOTAL },
      frontend: { completed: frontendCompleted, total: FRONTEND_TOTAL },
      total: {
        completed: backendCompleted + frontendCompleted,
        total: BACKEND_TOTAL + FRONTEND_TOTAL
      }
    }
  };
}

// Creates the student on first contact ("Start"), or returns their existing
// progress ("Resume") — the landing page uses this single call for both.
function getStudentProgress(registrationNumberRaw) {
  const registrationNumber = normalizeRegNumber(registrationNumberRaw);
  if (!registrationNumber) return null;
  const student = ensureStudent(registrationNumber);
  const items = buildItemsView(registrationNumber);
  return {
    registration_number: student.registration_number,
    created_at: student.created_at,
    updated_at: student.updated_at,
    ...items
  };
}

// Read-only variant used on page refresh — never silently creates a student.
function loadStudentProgress(registrationNumberRaw) {
  const registrationNumber = normalizeRegNumber(registrationNumberRaw);
  const student = getStudentStmt.get(registrationNumber);
  if (!student) return null;
  const items = buildItemsView(registrationNumber);
  return {
    registration_number: student.registration_number,
    created_at: student.created_at,
    updated_at: student.updated_at,
    ...items
  };
}

// Sole write path for item_completions, reached from POST /api/verify (see
// routes/verify.js) after a real `npm run self-check` run. results is an
// array of { category, itemNumber, passed } exactly as sent by the
// TicketDesk repo's grading script — the contract is documented in
// TicketDesk_Automated_Grading_Build_Prompt.md section 3.
const applyVerifiedResultsTxn = db.transaction((registrationNumber, results, ts) => {
  for (const { category, itemNumber, passed } of results) {
    upsertVerifiedCompletionStmt.run({
      registration_number: registrationNumber,
      category,
      item_number: itemNumber,
      completed: passed ? 1 : 0,
      completed_at: passed ? ts : null
    });
  }
  touchStudentStmt.run(ts, registrationNumber);
});

function applyVerifiedResults(registrationNumberRaw, results) {
  const registrationNumber = normalizeRegNumber(registrationNumberRaw);
  ensureStudent(registrationNumber);
  applyVerifiedResultsTxn(registrationNumber, results, nowIso());
  return buildItemsView(registrationNumber);
}

function listStudentsWithCounts() {
  return listWithCountsStmt.all();
}

function deleteStudent(registrationNumberRaw) {
  const registrationNumber = normalizeRegNumber(registrationNumberRaw);
  if (!registrationNumber) return false;
  const result = deleteStudentTxn(registrationNumber);
  return result.changes > 0;
}

module.exports = {
  BACKEND_TOTAL,
  FRONTEND_TOTAL,
  normalizeRegNumber,
  isValidCategory,
  isValidItemNumber,
  getStudentProgress,
  loadStudentProgress,
  applyVerifiedResults,
  listStudentsWithCounts,
  deleteStudent
};
