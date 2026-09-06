import React, { useEffect, useState } from 'react';
import { fetchCases, fetchGraph, createCase } from '../api';

export default function CaseList() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [graph, setGraph] = useState({ edges: [] });

  function load() {
    setLoading(true);
    Promise.all([fetchCases(), fetchGraph()])
      .then(([caseData, graphData]) => { setCases(caseData); setGraph(graphData); })
      .catch(() => setError('Could not reach the backend. Is it running?'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await createCase({ title, description });
      setTitle('');
      setDescription('');
      load();
    } catch {
      setError('Could not create case.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Cases</h1>
        <p className="page-subtitle">Group reports and extracted intelligence under an investigation.</p>
      </div>

      <div className="analyze-layout">
        <form className="panel analyze-form" onSubmit={handleCreate}>
          <label className="field-label" htmlFor="caseTitle">
            Case title
          </label>
          <input
            id="caseTitle"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Operation Nightwatch"
          />

          <label className="field-label" htmlFor="caseDescription">
            Description (optional)
          </label>
          <textarea
            id="caseDescription"
            className="input textarea"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short case context for other investigators…"
          />

          <button className="btn btn-accent" type="submit" disabled={creating || !title.trim()}>
            {creating ? 'Creating…' : 'Create Case'}
          </button>
        </form>

        <div className="panel">
          <h2>Open Cases</h2>
          {loading && <p className="empty-state">Loading…</p>}
          {error && <p className="page-error">{error}</p>}
          {!loading && cases.length === 0 && <p className="empty-state">No cases yet.</p>}

          <ul className="case-list">
            {cases.map((c) => (
              <li key={c.id} className="case-item">
                <div className="case-item-header">
                  <span className="case-item-title">{c.title}</span>
                  <span className="badge badge-source">{(c.reports || []).length} reports</span>
                </div>
                {c.description && <p className="case-item-description">{c.description}</p>}
                <div className="case-item-metrics"><span>{graph.edges.filter((edge) => edge.caseId === c.id).length || '—'} relationships</span><span>{c.status || 'Open'}</span></div>
                <span className="case-item-date">
                  Opened {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
