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
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.get('/students', (req, res) => {
  const rows = progress.listStudentsWithCounts().map(formatRow);
  res.json(rows);
});

router.get('/summary', (req, res) => {
  const rows = progress.listStudentsWithCounts();
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
});

router.delete('/students/:reg', (req, res) => {
  const deleted = progress.deleteStudent(req.params.reg);
  if (!deleted) {
    return res.status(404).json({ error: 'Registration number not found.' });
  }
  res.json({ ok: true });
});

router.get('/export.pdf', (req, res) => {
  const rows = progress.listStudentsWithCounts().map(formatRow);
  generatePdfReport(res, rows);
});

router.get('/export.csv', (req, res) => {
  const rows = progress.listStudentsWithCounts().map(formatRow);
  const csv = buildCsv(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ticketdesk-progress-report.csv"');
  res.send(csv);
});

module.exports = router;
