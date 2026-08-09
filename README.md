# TicketDesk Progress Tracker

A small, standalone local web app for tracking student progress on the
30-item TicketDesk Student TODO Worksheet during the workshop. Runs entirely
on the trainer's laptop, over classroom WiFi, with no internet dependency.

This is independent of the TicketDesk project itself in every respect except
one: each student's own machine reports results here by calling
`POST /api/verify`, driven by the `npm run self-check` script that lives in
the TicketDesk repo's `grading/` folder. See "Automated grading" below.

Progress here is **read-only and machine-reported** — there are no
checkboxes anywhere in this app. A student's status only changes when their
own `npm run self-check` run posts real results.

## Tech stack

- Node.js + Express
- SQLite via `better-sqlite3` (single local file: `data/progress.db`)
- Plain HTML/CSS/JS frontend, no build step
- `pdfkit` for PDF export

## Setup

```
npm install
npm start
```

That's it. On startup the console prints the local network URL, e.g.:

```
=================================================
  Students connect at: http://192.168.1.42:3000
  Trainer dashboard:   http://192.168.1.42:3000/admin
=================================================
```

Students open that URL on their own laptop/phone, on the same WiFi network.
The trainer opens the `/admin` URL for the live dashboard.

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

## Day-to-day use

- **Day 1**: `npm start`, share the printed URL. Students open it, enter
  their registration number to view their status (all "Not tested yet"
  until their first `npm run self-check`), and run `npm run self-check` from
  the TicketDesk repo whenever they want to check progress or report it here.
- **Stopping for the day**: just stop the process (Ctrl+C). All progress is
  saved in `data/progress.db` and is not lost.
- **Day 2**: `npm start` again. Students enter the same registration number
  and their Day 1 status is still there.

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
├── server.js              # entry point, binds 0.0.0.0, prints LAN URL
├── src/
│   ├── db.js               # better-sqlite3 connection + schema (+ migration)
│   ├── items.js             # hardcoded 30-item catalog
│   ├── progress.js          # all student/progress data access
│   ├── network.js           # local IP detection
│   ├── pdfExport.js         # PDF report generation
│   ├── csvExport.js         # CSV report generation
│   ├── auth.js              # PIN check + session-gate middleware
│   ├── gradingAuth.js       # x-grading-key check for POST /api/verify
│   └── routes/
│       ├── student.js       # student-facing API (read-only status)
│       ├── admin.js         # trainer dashboard API
│       └── verify.js        # POST /api/verify — self-check results in
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
└── data/
    └── progress.db           # created automatically on first run
```

## Notes

- Registration numbers are normalized (trimmed, uppercased) so the same
  student doesn't accidentally create two rows across the two days.
- Item text is served from the backend catalog (`src/items.js`), so the
  frontend never hardcodes the checklist wording — one source of truth.
- The 30-item catalog matches the TicketDesk Student TODO Worksheet exactly
  and must not be changed without updating that worksheet too.
