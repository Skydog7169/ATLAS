import { describe, expect, it } from 'vitest';
import { applyTheme, embedTheme } from './theme';
import { DEFAULT_STATE, parse, serialize } from './urlState';

const ok = { bloc: () => true, conflict: () => true, country: () => true };

describe('theme', () => {
  it('pins embeds to dark unless the link names a theme, and leaves the full site alone', () => {
    expect(embedTheme('#mode=blocs')).toBeNull();
    expect(embedTheme('#mode=blocs&embed=1')).toBe('dark');
    expect(embedTheme('#embed=1&theme=light')).toBe('light');
    expect(embedTheme('#embed=1&theme=auto')).toBe('auto');
    expect(embedTheme('#embed=1&theme=sepia')).toBe('dark');
  });

  it('keeps an embed theme in the link across the hash rewrite', () => {
    const s = parse('#mode=conflicts&embed=1&theme=light', ok);
    expect(s.theme).toBe('light');
    expect(serialize(s)).toContain('theme=light');
    expect(parse('#mode=conflicts&theme=light', ok).theme).toBeUndefined();
    expect(serialize({ ...DEFAULT_STATE, theme: 'light' })).not.toContain('theme');
  });

  it('applies and clears data-theme', () => {
    const el = document.createElement('html');
    applyTheme('light', el);
    expect(el.dataset.theme).toBe('light');
    applyTheme('auto', el);
    expect(el.hasAttribute('data-theme')).toBe(false);
  });
});
