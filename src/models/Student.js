const mongoose = require('mongoose');

// lockedIp/lockedIpSetAt intentionally have no schema default and are only
// ever written via $set (to lock) or $unset (to unlock in progress.js) —
// never set to an explicit `null`. The unique index below is sparse, and
// MongoDB's sparse indexes only skip documents where the field is entirely
// *absent*; a field present with value `null` still gets an index entry,
// which would make every not-yet-locked student collide on the same null
// key the moment a second one was created.
const studentSchema = new mongoose.Schema(
  {
    registrationNumber: { type: String, required: true, unique: true },
    lockedIp: { type: String },
    lockedIpSetAt: { type: Date }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

studentSchema.index({ lockedIp: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Student', studentSchema);
