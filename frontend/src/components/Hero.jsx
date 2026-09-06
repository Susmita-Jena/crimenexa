import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

export default function Hero() {
  const navigate = useNavigate();
  const { user, login, logout, demoAccounts } = useAuth();
  const [role, setRole] = useState('investigator');
  const [username, setUsername] = useState('investigator@crimenexa.in');
  const [password, setPassword] = useState('investigator123');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/investigator', { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = login({ role, username, password });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError('');
    navigate(role === 'admin' ? '/admin' : '/investigator');
  };

  if (user) {
    return (
      <div className="hero hero-logged-in">
        <div className="hero-content hero-content-logged">
          <span className="hero-eyebrow">Access granted</span>
          <h1 className="hero-title">
            Welcome back, <span className="hero-title-accent">{user.name}</span>
          </h1>
          <p className="hero-subtitle">
            You are signed in as the {user.label.toLowerCase()} role. Continue to your command center or switch sessions.
          </p>
          <div className="hero-actions">
            <button className="btn btn-accent" onClick={() => navigate('/dashboard')}>
              Open dashboard
            </button>
            <button className="btn btn-ghost" onClick={() => navigate(user.role === 'admin' ? '/admin' : '/investigator')}>
              Go to role page
            </button>
            <button className="btn btn-ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-content">
        <div className="hero-brand-row">
          <span className="hero-eyebrow">CrimeNexa · Intelligence Platform</span>
        </div>

        <h1 className="hero-title">
          Crime<span className="hero-title-accent">Nexa</span>
        </h1>
        <p className="hero-subtitle">
          Investigative intelligence for case review and network analysis. CrimeNexa consolidates FIRs,
          call records, financial details, and surveillance notes to surface people, locations, and
          relationships that matter most in an inquiry.
        </p>

        <div className="hero-login-panel">
          <div className="panel-tag-row">
            <span className="panel-tag">Secure access</span>
            <span className="panel-tag subtle">Demo mode</span>
          </div>
          <h2>Secure sign in</h2>
          <form className="hero-login-form" onSubmit={handleSubmit}>
            <div className="hero-form-row">
              <label htmlFor="role">Role</label>
              <select
                id="role"
                className="hero-form-select"
                value={role}
                onChange={(event) => {
                  const nextRole = event.target.value;
                  setRole(nextRole);
                  setUsername(
                    nextRole === 'admin' ? demoAccounts.admin.username : demoAccounts.investigator.username
                  );
                  setPassword(nextRole === 'admin' ? demoAccounts.admin.password : demoAccounts.investigator.password);
                  setError('');
                }}
              >
                <option value="investigator">Investigator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="hero-form-row">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                className="hero-form-input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="hero-form-row">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="hero-form-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <p className="hero-error">{error}</p>

            <div className="hero-form-actions">
              <button type="submit" className="btn btn-accent">
                Sign in
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
                Quick view
              </button>
            </div>
          </form>
        </div>

        <div className="hero-actions" style={{ marginTop: '32px' }}>
          <button className="btn btn-accent" onClick={() => navigate('/dashboard')}>
            Enter Command Center
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/analyze')}>
            Analyze a Report
          </button>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-value">Persons</span>
            <span className="hero-stat-label">Suspects, witnesses, and linked identities</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">Networks</span>
            <span className="hero-stat-label">Connections, routes, and criminal associations</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">Flags</span>
            <span className="hero-stat-label">Risk indicators and escalation triggers</span>
          </div>
        </div>
      </div>
    </div>
  );
}
