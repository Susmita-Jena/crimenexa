import React from 'react';

/*
 * Small outline icon set used across the app (navbar, notifications, etc).
 * Single-color line icons via currentColor, 20x20 viewbox, 1.6 stroke.
 */
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

const Icon = (path, extra) => (props) => (
  <svg {...base} {...extra} {...props} aria-hidden="true">
    {path}
  </svg>
);

export const DashboardIcon = Icon(
  <>
    <rect x="3.5" y="3.5" width="7" height="7.5" rx="1.2" />
    <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.2" />
    <rect x="13.5" y="10.5" width="7" height="10" rx="1.2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
  </>
);

export const GraphIcon = Icon(
  <>
    <circle cx="6" cy="7" r="2.4" />
    <circle cx="18" cy="6" r="2.2" />
    <circle cx="17" cy="17.5" r="2.6" />
    <circle cx="7.5" cy="17" r="2" />
    <path d="M8.1 8.4 15.9 6.6M8 9.2l7.5 6.9M9.4 17.3l5.2.4" />
  </>
);

export const PeopleIcon = Icon(
  <>
    <circle cx="9" cy="7.5" r="3" />
    <path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
    <circle cx="17.3" cy="8.5" r="2.3" />
    <path d="M15.2 13.2c2.7.1 4.8 2.2 5.3 5" />
  </>
);

export const CasesIcon = Icon(
  <>
    <rect x="3.5" y="7.5" width="17" height="12" rx="1.6" />
    <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
    <path d="M3.5 12h17" />
  </>
);

export const AnalyzeIcon = Icon(
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.3 15.3 20.5 20.5" />
    <path d="M10.5 7.6v5.8M7.6 10.5h5.8" />
  </>
);

export const SunIcon = Icon(
  <>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M4.2 12H1.8M22.2 12h-2.4M5.4 5.4l1.7 1.7M16.9 16.9l1.7 1.7M18.6 5.4l-1.7 1.7M7.1 16.9l-1.7 1.7" />
  </>
);

export const MoonIcon = Icon(
  <path d="M19.5 14.2A8.2 8.2 0 1 1 9.8 4.5a6.6 6.6 0 0 0 9.7 9.7z" />
);

export const ChevronDownIcon = Icon(<path d="m6 9 6 6 6-6" />, { strokeWidth: 2 });

export const BellIcon = Icon(
  <>
    <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.4 5.4 2 6.2H4c.6-.8 2-2.2 2-6.2Z" />
    <path d="M9.7 19.5a2.4 2.4 0 0 0 4.6 0" />
  </>
);

export const CloseIcon = Icon(<path d="M5 5l14 14M19 5 5 19" />, { strokeWidth: 1.9 });

export const AlertHighIcon = Icon(
  <>
    <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
    <path d="M12 10v4.3" />
    <circle cx="12" cy="17.2" r="0.15" fill="currentColor" stroke="none" />
  </>
);

export const AlertMediumIcon = Icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v5" />
    <circle cx="12" cy="16.2" r="0.15" fill="currentColor" stroke="none" />
  </>
);

export const InfoIcon = Icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.2" />
    <circle cx="12" cy="8" r="0.15" fill="currentColor" stroke="none" />
  </>
);

export const CheckCircleIcon = Icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.4 2.4 2.4 5-5.4" />
  </>
);

export const SettingsIcon = Icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.1M12 18.4v2.1M4.9 6.1l1.5 1.5M17.6 16.4l1.5 1.5M3.5 12h2.1M18.4 12h2.1M6.1 19.1l1.5-1.5M16.4 7.6l1.5-1.5" />
  </>
);

export const SparkleIcon = Icon(
  <>
    <path d="M11 3.5c.6 3 2 4.4 5 5-3 .6-4.4 2-5 5-.6-3-2-4.4-5-5 3-.6 4.4-2 5-5Z" />
    <path d="M18.3 14.5c.3 1.5 1 2.2 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.3 2.2-1 2.5-2.5Z" />
  </>
);

export const ClockIcon = Icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.3V12l3.2 2" />
  </>
);

export const SearchIcon = Icon(
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.3 15.3 20.5 20.5" />
  </>
);

export const ArrowLeftIcon = Icon(<path d="M19 12H5M11 6l-6 6 6 6" />, { strokeWidth: 1.8 });

export const ShieldCheckIcon = Icon(
  <>
    <path d="M12 3.5 19.5 6.3V11c0 5-3.2 8.3-7.5 9.7C7.7 19.3 4.5 16 4.5 11V6.3L12 3.5Z" />
    <path d="m8.7 12 2.3 2.3 4.3-4.6" />
  </>
);

export const ShieldAlertIcon = Icon(
  <>
    <path d="M12 3.5 19.5 6.3V11c0 5-3.2 8.3-7.5 9.7C7.7 19.3 4.5 16 4.5 11V6.3L12 3.5Z" />
    <path d="M12 8.3v4M12 15.4h.01" />
  </>
);

export const LinkIcon = Icon(
  <>
    <path d="M9.5 14.5 14.5 9.5" />
    <path d="M11 6.5 12.6 4.9a3.4 3.4 0 0 1 4.8 4.8L15.8 11.3" />
    <path d="M13 17.5 11.4 19.1a3.4 3.4 0 0 1-4.8-4.8L8.2 12.7" />
  </>
);

export const EyeIcon = Icon(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </>
);

export const FingerprintIcon = Icon(
  <>
    <path d="M12 4.5c4.1 0 7.5 3.4 7.5 7.5 0 1.6-.2 3.1-.7 4.5" />
    <path d="M12 4.5A7.5 7.5 0 0 0 4.5 12c0 1.7.3 3 .8 4" />
    <path d="M12 8c2.2 0 4 1.8 4 4 0 2.2-.5 4.2-1.4 5.8" />
    <path d="M12 8a4 4 0 0 0-4 4c0 3-1 5.5-2.3 7" />
    <path d="M12 11.5c.9 0 1.6.7 1.6 1.6 0 2.5-.7 4.7-1.9 6.5" />
    <path d="M9.4 19.5c.9-1.6 1.4-3.5 1.4-5.4" />
  </>
);
