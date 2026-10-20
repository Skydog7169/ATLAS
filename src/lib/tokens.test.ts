import { describe, expect, it } from 'vitest';
import { contrast, parseHex } from './colorMath';
import { globalCss, themeTokens, type Theme } from '../test/themeTokens';

const TOKENS = themeTokens();
const TEXT = ['--fg', '--fg-muted', '--fg-faint', '--accent', '--warn', '--alert'];
const SURFACES = ['--bg', '--bg-elev', '--bg-elev-2'];

describe('design tokens', () => {
  it('defines every colour token once, for both themes', () => {
    for (const name of [...TEXT, ...SURFACES, '--land', '--ocean', '--border']) {
      expect(TOKENS.light[name], `${name} light`).toBeDefined();
      expect(TOKENS.dark[name], `${name} dark`).toBeDefined();
    }
    // The light palette used to be written out twice; one light-dark() definition replaces both copies.
    expect(globalCss()).not.toMatch(/prefers-color-scheme:\s*light\)\s*\{\s*--bg/);
  });

  for (const theme of ['dark', 'light'] as Theme[]) {
    it(`text tokens reach WCAG AA (4.5:1) on every surface in the ${theme} theme`, () => {
      const t = TOKENS[theme];
      const failures: string[] = [];
      for (const fg of TEXT)
        for (const bg of SURFACES) {
          const cr = contrast(parseHex(t[fg]!), parseHex(t[bg]!));
          if (cr < 4.5) failures.push(`${fg} ${t[fg]} on ${bg} ${t[bg]} = ${cr.toFixed(2)}`);
        }
      expect(failures).toEqual([]);
    });

    it(`white-on-accent and accent-fg-on-accent stay legible in the ${theme} theme`, () => {
      const t = TOKENS[theme];
      expect(contrast(parseHex(t['--accent-fg']!), parseHex(t['--accent']!))).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('type floors', () => {
  // A lightweight stylelint stand-in: px font sizes in the stylesheet may not go under 11px.
  it('sets no font-size under 11px', () => {
    const small: string[] = [];
    for (const [i, line] of globalCss().split('\n').entries()) {
      const m = /font-size:\s*([\d.]+)(px|rem)/.exec(line);
      if (!m) continue;
      const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
      if (px < 11) small.push(`global.css:${i + 1} ${line.trim()}`);
    }
    expect(small).toEqual([]);
  });
});
