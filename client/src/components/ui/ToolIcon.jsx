const ICON_PATHS = {
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a2 2 0 0 1 2 2v15a2.5 2.5 0 0 0-2.5-2.5H4Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17a2.5 2.5 0 0 1 2.5-2.5H20Z" />
    </>
  ),
  thesis: (
    <>
      <path d="m3 8 9-5 9 5-9 5Z" />
      <path d="M7 10.5V15c2.8 2.2 7.2 2.2 10 0v-4.5" />
      <path d="M21 8v6" />
    </>
  ),
  research: (
    <>
      <path d="M6 2.8h8l4 4V21H6Z" />
      <path d="M14 2.8V7h4M9 11h6M9 15h6" />
    </>
  ),
  letter: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  'merge-pdf': (
    <>
      <path d="M8 3h8l4 4v11a2 2 0 0 1-2 2H8Z" />
      <path d="M16 3v5h4M4 7v12a2 2 0 0 0 2 2h9" />
    </>
  ),
  'compress-pdf': (
    <>
      <path d="M7 3h7l5 5v13a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 21V4.5A1.5 1.5 0 0 1 7 3Z" />
      <path d="M14 3v5h5M12 9v6M9.5 11.5l2.5-2.5 2.5 2.5M9.5 12.5l2.5 2.5 2.5-2.5" />
    </>
  ),
  'merge-word': (
    <>
      <path d="M8 3h8l4 4v11a2 2 0 0 1-2 2H8Z" />
      <path d="M16 3v5h4M4 7v12a2 2 0 0 0 2 2h9M10 12l1.5 5 1.5-3 1.5 3 1.5-5" />
    </>
  ),
  'pdf-to-word': (
    <>
      <path d="M5 3h9l5 5v13H5Z" />
      <path d="M14 3v5h5M8 13h8M8 17h5" />
      <path d="m17 11 2 2 2-2" />
    </>
  ),
  'excel-to-pdf': (
    <>
      <path d="M5 3h9l5 5v13H5Z" />
      <path d="M14 3v5h5M8 12h8v6H8zM12 12v6M8 15h8" />
    </>
  ),
  'hindi-to-krutidev': (
    <>
      <path d="M4 6h16M8 6v3c0 2.2-1.2 4-3 5M8 9c0 3 1.5 5.5 4 7" />
      <path d="M15 11h4M17 9v8M14 17h6" />
    </>
  ),
  'compress-image': (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
      <path d="m14 5 2.5 2.5 2.5-2.5" />
      <path d="M16.5 7.5V3" />
    </>
  ),
  'remove-bg': (
    <>
      <path d="m14 7 3-3 3 3-3 3z" />
      <path d="m14 7-9.5 9.5a1.5 1.5 0 0 0 0 2.12l.88.88a1.5 1.5 0 0 0 2.12 0L17 10" />
      <path d="M4 5h.01M2 9h.01M7 2h.01M20 16h.01M17 20h.01" />
    </>
  ),
  'unlock-pdf': (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </>
  ),
  'legal-photo': (
    <>
      <rect width="18" height="18" x="3" y="3" rx="3" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M6.5 18c.2-2.5 2.5-4 5.5-4s5.3 1.5 5.5 4" />
      <line x1="16" y1="5.5" x2="18.5" y2="5.5" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  upload: <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />,
  download: <path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M5 20h14" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  file: (
    <>
      <path d="M6 2.8h8l4 4V21H6Z" />
      <path d="M14 2.8V7h4" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5V17M12 7h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.8 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2Z" />
      <path d="m18.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8ZM5.5 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  phone: (
    <path d="M6.5 3h3L11 7l-2 1.7a15 15 0 0 0 6.3 6.3L17 13l4 1.5v3A3.5 3.5 0 0 1 17.5 21 14.5 14.5 0 0 1 3 6.5 3.5 3.5 0 0 1 6.5 3Z" />
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
};

export default function ToolIcon({ name, size = 24, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name] || ICON_PATHS.research}
    </svg>
  );
}
