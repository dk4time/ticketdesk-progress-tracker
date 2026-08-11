const express = require('express');
const progress = require('../progress');
const { generatePdfReport } = require('../pdfExport');
const { buildCsv } = require('../csvExport');

const router = express.Router();

// Shared row shape used by the dashboard JSON, the PDF export, and the CSV
// export, so all three always agree with each other.
function formatRow(row) {
  return {
    registration_number: row.registration_number,
    backend_completed: row.backend_completed,
    backend_total: progress.BACKEND_TOTAL,
    frontend_completed: row.frontend_completed,
    frontend_total: progress.FRONTEND_TOTAL,
    total_completed: row.backend_completed + row.frontend_completed,
    total_items: progress.BACKEND_TOTAL + progress.FRONTEND_TOTAL,
    // Count of items an actual `npm run self-check` run has touched (pass or
    // fail) — distinct from total_completed, which only counts passes. This
    // is what makes the report's "Verified" column mean something: it's
    // visible proof the numbers came from automated checks, not self-report.
    total_verified: row.total_verified,
    locked_ip: row.locked_ip,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.get('/students', async (req, res) => {
  try {
    const rows = (await progress.listStudentsWithCounts()).map(formatRow);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/admin/students failed:', err);
    res.status(500).json({ error: 'Could not load students.' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const rows = await progress.listStudentsWithCounts();
    const totalItems = progress.BACKEND_TOTAL + progress.FRONTEND_TOTAL;
    const started = rows.length;
    const completedAll = rows.filter(
      (r) => r.backend_completed + r.frontend_completed === totalItems
    ).length;

    const averageCompletionPercent =
      started === 0
        ? 0
        : Math.round(
            (rows.reduce((sum, r) => sum + r.backend_completed + r.frontend_completed, 0) /
              started /
              totalItems) *
              1000
          ) / 10;

    res.json({ started, completedAll, averageCompletionPercent, totalItems });
  } catch (err) {
    console.error('GET /api/admin/summary failed:', err);
    res.status(500).json({ error: 'Could not load summary.' });
  }
});

router.delete('/students/:reg', async (req, res) => {
  try {
    const deleted = await progress.deleteStudent(req.params.reg);
    if (!deleted) {
      return res.status(404).json({ error: 'Registration number not found.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/students/:reg failed:', err);
    res.status(500).json({ error: 'Could not delete student.' });
  }
});

// Clears a registration number's IP lock without touching their recorded
// progress — for legitimate IP changes (new laptop, a reassigned dynamic
// IP between workshop days, a mobile hotspot reconnect) that would
// otherwise get permanently blocked by POST /api/verify's IP lock.
router.patch('/students/:reg/unlock-ip', async (req, res) => {
  try {
    const unlocked = await progress.unlockStudentIp(req.params.reg);
    if (!unlocked) {
      return res.status(404).json({ error: 'Registration number not found.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/students/:reg/unlock-ip failed:', err);
    res.status(500).json({ error: 'Could not unlock IP.' });
  }
});

router.get('/export.pdf', async (req, res) => {
  try {
    const rows = (await progress.listStudentsWithCounts()).map(formatRow);
    generatePdfReport(res, rows);
  } catch (err) {
    console.error('GET /api/admin/export.pdf failed:', err);
    res.status(500).json({ error: 'Could not generate PDF report.' });
  }
});

router.get('/export.csv', async (req, res) => {
  try {
    const rows = (await progress.listStudentsWithCounts()).map(formatRow);
    const csv = buildCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ticketdesk-progress-report.csv"');
    res.send(csv);
  } catch (err) {
    console.error('GET /api/admin/export.csv failed:', err);
    res.status(500).json({ error: 'Could not generate CSV report.' });
  }
});

module.exports = router;
