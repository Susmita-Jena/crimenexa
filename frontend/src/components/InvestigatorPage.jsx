import React from 'react';
import { useLocation } from 'react-router-dom';

export default function InvestigatorPage() {
  const location = useLocation();
  const operator = location.state?.user || 'Investigator';

  const stats = [
    { label: 'Open cases', value: '12' },
    { label: 'Evidence links', value: '48' },
    { label: 'High-risk leads', value: '06' },
    { label: 'Watchlist hits', value: '34' }
  ];

  const queue = [
    { name: 'Case 17 / Maruti Swift suspect network', status: 'Priority' },
    { name: 'Case 24 / Warehouse financers', status: 'Review' },
    { name: 'Case 31 / Source verification', status: 'New' }
  ];

  return (
    <div className="role-page">
      <div className="role-header">
        <div>
          <span className="hero-eyebrow">Investigator portal</span>
          <h1>Welcome back, {operator}</h1>
        </div>
        <span className="role-badge">Field unit</span>
      </div>

      <div className="role-spotlight">
        <div>
          <span className="section-label">Operational focus</span>
          <h2>Case activity is accelerating across active networks.</h2>
        </div>
        <div className="quick-actions">
          <span className="action-pill">Review alerts</span>
          <span className="action-pill">Open cases</span>
          <span className="action-pill">Watchlist</span>
        </div>
      </div>

      <div className="role-grid">
        {stats.map((item) => (
          <div className="role-card" key={item.label}>
            <div className="role-card-value">{item.value}</div>
            <h3>{item.label}</h3>
          </div>
        ))}
      </div>

      <div className="role-panel">
        <div className="panel-heading-row">
          <h3>Investigation queue</h3>
          <span className="mini-badge">Live</span>
        </div>
        <ul className="list-plain">
          {queue.map((item) => (
            <li key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
