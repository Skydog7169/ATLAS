import { describe, expect, it } from 'vitest';
import { contrast, deltaE, mixOklab, mixSrgb, parseHex, simulate, toOklab, type Rgb } from './colorMath';
import { FAINT_FILL, RAMP_SPECS, conflictFillColor, ramp, unrestFillColor, type RampName } from './palette';
import { NUCLEAR_COLOR, NUCLEAR_HATCHED, NUCLEAR_STATUSES } from './nuclear';
import { TRADE_PARTNERS, tradeMix } from './trade';
import { themeTokens, type Theme } from '../test/themeTokens';
import type { Intensity } from '../data/types';

const TOKENS = themeTokens();
const THEMES: Theme[] = ['dark', 'light'];

/** Resolves the CSS this module emits (hex, var(), color-mix in oklab/srgb) against one theme's tokens. */
function resolve(css: string, theme: Theme): Rgb {
  const s = css.trim();
  if (s.startsWith('#')) return parseHex(s);
  const v = /^var\((--[\w-]+)\)$/.exec(s);
  if (v) {
    const hex = TOKENS[theme][v[1]!];
    if (!hex) throw new Error(`No ${v[1]} token in the ${theme} theme`);
    return parseHex(hex);
  }
  const m = /^color-mix\(in (oklab|srgb), (.+) ([\d.]+)%, (.+)\)$/.exec(s);
  if (m) {
    const a = resolve(m[2]!, theme);
    const b = resolve(m[4]!, theme);
    return m[1] === 'oklab' ? mixOklab(a, Number(m[3]), b) : mixSrgb(a, Number(m[3]), b);
  }
  throw new Error(`Cannot resolve ${css}`);
}

const RAMPS = Object.keys(RAMP_SPECS) as RampName[];
const INTENSITIES: Intensity[] = ['latent', 'low', 'medium', 'high'];

describe('palette contract: sequential ramps', () => {
  for (const theme of THEMES) {
    const land = parseHex(TOKENS[theme]['--land']!);
    for (const name of RAMPS) {
      const colours = ramp(name).map((c) => resolve(c, theme));

      it(`${name} (${theme}): each class sits farther from land in lightness than the one below`, () => {
        const L0 = toOklab(land)[0];
        const dL = colours.map((c) => Math.abs(toOklab(c)[0] - L0));
        for (let i = 1; i < dL.length; i++) expect(dL[i], `class ${i}`).toBeGreaterThan(dL[i - 1]!);
      });

      it(`${name} (${theme}): adjacent classes differ by at least ΔE 15 and the first clears land at 1.8:1`, () => {
        for (let i = 2; i < colours.length; i++) expect(deltaE(colours[i]!, colours[i - 1]!), `classes ${i - 1}–${i}`).toBeGreaterThanOrEqual(15);
        expect(contrast(colours[1]!, land)).toBeGreaterThanOrEqual(1.8);
      });
    }

    it(`overview (${theme}): the top class stays clear of the selection accent`, () => {
      const top = resolve(ramp('overview').at(-1)!, theme);
      expect(deltaE(top, parseHex(TOKENS[theme]['--accent']!))).toBeGreaterThanOrEqual(15);
    });

    it(`conflict and unrest tints (${theme}) follow intensity in lightness`, () => {
      for (const fn of [conflictFillColor, unrestFillColor]) {
        const L0 = toOklab(land)[0];
        const dL = INTENSITIES.map((i) => Math.abs(toOklab(resolve(fn(i), theme))[0] - L0));
        for (let i = 1; i < dL.length; i++) expect(dL[i]).toBeGreaterThan(dL[i - 1]!);
        expect(contrast(resolve(fn('latent'), theme), land)).toBeGreaterThanOrEqual(1.5);
      }
    });

    it(`trade bands (${theme}) deepen with share for every partner, and "none above 10%" differs from land`, () => {
      const L0 = toOklab(land)[0];
      for (const p of TRADE_PARTNERS) {
        const dL = ([0, 1, 2] as const).map((b) => Math.abs(toOklab(resolve(tradeMix(p, b), theme))[0] - L0));
        expect(dL[1]).toBeGreaterThan(dL[0]!);
        expect(dL[2]).toBeGreaterThan(dL[1]!);
      }
      expect(deltaE(resolve(FAINT_FILL, theme), land)).toBeGreaterThanOrEqual(5);
    });
  }
});

describe('palette contract: colour-vision deficiency', () => {
  // Machado et al. (2009) protan and deutan simulation; where hue alone fails, a pattern must carry the difference.
  const cvd = ['protan', 'deutan'] as const;

  it('nuclear: solid statuses stay apart, and umbrella is told apart by pattern', () => {
    const solid = NUCLEAR_STATUSES.filter((s) => !NUCLEAR_HATCHED.has(s));
    const failures: string[] = [];
    for (const type of cvd)
      for (let i = 0; i < solid.length; i++)
        for (let j = i + 1; j < solid.length; j++) {
          const a = simulate(parseHex(NUCLEAR_COLOR[solid[i]!]), type);
          const b = simulate(parseHex(NUCLEAR_COLOR[solid[j]!]), type);
          const d = deltaE(a, b);
          if (d < 12) failures.push(`${solid[i]}/${solid[j]} ${type} ΔE ${d.toFixed(1)}`);
        }
    expect(failures).toEqual([]);
    expect(NUCLEAR_HATCHED.has('umbrella')).toBe(true);
    // Armed is the light, heavy solid, so it also clears umbrella's hue under simulation.
    const armedVsUmbrella = Math.min(...cvd.map((t) => deltaE(simulate(parseHex(NUCLEAR_COLOR.armed), t), simulate(parseHex(NUCLEAR_COLOR.umbrella), t))));
    expect(armedVsUmbrella).toBeGreaterThanOrEqual(12);
  });

  it('ramps keep their classes apart for colour-blind readers (lightness, not hue, carries them)', () => {
    const failures: string[] = [];
    for (const theme of THEMES)
      for (const name of RAMPS)
        for (const type of cvd) {
          const colours = ramp(name).map((c) => simulate(resolve(c, theme), type));
          for (let i = 2; i < colours.length; i++) {
            const d = deltaE(colours[i]!, colours[i - 1]!);
            if (d < 12) failures.push(`${name} ${theme} ${type} ${i - 1}–${i} ΔE ${d.toFixed(1)}`);
          }
        }
    expect(failures).toEqual([]);
  });
});
