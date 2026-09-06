import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '../App';
import { fetchCases } from '../api';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { to: '/graph', label: 'Network Graph', icon: '◎' },
  { to: '/people', label: 'People', icon: '♙' },
  { to: '/cases', label: 'Cases', icon: '▣' },
  { to: '/analyze', label: 'Analyze Report', icon: '＋' }
];

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCase, setActiveCase] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchCases().then((cases) => setActiveCase(cases[0] || null)).catch(() => {});
  }, []);

  const initials = (user?.name || user?.label || 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <img src="/logo.svg" alt="CrimeNexa logo" className="navbar-mark" />
        <div className="navbar-brand-copy">
          <span className="navbar-title">CrimeNexa</span>
          <span className="navbar-subtitle">AI-powered network analysis</span>
        </div>
      </div>
      <nav className="navbar-links">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => 'navbar-link' + (isActive ? ' navbar-link-active' : '')}
          >
            <span className="nav-link-icon" aria-hidden="true">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="navbar-case">
        <span className="case-kicker">Active case</span>
        <strong>{activeCase?.title || 'No active case'}</strong>
        <span>{activeCase?.id || 'Select from Cases'}</span>
      </div>

      {user ? (
        <div className="navbar-user" ref={menuRef}>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
            <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
          <button
            type="button"
            className="account-trigger"
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="account-avatar">{initials}</span>
            <span className="account-name">{user.name}</span>
            <span className="account-caret">▾</span>
          </button>

          {menuOpen && (
            <div className="account-menu" role="menu" aria-label="Account menu">
              <button type="button" className="account-menu-item" onClick={() => {
                setMenuOpen(false);
                navigate('/profile');
              }}>
                Profile
              </button>
              <button type="button" className="account-menu-item" onClick={() => {
                setMenuOpen(false);
                navigate('/dashboard');
              }}>
                Account Settings
              </button>
              <button type="button" className="account-menu-item" onClick={() => {
                setMenuOpen(false);
                navigate('/dashboard');
              }}>
                Activity / Recent Activity
              </button>
              <button type="button" className="account-menu-item danger" onClick={() => {
                setMenuOpen(false);
                logout();
                navigate('/');
              }}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      ) : (
        <button className="btn btn-accent" onClick={() => navigate('/')}>
          Sign in
        </button>
      )}
    </header>
  );
}
