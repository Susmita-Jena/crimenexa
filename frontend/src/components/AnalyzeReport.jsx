import React, { useEffect, useState } from 'react';
import { analyzeReport, fetchCases } from '../api';

const SOURCE_TYPES = [
  'FIR',
  'Call Detail Record',
  'Financial Transaction',
  'Surveillance Report',
  'Social Media Intelligence',
  'Criminal History',
  'Intelligence Report',
  'Other'
];

export default function AnalyzeReport() {
  const [text, setText] = useState('');
  const [sourceType, setSourceType] = useState(SOURCE_TYPES[0]);
  const [caseId, setCaseId] = useState('');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchCases().then(setCases).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await analyzeReport({ text, sourceType, caseId: caseId || undefined });
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Analysis failed. Check the backend logs.');
    } finally {
      setLoading(false);
    }
  }

  const extracted = result?.extracted;
  const investigationContext = result?.investigationContext || result?.report || null;
  const confidence = result?.report?.confidence ?? investigationContext?.confidence ?? null;
  const womenSafetySignals =
    result?.report?.womenSafetySignals ??
    result?.womenSafetySignals ??
    investigationContext?.womenSafetySignals ??
    [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Analyze Report</h1>
        <p className="page-subtitle">
          Paste raw report text below. The LLM extracts entities and relationships, which are
          merged straight into the network graph and investigation timeline.
        </p>
      </div>

      <div className="analyze-layout">
        <form className="panel analyze-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="sourceType">
            Source type
          </label>
          <select
            id="sourceType"
            className="input"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="caseId">
            Attach to case (optional)
          </label>
          <select id="caseId" className="input" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            <option value="">No case</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="reportText">
            Report text
          </label>
          <textarea
            id="reportText"
            className="input textarea"
            placeholder="Paste an FIR excerpt, CDR note, transaction record, or surveillance summary…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
          />

          <button className="btn btn-accent" type="submit" disabled={loading || !text.trim()}>
            {loading ? 'Analyzing…' : 'Extract with LLM'}
          </button>

          {error && <p className="form-error">{error}</p>}
        </form>

        <div className="panel analyze-results">
          <h2>Extraction Results</h2>
          {!result && !loading && (
            <p className="empty-state">Results will appear here once a report is analyzed.</p>
          )}
          {loading && <p className="empty-state">Reading the report…</p>}

          {extracted && (
            <div className="extraction-results">
              {extracted.summary && <p className="extraction-summary">{extracted.summary}</p>}

              {extracted.riskFlags?.length > 0 && (
                <div className="flag-tags">
                  {extracted.riskFlags.map((f, i) => (
                    <span key={i} className="tag tag-risk">
                      {f}
                    </span>
                  ))}
                </div>
              )}

              {typeof confidence === 'number' && (
                <div className="confidence-panel">
                  <div className="confidence-meta">
                    <span>Investigation confidence</span>
                    <strong>{Math.round(confidence * 100)}%</strong>
                  </div>
                  <div className="confidence-bar">
                    <span style={{ width: `${Math.round(confidence * 100)}%` }} />
                  </div>
                </div>
              )}

              {(result?.report?.evidence?.length > 0 || investigationContext?.evidence?.length > 0) && (
                <div className="result-section">
                  <h3>Evidence trail</h3>
                  <ul className="evidence-list">
                    {(result?.report?.evidence || investigationContext?.evidence || []).map((item, index) => (
                      <li key={`${item.entityType}-${item.entityName}-${index}`} className="evidence-item">
                        <div>
                          <strong>{item.entityName}</strong>
                          <span>{item.entityType}</span>
                        </div>
                        <div className="evidence-meta">
                          <span>{item.provenance?.source || 'report'}</span>
                          <span>{Math.round((item.confidence || 0.7) * 100)}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(result?.report?.events?.length > 0 || investigationContext?.events?.length > 0) && (
                <div className="result-section">
                  <h3>Event timeline</h3>
                  <ul className="event-list">
                    {(result?.report?.events || investigationContext?.events || []).map((event, index) => (
                      <li key={`${event.type}-${event.source}-${index}`} className="event-item">
                        <span className="badge badge-accent">{event.type}</span>
                        <p>{event.description || `${event.source} → ${event.target}`}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="result-section">
                <h3>Women Safety Intelligence</h3>
                {womenSafetySignals.length > 0 ? (
                  <ul className="lead-list">
                    {womenSafetySignals.map((signal, index) => (
                      <li key={`${signal.type}-${index}`} className="lead-item women-safety-item">
                        <div className="lead-header">
                          <strong>{signal.title}</strong>
                          <span>{signal.severity || 'medium'} / {Math.round((signal.confidence || 0.6) * 100)}%</span>
                        </div>
                        <p>{signal.description}</p>
                        {signal.relatedEntities?.length > 0 && (
                          <div className="flag-tags small-gap">
                            {signal.relatedEntities.slice(0, 4).map((entity, entityIndex) => (
                              <span key={`${entity}-${entityIndex}`} className="tag tag-risk">
                                {entity}
                              </span>
                            ))}
                          </div>
                        )}
                        {signal.evidenceRefs?.length > 0 && (
                          <p className="women-safety-meta">
                            {signal.evidenceRefs.length} evidence references · {signal.requiresHumanReview ? 'Human review recommended' : 'No review required'}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-state">No women-safety pattern detected from the current evidence set.</p>
                )}
              </div>

              {(result?.report?.leads?.length > 0 || investigationContext?.leads?.length > 0) && (
                <div className="result-section">
                  <h3>Recommended leads</h3>
                  <ul className="lead-list">
                    {(result?.report?.leads || investigationContext?.leads || []).map((lead, index) => (
                      <li key={`${lead.title}-${index}`} className="lead-item">
                        <div className="lead-header">
                          <strong>{lead.title}</strong>
                          <span>{Math.round((lead.riskScore || 0.7) * 100)}% risk</span>
                        </div>
                        {lead.reasons?.length > 0 && (
                          <div className="flag-tags small-gap">
                            {lead.reasons.map((reason, reasonIndex) => (
                              <span key={`${reason}-${reasonIndex}`} className="tag tag-risk">
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                        {lead.nextAction && <p>{lead.nextAction}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <EntityGroup title="People" items={extracted.entities?.people} field="name" sub="role" />
              <EntityGroup title="Locations" items={extracted.entities?.locations} field="name" />
              <EntityGroup title="Organizations" items={extracted.entities?.organizations} field="name" />
              <EntityGroup title="Vehicles" items={extracted.entities?.vehicles} field="description" />
              <EntityGroup title="Phone Numbers" items={extracted.entities?.phones} field="number" sub="owner" mono />

              {extracted.relationships?.length > 0 && (
                <div className="entity-group">
                  <h3>Relationships</h3>
                  <ul className="relationship-list">
                    {extracted.relationships.map((r, i) => (
                      <li key={i} className="relationship-item">
                        <span className="mono">{r.source}</span>
                        <span className="badge badge-accent">{r.type}</span>
                        <span className="mono">{r.target}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EntityGroup({ title, items, field, sub, mono }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="entity-group">
      <h3>{title}</h3>
      <ul className="entity-list">
        {items.map((item, i) => (
          <li key={i} className="entity-item">
            <span className={mono ? 'mono' : ''}>{item[field]}</span>
            {sub && item[sub] && <span className="entity-item-sub">{item[sub]}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
