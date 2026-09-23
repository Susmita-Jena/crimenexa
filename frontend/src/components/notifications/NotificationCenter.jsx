import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGraph } from '../../api';
import { AlertHighIcon, AlertMediumIcon, BellIcon, CheckCircleIcon, CloseIcon, InfoIcon } from '../icons/Icons';

const POLL_MS = 20000;
const SEEN_KEY = 'crimenexa-seen-alerts';
const TOAST_MS = 7000;

const META = {
  high: { label: 'High', Icon: AlertHighIcon, cls: 'is-high' },
  medium: { label: 'Medium', Icon: AlertMediumIcon, cls: 'is-medium' },
  info: { label: 'Info', Icon: InfoIcon, cls: 'is-info' }
};

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-200)));
  } catch {
    /* storage unavailable, skip persisting */
  }
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  // seenRef: which alerts the person has opened/read (drives the unread badge).
  // toastedRef: which alerts have ever triggered a toast, seeded with whatever
  // is already on screen at first load, so nothing already-present pops up as
  // "new" — only alerts that genuinely appear for the first time after that.
  const seenRef = useRef(loadSeen());
  const toastedRef = useRef(null);
  const rootRef = useRef(null);

  const poll = useCallback(() => {
    fetchGraph()
      .then((data) => {
        const list = Array.isArray(data.alerts) ? data.alerts : [];
        setAlerts(list);

        if (toastedRef.current === null) {
          toastedRef.current = new Set(list.map((a) => a.id));
          return;
        }
        const fresh = list.filter((a) => !toastedRef.current.has(a.id));
        if (fresh.length) {
          fresh.forEach((a) => toastedRef.current.add(a.id));
          setToasts((current) => [...fresh.slice(0, 3).map((a) => ({ ...a, toastId: `${a.id}-${Date.now()}` })), ...current].slice(0, 4));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    function onClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1));
    }, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !seenRef.current.has(a.id)).length,
    [alerts]
  );

  const markAllSeen = () => {
    alerts.forEach((a) => seenRef.current.add(a.id));
    saveSeen(seenRef.current);
    setAlerts((current) => [...current]);
  };

  const dismissToast = (toastId) => setToasts((current) => current.filter((t) => t.toastId !== toastId));

  const openAlert = (alert) => {
    seenRef.current.add(alert.id);
    saveSeen(seenRef.current);
    setOpen(false);
    navigate('/graph');
  };

  return (
    <div className="notif-root" ref={rootRef}>
      <button
        type="button"
        className="notif-bell"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        title="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="menu" aria-label="Notifications">
          <div className="notif-panel-head">
            <strong>Alerts</strong>
            {alerts.length > 0 && (
              <button type="button" className="notif-mark-read" onClick={markAllSeen}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {!alerts.length && (
              <div className="notif-empty">
                <CheckCircleIcon />
                <span>No flagged patterns right now.</span>
              </div>
            )}
            {alerts.map((alert) => {
              const meta = META[alert.type] || META.info;
              const isUnread = !seenRef.current.has(alert.id);
              return (
                <button
                  type="button"
                  key={alert.id}
                  className={`notif-item ${meta.cls} ${isUnread ? 'is-unread' : ''}`}
                  onClick={() => openAlert(alert)}
                  role="menuitem"
                >
                  <meta.Icon className="notif-item-icon" />
                  <span className="notif-item-text">
                    <strong>{alert.title}</strong>
                    <span>{alertDetail(alert)}</span>
                  </span>
                  {isUnread && <span className="notif-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => {
          const meta = META[toast.type] || META.info;
          return (
            <div key={toast.toastId} className={`toast ${meta.cls}`} role="status">
              <meta.Icon className="toast-icon" />
              <span className="toast-text">
                <strong>{toast.title}</strong>
                <span>{alertDetail(toast)}</span>
              </span>
              <button type="button" className="toast-close" onClick={() => dismissToast(toast.toastId)} aria-label="Dismiss">
                <CloseIcon />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function alertDetail(alert) {
  switch (alert.category) {
    case 'REPEATED_CONNECTION':
      return `Seen ${alert.occurrenceCount} times \u2014 needs review`;
    case 'CROSS_SOURCE_RECURRENCE':
      return `Confirmed across ${alert.sourceCount || alert.evidenceCount} sources`;
    case 'ACTIVITY_MOVEMENT':
      return `${alert.timestamps?.length || 0} recorded sightings`;
    case 'KEY_ENTITY':
      return `Rank ${alert.rank} \u00b7 score ${alert.score}`;
    default:
      return 'Review in Network Graph';
  }
}
