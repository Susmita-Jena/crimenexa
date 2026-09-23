const express = require('express');
const { readDB, writeDB } = require('../db');
const { chainFor, verifyChain, appendCustodyEvent, hashContent } = require('../services/custodyLedger');

const router = express.Router();

const ALLOWED_ACTIONS = new Set(['VIEWED', 'EXPORTED', 'REVIEWED', 'LINKED_TO_CASE']);

/** GET /api/custody/:reportId  -> the full chain for one report, plus live verification. */
router.get('/:reportId', (req, res) => {
  const db = readDB();
  const report = db.reports.find((r) => r.id === req.params.reportId);
  if (!report) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  const chain = chainFor(db, report.id);
  const verification = verifyChain(chain);

  res.json({
    reportId: report.id,
    sourceType: report.sourceType,
    integrityHash: report.integrityHash || null,
    contentStillMatchesHash: report.integrityHash ? hashContent(report.text) === report.integrityHash : null,
    chain,
    verification
  });
});

/** POST /api/custody/:reportId/event  { action, actorName } -> append a new custody event. */
router.post('/:reportId/event', (req, res) => {
  const { action, actorName } = req.body || {};
  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: `action must be one of ${[...ALLOWED_ACTIONS].join(', ')}` });
  }

  const db = readDB();
  const report = db.reports.find((r) => r.id === req.params.reportId);
  if (!report) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  const entry = appendCustodyEvent(db, { reportId: report.id, action, actorName: actorName || 'Investigator Portal' });
  writeDB(db);

  res.json({ entry, verification: verifyChain(chainFor(db, report.id)) });
});

/**
 * POST /api/custody/:reportId/tamper-demo
 * Demo-only: shows what verification looks like if a past entry were
 * altered after the fact. Computed in memory and never written to disk,
 * so the real ledger is untouched.
 */
router.post('/:reportId/tamper-demo', (req, res) => {
  const db = readDB();
  const chain = chainFor(db, req.params.reportId);
  if (!chain.length) {
    return res.status(404).json({ error: 'No custody entries for this report.' });
  }

  const tampered = chain.map((entry, i) =>
    i === 0 ? { ...entry, detail: { ...entry.detail, contentHash: 'tampered0000tampered0000tampered0000tampered0000tampered00000' } } : entry
  );

  res.json({
    note: 'Simulated only \u2014 the real ledger on disk was not modified.',
    verification: verifyChain(tampered)
  });
});

module.exports = router;
