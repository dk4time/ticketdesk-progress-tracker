const PIN = process.env.PROGRESS_TRACKER_PIN || '060702';

// Static assets the login page itself needs before a session exists.
const PUBLIC_PATHS = new Set(['/css/style.css', '/js/login.js']);

function checkPin(candidate) {
  return typeof candidate === 'string' && candidate.trim() === PIN;
}

// Gate everything else behind the session set by POST /login. GET/POST
// /login are registered before this middleware so they're always reachable.
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }

  if (PUBLIC_PATHS.has(req.path)) {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const redirect = encodeURIComponent(req.originalUrl);
  res.redirect(`/login?redirect=${redirect}`);
}

module.exports = { requireAuth, checkPin };
