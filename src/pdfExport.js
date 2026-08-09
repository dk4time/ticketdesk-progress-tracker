const PDFDocument = require('pdfkit');

// Trainer-editable config — update these before generating the final report
// for a given workshop run. Kept at the top, not buried in layout logic.
const WORKSHOP_NAME = 'TicketDesk MERN Workshop';
const WORKSHOP_DATES = 'Day 1 - Day 2';

const COLUMNS = [
  { label: 'Registration No.', x: 40, width: 140 },
  { label: 'Backend+DB', x: 185, width: 70 },
  { label: 'Frontend', x: 260, width: 60 },
  { label: 'Total', x: 325, width: 50 },
  { label: 'Verified', x: 380, width: 60 },
  { label: 'Last Updated', x: 445, width: 110 }
];

function drawReportHeader(doc) {
  doc.fontSize(18).font('Helvetica-Bold').text(WORKSHOP_NAME, { align: 'center' });
  doc.fontSize(11).font('Helvetica').text(WORKSHOP_DATES, { align: 'center' });
  doc.moveDown(0.5);
  doc
    .fontSize(9)
    .fillColor('#555555')
    .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(1);
}

function drawTableHeader(doc) {
  const y = doc.y;
  doc.fontSize(10).font('Helvetica-Bold');
  COLUMNS.forEach((col) => doc.text(col.label, col.x, y, { width: col.width }));
  doc.moveDown(0.6);
  doc
    .moveTo(40, doc.y)
    .lineTo(560, doc.y)
    .strokeColor('#cccccc')
    .stroke();
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor('#000000');
}

function generatePdfReport(res, rows) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="ticketdesk-progress-report.pdf"');
  doc.pipe(res);

  const sorted = [...rows].sort((a, b) => a.registration_number.localeCompare(b.registration_number));

  drawReportHeader(doc);
  drawTableHeader(doc);

  doc.fontSize(9);
  for (const row of sorted) {
    if (doc.y > doc.page.height - 60) {
      doc.addPage();
      drawTableHeader(doc);
      doc.fontSize(9);
    }

    const y = doc.y;
    doc.text(row.registration_number, COLUMNS[0].x, y, { width: COLUMNS[0].width });
    doc.text(`${row.backend_completed}/${row.backend_total}`, COLUMNS[1].x, y, { width: COLUMNS[1].width });
    doc.text(`${row.frontend_completed}/${row.frontend_total}`, COLUMNS[2].x, y, { width: COLUMNS[2].width });
    doc.text(`${row.total_completed}/${row.total_items}`, COLUMNS[3].x, y, { width: COLUMNS[3].width });
    doc.text(`${row.total_verified}/${row.total_items}`, COLUMNS[4].x, y, { width: COLUMNS[4].width });
    doc.text(row.updated_at ? new Date(row.updated_at).toLocaleString() : '-', COLUMNS[5].x, y, {
      width: COLUMNS[5].width
    });
    doc.moveDown(0.6);
  }

  if (sorted.length === 0) {
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#555555').text('No student data recorded yet.', { align: 'center' });
  }

  doc.end();
}

module.exports = { generatePdfReport, WORKSHOP_NAME, WORKSHOP_DATES };
