const express = require('express');
const progress = require('../progress');
const { requireGradingKey } = require('../gradingAuth');

const router = express.Router();

function isValidResultEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (!progress.isValidCategory(entry.category)) return false;
  if (!Number.isInteger(entry.itemNumber) || !progress.isValidItemNumber(entry.category, entry.itemNumber)) {
    return false;
  }
  return typeof entry.passed === 'boolean';
}

// POST /api/verify — the only way item_completions can change now that the
// student-facing checkboxes are gone. Called by `npm run self-check` in the
// TicketDesk repo (see grading/self-check.js there); reject silently-wrong
// payloads with 400 rather than crashing, since this runs unattended from
// 100+ students' laptops over classroom WiFi.
router.post('/', requireGradingKey, async (req, res) => {
  const { registrationNumber, results } = req.body || {};
  const normalized = progress.normalizeRegNumber(registrationNumber);

  if (!normalized) {
    return res.status(400).json({ error: 'registrationNumber is required.' });
  }
  // An empty array is a legitimate report, not a malformed one — a student
  // whose backend/frontend didn't even start yet gets 0 testable items on a
  // run, and that "nothing tested" result must still land here (registering
  // the student so their status page shows "Not tested yet" instead of
  // 404), never silently dropped for looking sparse.
  if (!Array.isArray(results)) {
    return res.status(400).json({ error: 'results must be an array.' });
  }
  if (!results.every(isValidResultEntry)) {
    return res.status(400).json({ error: 'Each result entry needs a valid category, itemNumber, and boolean passed.' });
  }

  // One registration number per IP and vice versa — stops a student from
  // running self-check with someone else's already-passing solution on a
  // laptop that isn't theirs. Only enforced here, not on the read-only
  // status endpoints, since checking your own progress from a second
  // device is normal and not an integrity risk. The message shown to the
  // student is deliberately generic; the other registration number
  // involved is only ever logged server-side for the trainer.
  try {
    await progress.checkAndLockIp(normalized, req.ip);
  } catch (err) {
    if (err instanceof progress.IpLockConflictError) {
      console.error('POST /api/verify blocked by IP lock:', err.details);
      return res.status(403).json({ error: err.message });
    }
    console.error('POST /api/verify IP check failed:', err);
    return res.status(500).json({ error: 'Could not record results.' });
  }

  try {
    const data = await progress.applyVerifiedResults(normalized, results);
    res.json({ ok: true, registration_number: normalized, counts: data.counts });
  } catch (err) {
    console.error('POST /api/verify failed:', err);
    res.status(400).json({ error: 'Could not record results.' });
  }
});

module.exports = router;
