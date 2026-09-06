import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../App';
import { fetchCases, fetchReports } from '../api';

export default function ProfilePage() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchCases(), fetchReports()])
      .then(([caseData, reportData]) => {
        setCases(Array.isArray(caseData) ? caseData : []);
        setReports(Array.isArray(reportData) ? reportData : []);
      })
      .catch(() => setError('Unable to load profile summary right now.'))
      .finally(() => setLoading(false));
  }, []);

  const initials = useMemo(() => {
    const source = user?.name || user?.label || 'User';
    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'U';
  }, [user]);

  const summaryStats = [
    { label: 'Cases Accessible', value: String(cases.length || 0) },
    { label: 'Reports Analyzed', value: String(reports.length || 0) },
    { label: 'Leads Reviewed', value: String(reports.reduce((total, report) => total + (report.leads?.length || 0), 0)) }
  ];

  if (loading) {
    return <div className="page-loading">Loading profile…</div>;
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  return (
    <div className="profile-page">
      <div className="page-header profile-header">
        <div>
          <span className="hero-eyebrow">Profile</span>
          <h1>Investigator profile</h1>
        </div>
        <span className="role-badge">Account active</span>
      </div>

      <div className="profile-layout">
        <section className="profile-identity panel">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-identity-body">
            <h2>{user?.name || 'Inspector Verma'}</h2>
            <p>{user?.label || 'Investigator'}</p>
            <div className="profile-status-row">
              <span className="status-dot" />
              <span>Active</span>
            </div>
          </div>
        </section>

        <section className="profile-summary panel">
          <h3>Investigation summary</h3>
          <div className="profile-summary-grid">
            {summaryStats.map((stat) => (
              <div key={stat.label} className="profile-summary-card">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="profile-grid">
        <section className="panel">
          <h3>Account information</h3>
          <div className="profile-info-list">
            <div className="profile-info-row">
              <span>Name</span>
              <strong>{user?.name || 'Inspector Verma'}</strong>
            </div>
            <div className="profile-info-row">
              <span>Role</span>
              <strong>{user?.label || 'Investigator'}</strong>
            </div>
            <div className="profile-info-row">
              <span>Email</span>
              <strong>{user?.username || 'investigator@crimenexa.in'}</strong>
            </div>
            <div className="profile-info-row">
              <span>Account status</span>
              <strong>Active</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <h3>Recent access</h3>
          <div className="profile-info-list">
            <div className="profile-info-row">
              <span>Last activity</span>
              <strong>Current session</strong>
            </div>
            <div className="profile-info-row">
              <span>Access level</span>
              <strong>Investigation workspace</strong>
            </div>
            <div className="profile-info-row">
              <span>Assigned cases</span>
              <strong>{cases.length || 0}</strong>
            </div>
            <div className="profile-info-row">
              <span>Reports accessible</span>
              <strong>{reports.length || 0}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
