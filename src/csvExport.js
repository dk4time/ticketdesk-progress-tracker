const HEADER = [
  'Registration Number',
  'Backend+DB Completed',
  'Backend+DB Total',
  'Frontend Completed',
  'Frontend Total',
  'Total Completed',
  'Total Items',
  'Verified',
  'Last Updated'
];

function toCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Uses the same formatted rows as the dashboard JSON and PDF export, so all
// three always agree with each other.
function buildCsv(rows) {
  const sorted = [...rows].sort((a, b) => a.registration_number.localeCompare(b.registration_number));

  const lines = [HEADER.map(toCsvField).join(',')];
  for (const row of sorted) {
    const updated = row.updated_at ? new Date(row.updated_at).toLocaleString() : '';
    const line = [
      row.registration_number,
      row.backend_completed,
      row.backend_total,
      row.frontend_completed,
      row.frontend_total,
      row.total_completed,
      row.total_items,
      `${row.total_verified}/${row.total_items}`,
      updated
    ];
    lines.push(line.map(toCsvField).join(','));
  }

  return lines.join('\r\n') + '\r\n';
}

module.exports = { buildCsv };
