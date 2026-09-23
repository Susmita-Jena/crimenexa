import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../App';
import { fetchCustody, fetchReports, logCustodyEvent, tamperDemo } from '../api';
import {
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  FingerprintIcon,
  LinkIcon,
  ShieldAlertIcon,
  ShieldCheckIcon
} from './icons/Icons';

function shortHash(hash) {
  if (!hash) return '\u2014';
  return `${hash.slice(0, 8)}\u2026${hash.slice(-6)}`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

const ACTION_LABEL = {
  INGESTED: 'Ingested into system',
  VIEWED: 'Viewed by investigator',
  EXPORTED: 'Exported',
  REVIEWED: 'Reviewed',
  LINKED_TO_CASE: 'Linked to case'
};

export default function EvidenceIntegrity() {
  const { user } = useAuth();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [custodyById, setCustodyById] = useState({});
  const [tamperResult, setTamperResult] = useState(null);
  const [busyAction, setBusyAction] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchReports()
      .then((data) => alive && setReports(Array.isArray(data) ? data : []))
      .catch(() => alive && setError('Could not reach the backend.'));
    return () => {
      alive = false;
    };
  }, []);

  const loadCustody = useCallback((reportId) => {
    fetchCustody(reportId)
      .then((data) => setCustodyById((prev) => ({ ...prev, [reportId]: data })))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!reports) return;
    reports.forEach((r) => loadCustody(r.id));
  }, [reports, loadCustody]);

  const toggle = (reportId) => {
    setTamperResult(null);
    setOpenId((current) => (current === reportId ? null : reportId));
  };

  const logView = async (reportId) => {
    setBusyAction(reportId);
    try {
      await logCustodyEvent(reportId, { action: 'VIEWED', actorName: user?.name || 'Investigator' });
      loadCustody(reportId);
    } finally {
      setBusyAction(null);
    }
  };

  const runTamperDemo = async (reportId) => {
    setBusyAction(reportId);
    try {
      const result = await tamperDemo(reportId);
      setTamperResult({ reportId, ...result });
    } finally {
      setBusyAction(null);
    }
  };

  const summary = useMemo(() => {
    const entries = Object.values(custodyById);
    const verified = entries.filter((c) => c.verification?.valid).length;
    return { total: reports?.length || 0, verified, checked: entries.length };
  }, [reports, custodyById]);

  if (error) {
    return (
      <div className="page">
        <div className="page-header"><h1>Evidence Integrity</h1></div>
        <p className="page-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="page evidence-integrity-page">
      <div className="page-header">
        <span className="eyebrow">Cybersecurity / Chain of Custody</span>
        <h1>Evidence Integrity</h1>
        <p className="page-subtitle">
          Every ingested report is content-hashed and recorded in an append-only, hash-chained ledger —
          the same tamper-evidence principle behind blockchains. If any past record were altered, the chain
          breaks at exactly that point and verification fails below.
        </p>
      </div>

      <div className="stat-grid ei-stat-grid">
        <div className="stat-card">
          <span className="stat-value">{summary.total}</span>
          <span className="stat-label">Reports on file</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{summary.verified}</span>
          <span className="stat-label">Chains verified intact</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">SHA-256</span>
          <span className="stat-label">Hash algorithm</span>
        </div>
      </div>

      {!reports && <p className="empty-state">Loading reports…</p>}
      {reports && !reports.length && <p className="empty-state">No reports analyzed yet.</p>}

      <div className="ei-list">
        {reports?.map((report) => {
          const custody = custodyById[report.id];
          const isOpen = openId === report.id;
          const valid = custody?.verification?.valid;
          const showingTamper = tamperResult?.reportId === report.id ? tamperResult : null;

          return (
            <div key={report.id} className="panel ei-card">
              <button type="button" className="ei-card-head" onClick={() => toggle(report.id)}>
                <div className="ei-card-icon">
                  <FingerprintIcon />
                </div>
                <div className="ei-card-main">
                  <div className="ei-card-top">
                    <strong>{report.sourceType?.toUpperCase() || 'REPORT'} · {report.id}</strong>
                    <span className="ei-time">{formatTime(report.createdAt)}</span>
                  </div>
                  <span className="ei-hash mono">{shortHash(report.integrityHash)}</span>
                </div>
                {custody ? (
                  <span className={`ei-badge ${valid ? 'is-valid' : 'is-broken'}`}>
                    {valid ? <ShieldCheckIcon /> : <ShieldAlertIcon />}
                    {valid ? 'Verified' : 'Tampered'}
                  </span>
                ) : (
                  <span className="ei-badge is-loading">Checking…</span>
                )}
              </button>

              {isOpen && custody && (
                <div className="ei-card-body">
                  <div className="ei-actions">
                    <button type="button" className="gx-button" disabled={busyAction === report.id} onClick={() => logView(report.id)}>
                      <EyeIcon /> Log a view
                    </button>
                    <button type="button" className="gx-button is-danger" disabled={busyAction === report.id} onClick={() => runTamperDemo(report.id)}>
                      <ShieldAlertIcon /> Simulate tampering
                    </button>
                  </div>

                  {showingTamper && (
                    <div className={`ei-tamper-result ${showingTamper.verification.valid ? '' : 'is-broken'}`}>
                      <ShieldAlertIcon />
                      <div>
                        <strong>{showingTamper.note}</strong>
                        <span>
                          {showingTamper.verification.valid
                            ? 'Chain still verifies.'
                            : `Chain breaks at entry #${showingTamper.verification.brokenAt + 1}: ${showingTamper.verification.reason}`}
                        </span>
                      </div>
                    </div>
                  )}

                  <ol className="ei-chain">
                    {custody.chain.map((entry, i) => (
                      <li key={entry.id}>
                        {i > 0 && <LinkIcon className="ei-chain-link" />}
                        <div className="ei-entry">
                          <div className="ei-entry-top">
                            <span className="ei-entry-action">{ACTION_LABEL[entry.action] || entry.action}</span>
                            <span className="ei-entry-time"><ClockIcon /> {formatTime(entry.timestamp)}</span>
                          </div>
                          <span className="ei-entry-actor">{entry.actorName}</span>
                          <span className="ei-entry-hash mono">hash {shortHash(entry.hash)} ← prev {shortHash(entry.prevHash)}</span>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <p className="ei-note">
                    <CheckCircleIcon /> Content re-hashed on load: {custody.contentStillMatchesHash ? 'matches the recorded fingerprint.' : 'does not match \u2014 investigate immediately.'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
