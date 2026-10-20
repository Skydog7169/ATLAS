export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_KEY = 'atlas:theme';

function asTheme(v: string | null): ThemeChoice | null {
  return v === 'auto' || v === 'light' || v === 'dark' ? v : null;
}

/**
 * The theme an embed pins from its link (`#embed=1&theme=light|dark|auto`),
 * or null when the page is not an embed. Embeds default to dark, the brand
 * surface, so a publisher sees the same map their readers do whatever the
 * reader's OS prefers. index.html applies the same rule before first paint.
 */
export function embedTheme(hash: string): ThemeChoice | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (p.get('embed') !== '1') return null;
  return asTheme(p.get('theme')) ?? 'dark';
}

export function readStoredTheme(): ThemeChoice {
  try {
    const v = asTheme(localStorage.getItem(THEME_KEY));
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(theme: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
