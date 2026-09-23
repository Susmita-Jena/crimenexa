const crypto = require('crypto');

/*
 * Chain-of-custody ledger for evidence integrity.
 *
 * Every action taken on a report (ingested, viewed, exported, linked to a
 * case) is recorded as an entry. Each entry's hash is computed over its own
 * content PLUS the previous entry's hash — the same hash-chaining principle
 * blockchains use for tamper evidence. If any past entry is altered after
 * the fact, its hash no longer matches what the next entry committed to,
 * and verifyChain() below will detect exactly where the chain breaks.
 *
 * This is a private, append-only ledger (not a distributed/consensus
 * blockchain) — the right scope for a single investigative system, while
 * still giving a genuine, verifiable tamper-evidence guarantee.
 */

const GENESIS_HASH = '0'.repeat(64);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Content hash for a piece of evidence (e.g. raw report text). */
function hashContent(text) {
  return sha256(String(text || ''));
}

function hashEntry({ reportId, action, actorName, detail, timestamp, prevHash }) {
  const payload = JSON.stringify({ reportId, action, actorName, detail, timestamp, prevHash });
  return sha256(payload);
}

function lastHashFor(db, reportId) {
  const chain = (db.custodyLedger || []).filter((e) => e.reportId === reportId);
  return chain.length ? chain[chain.length - 1].hash : GENESIS_HASH;
}

/**
 * Append a custody event for a report. Mutates db.custodyLedger in place;
 * caller is responsible for writeDB(db) afterwards.
 */
function appendCustodyEvent(db, { reportId, action, actorName, detail }) {
  db.custodyLedger = db.custodyLedger || [];

  const prevHash = lastHashFor(db, reportId);
  const timestamp = new Date().toISOString();
  const entryCore = { reportId, action, actorName: actorName || 'Unknown investigator', detail: detail || null, timestamp, prevHash };
  const hash = hashEntry(entryCore);

  const entry = { id: crypto.randomUUID(), ...entryCore, hash };
  db.custodyLedger.push(entry);
  return entry;
}

function chainFor(db, reportId) {
  return (db.custodyLedger || []).filter((e) => e.reportId === reportId);
}

/**
 * Recompute every entry's hash from its content + the previous entry's
 * hash, and compare against what's stored. Returns where (if anywhere) the
 * chain first breaks, which is the tell for tampering.
 */
function verifyChain(entries) {
  let expectedPrev = GENESIS_HASH;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.prevHash !== expectedPrev) {
      return { valid: false, brokenAt: i, reason: 'Link to previous entry does not match.' };
    }
    const recomputed = hashEntry({
      reportId: entry.reportId,
      action: entry.action,
      actorName: entry.actorName,
      detail: entry.detail,
      timestamp: entry.timestamp,
      prevHash: entry.prevHash
    });
    if (recomputed !== entry.hash) {
      return { valid: false, brokenAt: i, reason: 'Entry content does not match its recorded hash.' };
    }
    expectedPrev = entry.hash;
  }

  return { valid: true, brokenAt: null, reason: null };
}

module.exports = {
  GENESIS_HASH,
  hashContent,
  appendCustodyEvent,
  chainFor,
  verifyChain
};
