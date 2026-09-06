import React from 'react';
import { NavLink } from 'react-router-dom';

const platformLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/graph', label: 'Network Graph' },
  { to: '/people', label: 'People' },
  { to: '/cases', label: 'Cases' }
];

const investigationLinks = [
  { to: '/analyze', label: 'Evidence & Reports' },
  { to: '/dashboard', label: 'Investigation Leads' },
  { to: '/graph', label: 'Key Entities' }
];

function FooterLinkGroup({ title, links }) {
  return (
    <div className="footer-link-group">
      <h3>{title}</h3>
      <nav aria-label={`${title} links`}>
        {links.map((link) => (
          <NavLink key={`${title}-${link.label}`} to={link.to}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <section className="footer-institutional" aria-labelledby="footer-brand-heading">
          <div className="footer-brand-block">
            <span className="footer-kicker">Investigation intelligence platform</span>
            <h2 id="footer-brand-heading">CrimeNexa</h2>
            <p className="footer-subtitle">AI-Powered Criminal Network Analysis</p>
            <p className="footer-description">
              An investigation-support platform for analyzing relationships, patterns, and evidence across connected crime intelligence data.
            </p>
          </div>

          <div className="footer-security" aria-labelledby="footer-security-heading">
            <h3 id="footer-security-heading">Secure Investigation Environment</h3>
            <div className="footer-security-grid">
              <span><strong>Evidence provenance</strong><small>Source and extraction context retained</small></span>
              <span><strong>Source confidence</strong><small>Confidence surfaced with evidence</small></span>
              <span><strong>Human review flags</strong><small>Review requirements remain visible</small></span>
            </div>
          </div>
        </section>

        <aside className="footer-notice" aria-labelledby="footer-notice-heading">
          <div>
            <span className="footer-kicker">Responsible analytical use</span>
            <h3 id="footer-notice-heading">Investigation Support Notice</h3>
          </div>
          <p>
            CrimeNexa provides analytical insights, relationship analysis, and investigative signals to assist authorized investigators. Automated outputs are intended as decision-support information and require appropriate human verification before action.
          </p>
        </aside>

        <section className="footer-links" aria-label="Quick access">
          <FooterLinkGroup title="Platform" links={platformLinks} />
          <FooterLinkGroup title="Investigation" links={investigationLinks} />
          <div className="footer-link-group">
            <h3>Resources</h3>
            <p className="footer-resource-note">Operational guidance is available within each investigation workspace.</p>
          </div>
        </section>

        <section className="footer-context">
          <div>
            <span className="footer-kicker">Institutional context</span>
            <h3>Investigation Intelligence Platform</h3>
          </div>
          <p>Designed to support structured analysis of multi-source crime and intelligence information.</p>
        </section>

        <div className="footer-bottom">
          <div>
            <strong>CrimeNexa</strong>
            <span>AI-Powered Criminal Network Analysis</span>
          </div>
          <nav className="footer-utility-links" aria-label="Footer information">
            <span>Privacy</span>
            <span>Security</span>
            <span>Audit &amp; Integrity</span>
            <span>Help</span>
          </nav>
          <small>© 2026 CrimeNexa · Investigation Support Platform</small>
        </div>
      </div>
    </footer>
  );
}