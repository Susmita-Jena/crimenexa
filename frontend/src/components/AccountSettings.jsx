import React, { useState } from 'react';
import { useAuth, useTheme } from '../App';
import { CheckCircleIcon } from './icons/Icons';

export default function AccountSettings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [saved, setSaved] = useState(false);

  const [notifications, setNotifications] = useState({
    activity: true,
    alerts: true,
    updates: false
  });

  const handleSave = () => {
    localStorage.setItem(
      'crimenexa-settings',
      JSON.stringify({
        notifications,
        theme
      })
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2200);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="page account-settings-page">
      <div className="page-header">
        <span className="eyebrow">Account / Preferences</span>

        <h1>Account Settings</h1>

        <p className="page-subtitle">
          Manage your CrimeNexa account, interface preferences and investigation alerts.
        </p>
      </div>

      <div className="settings-grid">

        {/* PROFILE */}
        <section className="panel settings-card">
          <div className="settings-card-header">
            <div>
              <span className="eyebrow">Profile</span>
              <h2>Account information</h2>
              <p>Your current CrimeNexa identity and access details.</p>
            </div>

            <div className="settings-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'I'}
            </div>
          </div>

          <div className="settings-info-grid">

            <div className="settings-info">
              <span>Name</span>
              <strong>{user?.name || 'Investigator'}</strong>
            </div>

            <div className="settings-info">
              <span>Username</span>
              <strong>{user?.username || 'Not available'}</strong>
            </div>

            <div className="settings-info">
              <span>Role</span>
              <strong>
                {user?.role === 'admin'
                  ? 'Administrator'
                  : 'Investigator'}
              </strong>
            </div>

            <div className="settings-info">
              <span>Account status</span>
              <strong className="status-active">
                <span />
                Active
              </strong>
            </div>

          </div>
        </section>


        {/* APPEARANCE */}
        <section className="panel settings-card">

          <div className="settings-card-header">
            <div>
              <span className="eyebrow">Interface</span>
              <h2>Appearance</h2>
              <p>Choose how CrimeNexa looks while you work.</p>
            </div>
          </div>

          <div className="setting-row">

            <div className="setting-row-text">
              <strong>Dark mode</strong>
              <span>
                Use a darker interface for low-light investigation environments.
              </span>
            </div>

            <button
              type="button"
              className={`settings-toggle ${theme === 'dark' ? 'active' : ''}`}
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              <span />
            </button>

          </div>

          <div className="theme-status">
            Current theme:
            <strong>
              {theme === 'dark' ? ' Dark' : ' Light'}
            </strong>
          </div>

        </section>


        {/* NOTIFICATIONS */}
        <section className="panel settings-card">

          <div className="settings-card-header">
            <div>
              <span className="eyebrow">Notifications</span>
              <h2>Investigation alerts</h2>
              <p>Control which activity signals appear in your workspace.</p>
            </div>
          </div>

          <div className="setting-list">

            <label className="setting-row">

              <div className="setting-row-text">
                <strong>Activity signals</strong>
                <span>
                  Receive notifications when new network activity is detected.
                </span>
              </div>

              <input
                type="checkbox"
                checked={notifications.activity}
                onChange={(e) =>
                  setNotifications({
                    ...notifications,
                    activity: e.target.checked
                  })
                }
              />

            </label>


            <label className="setting-row">

              <div className="setting-row-text">
                <strong>Important alerts</strong>
                <span>
                  Show recurring connections and evidence-related signals.
                </span>
              </div>

              <input
                type="checkbox"
                checked={notifications.alerts}
                onChange={(e) =>
                  setNotifications({
                    ...notifications,
                    alerts: e.target.checked
                  })
                }
              />

            </label>


            <label className="setting-row">

              <div className="setting-row-text">
                <strong>System updates</strong>
                <span>
                  Receive notifications about CrimeNexa system updates.
                </span>
              </div>

              <input
                type="checkbox"
                checked={notifications.updates}
                onChange={(e) =>
                  setNotifications({
                    ...notifications,
                    updates: e.target.checked
                  })
                }
              />

            </label>

          </div>

        </section>


        {/* SECURITY */}
        <section className="panel settings-card">

          <div className="settings-card-header">
            <div>
              <span className="eyebrow">Security</span>
              <h2>Account access</h2>
              <p>Manage your current session.</p>
            </div>
          </div>

          <div className="security-box">

            <div>
              <strong>Current session</strong>
              <span>
                You are currently signed in as{' '}
                {user?.name || 'Investigator'}.
              </span>
            </div>

            <button
              type="button"
              className="danger-button"
              onClick={handleLogout}
            >
              Sign out
            </button>

          </div>

        </section>

      </div>


      {/* SAVE BAR */}
      <div className="settings-actions">

        {saved && (
          <span className="save-success">
            <CheckCircleIcon />
            Settings saved successfully
          </span>
        )}

        <button
          type="button"
          className="primary-button"
          onClick={handleSave}
        >
          Save changes
        </button>

      </div>

    </div>
  );
}
