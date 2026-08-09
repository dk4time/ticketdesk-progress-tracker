// Shared secret required on POST /api/verify, checked against the
// x-grading-key header. Matches the default baked into the TicketDesk repo's
// grading/config.js so the whole class works out of the box; override both
// sides together (this env var here, GRADING_KEY there) if you'd rather hand
// out your own key.
//
// This is a classroom deterrent, not exam security — see the honesty note in
// TicketDesk_Automated_Grading_Build_Prompt.md. The grading script runs
// entirely on each student's own laptop, so a technically determined student
// could still fake a result; this just keeps a stray/careless POST from
// clobbering another student's row.
const GRADING_KEY = process.env.GRADING_KEY || 'tdsk-grading-8f3ac1e9b7d24f0a91c6e5b2d7a1f4c8';

function requireGradingKey(req, res, next) {
  const provided = req.get('x-grading-key');
  if (!provided || provided !== GRADING_KEY) {
    return res.status(401).json({ error: 'Missing or invalid x-grading-key header.' });
  }
  next();
}

module.exports = { requireGradingKey, GRADING_KEY };
