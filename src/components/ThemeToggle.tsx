import { useEffect, useState } from 'react';

type Theme = 'auto' | 'light' | 'dark';
const KEY = 'atlas:theme';
const ORDER: Theme[] = ['auto', 'dark', 'light'];

function readStored(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readStored);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      if (theme === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      /* storage blocked: theme still applies for this page view */
    }
  }, [theme]);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'auto';
  const label = theme === 'auto' ? 'System theme' : theme === 'dark' ? 'Dark theme' : 'Light theme';

  return (
    <button className="icon-btn" onClick={() => setTheme(next)} aria-label={`${label}. Switch to ${next} theme`} title={label}>
      {theme === 'light' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : theme === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      )}
    </button>
  );
}
