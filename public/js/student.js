(function () {
  const landingView = document.getElementById('landing-view');
  const checklistView = document.getElementById('checklist-view');
  const landingForm = document.getElementById('landing-form');
  const regInput = document.getElementById('reg-input');
  const landingError = document.getElementById('landing-error');
  const regDisplay = document.getElementById('reg-display');
  const switchBtn = document.getElementById('switch-btn');
  const totalsDisplay = document.getElementById('totals-display');
  const backendCount = document.getElementById('backend-count');
  const frontendCount = document.getElementById('frontend-count');
  const backendList = document.getElementById('backend-list');
  const frontendList = document.getElementById('frontend-list');

  let currentReg = null;

  function showLanding() {
    checklistView.hidden = true;
    landingView.hidden = false;
    currentReg = null;
    regInput.value = '';
    landingError.hidden = true;
    regInput.focus();
  }

  function showChecklist(data) {
    landingView.hidden = true;
    checklistView.hidden = false;
    currentReg = data.registration_number;
    regDisplay.textContent = currentReg;
    renderItems(data);
  }

  function updateTotals(counts) {
    backendCount.textContent = `${counts.backend.completed}/${counts.backend.total}`;
    frontendCount.textContent = `${counts.frontend.completed}/${counts.frontend.total}`;
    totalsDisplay.textContent =
      `Backend+DB: ${counts.backend.completed}/${counts.backend.total} · ` +
      `Frontend: ${counts.frontend.completed}/${counts.frontend.total} · ` +
      `Total: ${counts.total.completed}/${counts.total.total}`;
  }

  const STATUS_LABEL = {
    passed: '✓ Passed',
    failed: '✗ Failed',
    not_tested: 'Not tested yet'
  };

  // Read-only: status comes entirely from the last `npm run self-check` run
  // reported to POST /api/verify. There is nothing here for a student to
  // click — that's the point, this used to be a self-reported checkbox.
  function renderItem(item) {
    const li = document.createElement('li');
    li.className = 'item';

    const text = document.createElement('span');
    text.className = 'item-text';
    text.textContent = `${item.number}. ${item.text}`;

    const badge = document.createElement('span');
    badge.className = `status-badge status-${item.status}`;
    badge.textContent = STATUS_LABEL[item.status] || 'Not tested yet';

    li.appendChild(text);
    li.appendChild(badge);

    return li;
  }

  function renderItems(data) {
    updateTotals(data.counts);

    backendList.innerHTML = '';
    data.backend.forEach((item) => backendList.appendChild(renderItem(item)));

    frontendList.innerHTML = '';
    data.frontend.forEach((item) => frontendList.appendChild(renderItem(item)));
  }

  landingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const reg = regInput.value.trim();
    if (!reg) return;

    landingError.hidden = true;
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_number: reg })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not start session.');
      }
      const data = await res.json();
      showChecklist(data);
    } catch (err) {
      landingError.textContent = err.message;
      landingError.hidden = false;
    }
  });

  switchBtn.addEventListener('click', showLanding);

  showLanding();
})();
