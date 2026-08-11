# TicketDesk Progress Tracker

A small web app for tracking student progress on the 30-item TicketDesk
Student TODO Worksheet during the workshop. Hosted on Render at a stable
public URL so students report results over the internet instead of
depending on shared classroom WiFi.

This is independent of the TicketDesk project itself in every respect except
one: each student's own machine reports results here by calling
`POST /api/verify`, driven by the `npm run self-check` script that lives in
the TicketDesk repo's `grading/` folder. See "Automated grading" below.

Progress here is **read-only and machine-reported** — there are no
checkboxes anywhere in this app. A student's status only changes when their
own `npm run self-check` run posts real results.

## Tech stack

- Node.js + Express
- MongoDB (Atlas) via Mongoose — see "Persistence" below
- Plain HTML/CSS/JS frontend, no build step
- `pdfkit` for PDF export

## Setup

```
npm install
cp .env.example .env   # fill in MONGODB_URI at minimum
npm start
```

On startup the console prints the local network URL, e.g.:

```
=================================================
  Students connect at: http://192.168.1.42:3000
  Trainer dashboard:   http://192.168.1.42:3000/admin
=================================================
```

That URL is only meaningful for local/LAN use — in the hosted deployment,
students use the Render URL directly instead.

## Persistence (MongoDB Atlas)

All student progress lives in MongoDB Atlas, not on Render's local disk.
Render's filesystem doesn't reliably survive redeploys, restarts, or plan
changes even with a Disk attached — Atlas is external to Render entirely, so
none of that can take student data with it.

Set `MONGODB_URI` (see `.env.example`) to a full Atlas connection string
including the database name, e.g.:

```
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ticketdesk_progress
```

**Atlas setup, one-time:**
1. Create a free M0 cluster (or reuse an existing one) and a database user
   with read/write access.
2. Under Network Access, allow Render's traffic. Render doesn't have a
   static outbound IP on non-dedicated plans, so this usually means adding
   `0.0.0.0/0` to the IP access list (unless you're on Render's static-IP
   add-on, in which case allow-list that IP specifically).
3. Copy the connection string into `MONGODB_URI` — on Render, this is set
   under the service's Environment settings; locally, in `.env`.

The app fails fast with a clear error at startup if `MONGODB_URI` is
missing.

## Login

The whole app (checklist and trainer dashboard) sits behind a single shared
PIN so students on the classroom WiFi can't poke around before the session
starts. Default PIN: `060702`. Override it by setting `PROGRESS_TRACKER_PIN`
before `npm start`. There's a "Logout" link in the navbar on both pages if
you need to lock it again mid-session; otherwise the session lasts 12 hours
or until the server restarts.

## Automated grading

Students never click a checkbox in this app. Instead, from the TicketDesk
repo root they run:

```
npm run self-check
```

That script runs all 30 checks locally against their own backend/frontend,
prints a pass/fail summary in their terminal, and POSTs the results here to
`POST /api/verify`. This app upserts them, marking each item `verified` in
addition to `completed` — the dashboard, PDF, and CSV all read from
`verified` data only, never from `completed` alone, so a stray unverified row
can never inflate a count.

**Shared secret**: `POST /api/verify` requires an `x-grading-key` header
matching this app's `GRADING_KEY` environment variable. It defaults to
`tdsk-grading-8f3ac1e9b7d24f0a91c6e5b2d7a1f4c8`, matching the default already
baked into the TicketDesk repo's `grading/config.js` on the `student-start`
branch, so it works for the whole class out of the box. If you'd rather hand
out your own key, set `GRADING_KEY` here **and** the same value as
`GRADING_KEY` in each student's environment (or edit the default in
`grading/config.js` before distributing the repo) — the two sides must match
exactly, or every report gets rejected with 401.

**Honesty note**: this runs entirely on each student's own laptop, then
reports results to your machine. Like any self-hosted grading in a classroom
(not a locked-down exam environment), a technically determined student could
theoretically fake a passing result. The shared secret above is a reasonable
deterrent for a training workshop, not a tamper-proof guarantee — it exists
to replace slow manual review at 100+ student scale with trustworthy-by-default
automated checks, not to provide exam security.

If a registration number has never had a self-check run, every item shows
as "Not tested yet," never as failed — failed only means a check genuinely
ran and didn't pass.

**One IP per registration number**: `POST /api/verify` locks each
registration number to the IP address it first successfully reports results
from. Later reports must come from that same IP; that IP also can't be
reused to report under a different registration number. This is what stops
one student from running `npm run self-check` on a laptop that already has
someone else's passing solution under their own registration number — the
second (different) registration number gets rejected with a 403 the moment
it tries to report from that laptop. It only applies to `POST /api/verify`,
not to viewing a status page, so checking your own progress from a second
device is unaffected.

