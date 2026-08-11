const Student = require('./models/Student');
const ItemCompletion = require('./models/ItemCompletion');
const { BACKEND_ITEMS, FRONTEND_ITEMS } = require('./items');

const BACKEND_TOTAL = BACKEND_ITEMS.length;
const FRONTEND_TOTAL = FRONTEND_ITEMS.length;

// Thrown by checkAndLockIp — routes/verify.js catches this specifically and
// responds 403, keeping the student-facing message generic while the full
// detail (both registration numbers + the IP involved) is available on
// err.details for the trainer to read out of the server logs.
class IpLockConflictError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'IpLockConflictError';
    this.details = details;
  }
}

// Registration numbers are normalized so the same student can't end up as
// two different rows across Day 1 and Day 2 just because of stray
// whitespace or letter case.
function normalizeRegNumber(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

function isValidCategory(category) {
  return category === 'backend' || category === 'frontend';
}

function isValidItemNumber(category, itemNumber) {
  const list = category === 'backend' ? BACKEND_ITEMS : FRONTEND_ITEMS;
  return list.some((item) => item.number === itemNumber);
}

// Creates the student row on first contact, or returns the existing one
// untouched. Deliberately skips Mongoose's automatic timestamps (via the
// `timestamps: false` query option) and sets createdAt/updatedAt itself
// only inside $setOnInsert — otherwise every plain lookup (e.g. a status
// page refresh) would bump updated_at, and the admin dashboard's "last
// reported" column is meant to reflect the last verified self-check run,
// not the last time anyone viewed the page. See touchStudent for the one
// place updated_at is actually meant to move.
async function ensureStudent(registrationNumber) {
  const now = new Date();
  return Student.findOneAndUpdate(
    { registrationNumber },
    { $setOnInsert: { registrationNumber, createdAt: now, updatedAt: now } },
    { upsert: true, new: true, timestamps: false }
  );
}

async function touchStudent(registrationNumber, when) {
  await Student.updateOne(
    { registrationNumber },
    { $set: { updatedAt: when } },
    { timestamps: false }
  );
}

// status is the single field the read-only UI renders from: 'not_tested'
// until a self-check run has actually verified the item, then 'passed' or
// 'failed' — completed alone is never trusted without verified = true.
function statusOf(state) {
  if (!state || !state.verified) return 'not_tested';
  return state.completed ? 'passed' : 'failed';
}

async function buildItemsView(registrationNumber) {
  const rows = await ItemCompletion.find({ registrationNumber }).lean();
  const completedMap = new Map();
  for (const row of rows) {
    completedMap.set(`${row.category}:${row.itemNumber}`, {
      completed: !!row.completed,
      verified: !!row.verified,
      completed_at: row.completedAt ? row.completedAt.toISOString() : null
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
        // (verified AND completed) — a stray completed = true left over
        // from a pre-migration manual checkbox, with verified still false,
        // must not count here.
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
async function getStudentProgress(registrationNumberRaw) {
  const registrationNumber = normalizeRegNumber(registrationNumberRaw);
  if (!registrationNumber) return null;
  const student = await ensureStudent(registrationNumber);
  const items = await buildItemsView(registrationNumber);
  return {
    registration_number: student.registrationNumber,
    created_at: student.createdAt.toISOString(),
    updated_at: student.updatedAt.toISOString(),
    ...items
  };
}

// Read-only variant used on page refresh — never silently creates a student.
async function loadStudentProgress(registrationNumberRaw) {
  const registrationNumber = normalizeRegNumber(registrationNumberRaw);
  const student = await Student.findOne({ registrationNumber }).lean();
  if (!student) return null;
  const items = await buildItemsView(registrationNumber);
  return {
    registration_number: student.registrationNumber,
    created_at: student.createdAt.toISOString(),
    updated_at: student.updatedAt.toISOString(),
    ...items
  };
}

// Sole write path for item completions, reached from POST /api/verify (see
// routes/verify.js) after a real `npm run self-check` run, and only once
// routes/verify.js has confirmed the (registration number, IP) pairing via
// checkAndLockIp below. results is an array of { category, itemNumber,
// passed } exactly as sent by the TicketDesk repo's grading script.
async function applyVerifiedResults(registrationNumberRaw, results) {
  const registrationNumber = normalizeRegNumber(registrationNumberRaw);
  await ensureStudent(registrationNumber);

  const now = new Date();
  // Sequential, not Promise.all: if `results` ever contained two entries
  // for the same item (it shouldn't, but nothing upstream guarantees it),
  // this keeps "last one in the array wins" deterministic instead of
  // depending on driver-level interleaving.
  for (const { category, itemNumber, passed } of results) {
    await ItemCompletion.updateOne(
      { registrationNumber, category, itemNumber },
      { $set: { completed: !!passed, verified: true, completedAt: passed ? now : null } },
      { upsert: true }
    );
  }

  await touchStudent(registrationNumber, now);
  return buildItemsView(registrationNumber);
}

// backend_completed / frontend_completed only count rows that are BOTH
// completed and verified — an item can only reach completed = true via
// POST /api/verify. total_verified is a separate, pass-or-fail count of how
// many items have actually been run through npm run self-check at all,
// surfaced on the dashboard as the "Verified" column. Computed in JS after
// fetching both collections rather than as a database aggregation — at
// ~119 students x 30 items this is a trivial amount of data, and a
// hand-rolled pipeline isn't worth the added complexity at this scale.
async function listStudentsWithCounts() {
  const [students, completions] = await Promise.all([
    Student.find().sort({ registrationNumber: 1 }).lean(),
    ItemCompletion.find().lean()
  ]);

  const completionsByReg = new Map();
  for (const row of completions) {
    if (!completionsByReg.has(row.registrationNumber)) {
      completionsByReg.set(row.registrationNumber, []);
    }
    completionsByReg.get(row.registrationNumber).push(row);
  }

  return students.map((student) => {
    const rows = completionsByReg.get(student.registrationNumber) || [];
    const backend_completed = rows.filter(
      (r) => r.category === 'backend' && r.completed && r.verified
    ).length;
    const frontend_completed = rows.filter(
      (r) => r.category === 'frontend' && r.completed && r.verified
    ).length;
    const total_verified = rows.filter((r) => r.verified).length;

    return {
      registration_number: student.registrationNumber,
      created_at: student.createdAt.toISOString(),
      updated_at: student.updatedAt.toISOString(),
      locked_ip: student.lockedIp || null,
      backend_completed,
      frontend_completed,
      total_verified
    };
  });
}

async function deleteStudent(registrationNumberRaw) {
  const registrationNumber = normalizeRegNumber(registrationNumberRaw);
  if (!registrationNumber) return false;
  await ItemCompletion.deleteMany({ registrationNumber });
  const result = await Student.deleteOne({ registrationNumber });
  return result.deletedCount > 0;
}

// Enforces "one registration number per IP, one IP per registration
// number" on POST /api/verify only — not on the status-lookup endpoints,
// where checking your own progress from a second device is normal and not
// an integrity risk. The first successful self-check report from a given
// registration number locks it to that IP; every later report must come
// from the same IP, and that IP can't be reused to report under a
// different registration number. The unique sparse index on
// Student.lockedIp (see models/Student.js) is the hard guarantee behind
// this — the catch below only exists to turn a rare concurrent-request
// race into the same friendly error instead of a raw duplicate-key 500.
async function checkAndLockIp(registrationNumberRaw, ip) {
  const registrationNumber = normalizeRegNumber(registrationNumberRaw);
  const student = await ensureStudent(registrationNumber);

  if (student.lockedIp && student.lockedIp !== ip) {
    throw new IpLockConflictError(
      'This registration number has already reported self-check results from a different device or network.',
      { reason: 'registration_ip_mismatch', registrationNumber, lockedIp: student.lockedIp, attemptedIp: ip }
    );
  }

  const conflictingStudent = await Student.findOne({
    lockedIp: ip,
    registrationNumber: { $ne: registrationNumber }
  }).lean();
  if (conflictingStudent) {
    throw new IpLockConflictError(
      'This device or network has already reported self-check results under a different registration number.',
      {
        reason: 'ip_registration_mismatch',
        registrationNumber,
        conflictingRegistrationNumber: conflictingStudent.registrationNumber,
        ip
      }
    );
  }

  if (!student.lockedIp) {
    try {
      await Student.updateOne(
        { registrationNumber },
        { $set: { lockedIp: ip, lockedIpSetAt: new Date() } },
        { timestamps: false }
      );
    } catch (err) {
      if (err && err.code === 11000) {
        throw new IpLockConflictError(
          'This device or network has already reported self-check results under a different registration number.',
          { reason: 'ip_registration_mismatch_race', registrationNumber, ip }
        );
      }
      throw err;
    }
  }
}

// Trainer-only escape hatch (PATCH /api/admin/students/:reg/unlock-ip) for
// legitimate IP changes — a new laptop, a reassigned dynamic IP between
// workshop days, a mobile hotspot reconnect. Clears the lock without
// touching any recorded progress. Uses $unset rather than setting the
// fields to null, so the document goes back to genuinely missing the field
// — required for the sparse unique index to exclude it again (see
// models/Student.js).
async function unlockStudentIp(registrationNumberRaw) {
  const registrationNumber = normalizeRegNumber(registrationNumberRaw);
  if (!registrationNumber) return false;
  const result = await Student.updateOne(
    { registrationNumber },
    { $unset: { lockedIp: '', lockedIpSetAt: '' } },
    { timestamps: false }
  );
  return result.matchedCount > 0;
}

module.exports = {
  BACKEND_TOTAL,
  FRONTEND_TOTAL,
  IpLockConflictError,
  normalizeRegNumber,
  isValidCategory,
  isValidItemNumber,
  getStudentProgress,
  loadStudentProgress,
  applyVerifiedResults,
  listStudentsWithCounts,
  deleteStudent,
  checkAndLockIp,
  unlockStudentIp
};
