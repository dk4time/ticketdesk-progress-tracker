const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const studentRoutes = require('./src/routes/student');
const adminRoutes = require('./src/routes/admin');
const verifyRoutes = require('./src/routes/verify');
const { getLocalIp } = require('./src/network');
const { requireAuth, checkPin } = require('./src/auth');

const app = express();

app.use(express.json());
app.use(
  session({
    // Regenerated on every restart — fine for a classroom app where
    // "restart the server" and "log in again" are an acceptable pairing.
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours, covers a full workshop day
    }
  })
);

// Login/logout are registered before the auth gate so they're always reachable.
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { pin } = req.body || {};

  if (!checkPin(pin)) {
    return res.status(401).json({ error: 'Incorrect PIN.' });
  }

  req.session.authenticated = true;
  res.json({ ok: true });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Registered before the session-auth gate, same as /login above — this
// endpoint is called by each student's own machine (no browser session),
// authenticated instead by the x-grading-key header inside verifyRoutes.
app.use('/api/verify', verifyRoutes);

app.use(requireAuth);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/students', studentRoutes);
app.use('/api/admin', adminRoutes);

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  const studentUrl = `http://${ip}:${PORT}`;
  const adminUrl = `${studentUrl}/admin`;
  const width = Math.max(studentUrl.length, adminUrl.length) + 24;
  const border = '='.repeat(width);

  console.log(`\n${border}`);
  console.log(`  Students connect at: ${studentUrl}`);
  console.log(`  Trainer dashboard:   ${adminUrl}`);
  console.log(`${border}\n`);
});
