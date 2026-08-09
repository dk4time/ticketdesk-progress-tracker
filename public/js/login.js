(function () {
  const form = document.getElementById('login-form');
  const pinInput = document.getElementById('pin-input');
  const errorEl = document.getElementById('login-error');

  function redirectTarget() {
    const raw = new URLSearchParams(window.location.search).get('redirect');
    return raw && raw.startsWith('/') ? raw : '/';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.hidden = true;

    const pin = pinInput.value.trim();
    if (!pin) return;

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        errorEl.textContent = data.error || 'Incorrect PIN.';
        errorEl.hidden = false;
        pinInput.value = '';
        pinInput.focus();
        return;
      }

      window.location.href = redirectTarget();
    } catch (err) {
      errorEl.textContent = 'Could not reach the server. Try again.';
      errorEl.hidden = false;
    }
  });
})();
