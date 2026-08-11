require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");

const db = require("./src/db");
const studentRoutes = require("./src/routes/student");
const adminRoutes = require("./src/routes/admin");
const verifyRoutes = require("./src/routes/verify");
const { getLocalIp } = require("./src/network");
const { requireAuth, checkPin } = require("./src/auth");

const app = express();

// Render (and any other host running this behind a reverse proxy) doesn't
// hand us the student's real IP directly — it arrives via X-Forwarded-For.
// Trusting exactly 1 hop tells Express to read the client IP from that
// header instead of the socket's peer address (which would just be
// Render's proxy for every single request). This is what makes req.ip in
// routes/verify.js actually distinguish one student's machine from
// another's — without it, the IP lock would see every request as coming
// from the same address.
app.set("trust proxy", 1);

app.use(express.json());
app.use(
  session({
    // Regenerated on every restart — fine for a classroom app where
    // "restart the server" and "log in again" are an acceptable pairing.
    secret:
      process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000, // 12 hours, covers a full workshop day
    },
  }),
);

// Login/logout are registered before the auth gate so they're always reachable.
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { pin } = req.body || {};

  if (!checkPin(pin)) {
    return res.status(401).json({ error: "Incorrect PIN." });
  }

  req.session.authenticated = true;
  res.json({ ok: true });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Registered before the session-auth gate, same as /login above — this
// endpoint is called by each student's own machine (no browser session),
// authenticated instead by the x-grading-key header inside verifyRoutes.
app.use("/api/verify", verifyRoutes);

app.use(requireAuth);
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/students", studentRoutes);
app.use("/api/admin", adminRoutes);

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

const PORT = process.env.PORT || 3000;

// Connect before accepting traffic — otherwise the first requests in after
// a cold start could race an unready Mongo connection.
db.connect()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      const ip = getLocalIp();
      const studentUrl = `http://${ip}:${PORT}`;
      const adminUrl = `${studentUrl}/admin`;
      const width = Math.max(studentUrl.length, adminUrl.length) + 24;
      const border = "=".repeat(width);

      console.log(`\n${border}`);
      console.log(`  Students connect at: ${studentUrl}`);
      console.log(`  Trainer dashboard:   ${adminUrl}`);
      console.log(`${border}\n`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });
