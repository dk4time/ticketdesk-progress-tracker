(function () {
  document.querySelectorAll('[data-logout]').forEach((el) => {
    el.addEventListener('click', async (event) => {
      event.preventDefault();
      await fetch('/logout', { method: 'POST' });
      window.location.href = '/login';
    });
  });
})();