This relies on students being on individual networks (mobile hotspot, home
broadband) rather than one shared classroom router — if many students sit
behind the same NAT'd public IP, they'll appear as one IP to this app and
the lock will misfire. It also means a genuine IP change (new laptop, an
ISP reassigning a dynamic IP between workshop days, reconnecting to a
different hotspot) will get blocked too. Either case shows up as a 403 in
the student's terminal; from the `/admin` dashboard, click **Unlock IP** on
that student's row to clear the lock without losing their recorded
progress, then they can report again from wherever they're on now.

## Day-to-day use

- **Day 1**: share the Render URL. Students open it, enter their
  registration number to view their status (all "Not tested yet" until
  their first `npm run self-check`), and run `npm run self-check` from the
  TicketDesk repo whenever they want to check progress or report it here.
- **Between days**: nothing to do — progress lives in Atlas, independent of
  whether the Render service restarts, redeploys, or sits idle.
- **Day 2**: students enter the same registration number and their Day 1
  status is still there.

## Trainer dashboard (`/admin`)

- Table of every student with Backend+DB, Frontend, Total, and **Verified**
  counts, plus when they last reported
- **Verified** is how many of the 30 items an actual self-check run has
  touched (pass or fail) — separate from Total, which only counts passes.
  It's the column that makes the report's numbers credible: proof they came
  from automated checks, not self-report.
- Click any column header to sort by it
- Search box to filter by registration number
- Refresh button (the table also auto-refreshes every 10 seconds)
- **Locked IP** column, and an **Unlock IP** button per row (only shown once
  a lock exists) — see "One IP per registration number" above
- Delete button per row, for removing a duplicate/mistyped registration
  number entry
- Summary strip: how many students have started, how many have completed
  all 30 items, and the class-wide average completion (both computed from
  verified passes only)
- **Export Report (PDF)** — a clean, presentable report for submission to
  the college, listing every student's counts including Verified
- **Export Report (CSV)** — the same data, opens directly in Excel/Google
  Sheets

The workshop name and dates shown on the PDF report are configured at the
top of `src/pdfExport.js` (`WORKSHOP_NAME`, `WORKSHOP_DATES`) — edit those
before generating the final report for a given run.

## Project layout

```
ticketdesk-progress-tracker/
├── server.js              # entry point: trust proxy, connects to Mongo, binds 0.0.0.0
├── src/
│   ├── db.js               # mongoose connection helper
│   ├── models/
│   │   ├── Student.js       # registrationNumber, lockedIp (+ unique sparse index), timestamps
│   │   └── ItemCompletion.js # one row per (student, item)
│   ├── items.js             # hardcoded 30-item catalog
│   ├── progress.js          # all student/progress data access + IP-lock logic
│   ├── network.js           # local IP detection (LAN URL printed at boot)
│   ├── pdfExport.js         # PDF report generation
│   ├── csvExport.js         # CSV report generation
│   ├── auth.js              # PIN check + session-gate middleware
│   ├── gradingAuth.js       # x-grading-key check for POST /api/verify
│   └── routes/
│       ├── student.js       # student-facing API (read-only status)
│       ├── admin.js         # trainer dashboard API, incl. unlock-ip
│       └── verify.js        # POST /api/verify — self-check results in, IP lock enforced
├── scripts/
│   └── migrate-sqlite-to-mongo.js  # one-off: old data/progress.db -> Atlas
├── public/
│   ├── index.html           # student landing + checklist page
│   ├── admin.html            # trainer dashboard page
│   ├── login.html            # PIN login page
│   ├── css/style.css
│   └── js/
│       ├── student.js
│       ├── admin.js
│       ├── login.js
│       └── auth-nav.js       # wires up the navbar Logout link
└── .env.example
```

## Migrating from the old SQLite deployment (one-time)

If you're moving an existing deployment from `better-sqlite3` to Atlas
without losing what's already there:

1. Deploy this version of the code with `MONGODB_URI` set, but **before**
   detaching the old Render Disk — `data/progress.db` needs to still be
   present in the container filesystem for the migration script to read.
2. Open Render's Shell tab for the service and run:
   ```
   npm run migrate:mongo
   ```
   This reads every row out of `data/progress.db` and upserts it into
   Atlas. It's insert-only (never overwrites), so it's safe to run more
   than once and safe even if students have already reported fresh results
   to the new Mongo-backed app before you get to run it.
3. Reload `/admin` and spot-check a few registration numbers against what
   was there before.
4. Once confirmed, the Render Disk is no longer needed and can be detached.

## Notes

- Registration numbers are normalized (trimmed, uppercased) so the same
  student doesn't accidentally create two rows across the two days.
- Item text is served from the backend catalog (`src/items.js`), so the
  frontend never hardcodes the checklist wording — one source of truth.
- The 30-item catalog matches the TicketDesk Student TODO Worksheet exactly
  and must not be changed without updating that worksheet too.
