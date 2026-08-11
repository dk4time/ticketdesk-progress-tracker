(function () {
  const tbody = document.getElementById('students-tbody');
  const searchInput = document.getElementById('search-input');
  const refreshBtn = document.getElementById('refresh-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const emptyState = document.getElementById('empty-state');
  const headers = document.querySelectorAll('#students-table th[data-sort]');

  let students = [];
  let sortKey = 'registration_number';
  let sortDir = 'asc';

  async function loadStudents() {
    try {
      const [studentsRes, summaryRes] = await Promise.all([
        fetch('/api/admin/students'),
        fetch('/api/admin/summary')
      ]);
      students = await studentsRes.json();
      const summary = await summaryRes.json();
      updateSummary(summary);
      render();
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  }

  function updateSummary(summary) {
    document.getElementById('summary-started').textContent = summary.started;
    document.getElementById('summary-completed-all').textContent = summary.completedAll;
    document.getElementById('summary-average').textContent = `${summary.averageCompletionPercent}%`;
  }

  function getFiltered() {
    const q = searchInput.value.trim().toLowerCase();
    let rows = students;
    if (q) {
      rows = rows.filter((s) => s.registration_number.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function cell(text) {
    const td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  function render() {
    const rows = getFiltered();
    tbody.innerHTML = '';
    emptyState.hidden = rows.length !== 0;

    rows.forEach((s) => {
      const tr = document.createElement('tr');

      tr.appendChild(cell(s.registration_number));
      tr.appendChild(cell(`${s.backend_completed}/${s.backend_total}`));
      tr.appendChild(cell(`${s.frontend_completed}/${s.frontend_total}`));
      tr.appendChild(cell(`${s.total_completed}/${s.total_items}`));
      tr.appendChild(cell(`${s.total_verified}/${s.total_items}`));
      tr.appendChild(cell(s.locked_ip || '-'));
      tr.appendChild(cell(s.updated_at ? new Date(s.updated_at).toLocaleString() : '-'));

      const actionTd = document.createElement('td');

      if (s.locked_ip) {
        const unlockBtn = document.createElement('button');
        unlockBtn.textContent = 'Unlock IP';
        unlockBtn.addEventListener('click', () => unlockStudentIp(s.registration_number));
        actionTd.appendChild(unlockBtn);
      }

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'danger-btn';
      delBtn.addEventListener('click', () => deleteStudent(s.registration_number));
      actionTd.appendChild(delBtn);
      tr.appendChild(actionTd);

      tbody.appendChild(tr);
    });

    headers.forEach((th) => {
      th.classList.toggle('sorted-asc', th.dataset.sort === sortKey && sortDir === 'asc');
      th.classList.toggle('sorted-desc', th.dataset.sort === sortKey && sortDir === 'desc');
    });
  }

  async function deleteStudent(reg) {
    if (!confirm(`Delete all progress for ${reg}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(reg)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await loadStudents();
    } catch (err) {
      alert('Could not delete this entry.');
    }
  }

  async function unlockStudentIp(reg) {
    if (!confirm(`Clear the locked IP for ${reg}? Their recorded progress is kept — they'll just be able to report from a new device/network again.`)) return;
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(reg)}/unlock-ip`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Unlock failed');
      await loadStudents();
    } catch (err) {
      alert('Could not unlock this entry.');
    }
  }

  headers.forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey = key;
        sortDir = 'asc';
      }
      render();
    });
  });

  searchInput.addEventListener('input', render);
  refreshBtn.addEventListener('click', loadStudents);
  exportPdfBtn.addEventListener('click', () => {
    window.location.href = '/api/admin/export.pdf';
  });
  exportCsvBtn.addEventListener('click', () => {
    window.location.href = '/api/admin/export.csv';
  });

  loadStudents();
  setInterval(loadStudents, 10000);
})();
