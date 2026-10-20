/**
 * The palette contract. Every sequential ramp on the map is built here from
 * one hue token per ramp (`--ramp-*` in global.css, defined for both themes)
 * mixed in OKLab with `--land`, and for the top classes with `--fg`. Because
 * `--land` and `--fg` sit at opposite ends of lightness in either theme, the
 * class farthest from the land colour is always the highest value: lighter on
 * the dark map, darker on the light one. palette.test.ts resolves every ramp
 * against both themes' tokens and checks the ordering, the spacing between
 * classes and the first class's contrast with empty land.
 *
 * Colour roles (see the block at the top of global.css): cyan is UI and
 * selection only, red→yellow is conflict intensity, amber is personal
 * (watchlist, since-last-visit). Ramps keep clear of those.
 */
import type { Intensity } from '../data/types';

/** A ramp step: the share of the hue, mixed with land (below the hue) or with fg (beyond it). */
export type Step = readonly [pct: number, toward: 'land' | 'fg'];

export interface RampSpec {
  /** CSS custom property holding the ramp hue for the active theme. */
  token: string;
  /** One entry per non-zero class, lowest first. */
  steps: readonly Step[];
}

export const RAMP_SPECS = {
  overview: { token: '--ramp-overview', steps: [[32, 'land'], [55, 'land'], [77, 'land'], [100, 'land']] },
  sanctions: { token: '--ramp-sanctions', steps: [[44, 'land'], [73, 'land'], [99, 'fg'], [70, 'fg']] },
  displacement: { token: '--ramp-displacement', steps: [[54, 'land'], [77, 'land'], [100, 'land'], [78, 'fg'], [55, 'fg']] },
  elections: { token: '--ramp-elections', steps: [[40, 'land'], [70, 'land'], [100, 'land'], [70, 'fg']] },
  military: { token: '--ramp-military', steps: [[42, 'land'], [71, 'land'], [99, 'fg'], [70, 'fg']] },
  acled: { token: '--ramp-acled', steps: [[46, 'land'], [75, 'land'], [97, 'fg'], [68, 'fg'], [40, 'fg']] },
  acledUnrest: { token: '--ramp-acled-unrest', steps: [[52, 'land'], [75, 'land'], [99, 'land'], [78, 'fg'], [55, 'fg']] },
  ucdp: { token: '--ramp-ucdp', steps: [[54, 'land'], [77, 'land'], [100, 'land'], [78, 'fg'], [55, 'fg']] },
  /** Civil-unrest country tint, latent → high. */
  unrest: { token: '--ramp-unrest', steps: [[42, 'land'], [71, 'land'], [99, 'fg'], [70, 'fg']] },
  /** Conflict territory tint, latent → high. */
  conflict: { token: '--ramp-conflict', steps: [[44, 'land'], [73, 'land'], [99, 'fg'], [70, 'fg']] },
} as const satisfies Record<string, RampSpec>;

export type RampName = keyof typeof RAMP_SPECS;

/** CSS for one step of a ramp. */
export function stepColor(token: string, [pct, toward]: Step): string {
  return pct >= 100 ? `var(${token})` : `color-mix(in oklab, var(${token}) ${pct}%, var(--${toward}))`;
}

/** A ramp as CSS colours, class 0 (`var(--land)`) first. */
export function ramp(name: RampName): string[] {
  const spec: RampSpec = RAMP_SPECS[name];
  return ['var(--land)', ...spec.steps.map((s) => stepColor(spec.token, s))];
}

/** Pattern id drawn by the map's CountryLayer: a sparse cross-hatch over land. */
export const NO_DATA_PATTERN = 'no-data';

/** Fill for a country that has no row in a quantitative layer's source, so it never reads as a real zero. */
export const NO_DATA_FILL = `url(#${NO_DATA_PATTERN})`;

/** A faint neutral class for "measured, but below the floor", distinct from both land and no data. */
export const FAINT_FILL = 'color-mix(in oklab, var(--fg) 14%, var(--land))';

/** Legend swatch style for a hatched fill, mirroring the map pattern (a 35% wash under solid stripes). */
export function hatchSwatch(color: string): { backgroundColor: string; backgroundImage: string } {
  return { backgroundColor: `color-mix(in srgb, ${color} 35%, var(--land))`, backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 3px, transparent 3px 6px)` };
}

/** Swatch background for the "No data" legend row; mirrors the map's no-data pattern. */
export const NO_DATA_SWATCH = 'repeating-linear-gradient(45deg, var(--fg-faint) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, var(--fg-faint) 0 1px, var(--land) 1px 4px)';

const INTENSITY_STEP: Record<Intensity, number> = { latent: 0, low: 1, medium: 2, high: 3 };

/** Country tint in Conflicts mode by the most intense conflict on its territory. Map and legend both use this. */
export function conflictFillColor(intensity: Intensity): string {
  const spec: RampSpec = RAMP_SPECS.conflict;
  return stepColor(spec.token, spec.steps[INTENSITY_STEP[intensity]]!);
}

/** Civil-unrest tint, a lightness ramp of one violet. */
export function unrestFillColor(intensity: Intensity): string {
  const spec: RampSpec = RAMP_SPECS.unrest;
  return stepColor(spec.token, spec.steps[INTENSITY_STEP[intensity]]!);
}

/** Parses a computed CSS colour (rgb(), color(srgb …) or oklab()) to its OKLab lightness, or null. */
export function computedLightness(css: string): number | null {
  const nums = (css.match(/-?[\d.]+(?:e-?\d+)?%?/g) ?? []).map((n) => (n.endsWith('%') ? Number(n.slice(0, -1)) / 100 : Number(n)));
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  if (css.startsWith('oklab(') || css.startsWith('oklch(')) return nums[0] ?? null;
  let rgb: number[] | null = null;
  if (css.startsWith('rgb')) rgb = nums.slice(0, 3).map((n) => n / 255);
  else if (css.startsWith('color(srgb')) rgb = nums.slice(0, 3);
  if (!rgb || rgb.length < 3) return null;
  const [r, g, b] = rgb.map(lin) as [number, number, number];
  return Math.cbrt(0.2126 * r + 0.7152 * g + 0.0722 * b); // ≈ OKLab L
}

const darkCache = new Map<string, boolean>();

/**
 * Whether a fill reads as dark (labels on it want light text). Resolved through
 * the live stylesheet and cached per theme; the caller passes the theme key.
 */
export function isDarkFill(fill: string, themeKey: string): boolean | null {
  const key = themeKey + '|' + fill;
  const hit = darkCache.get(key);
  if (hit !== undefined) return hit;
  if (fill.startsWith('url(')) return null;
  const L = computedLightness(resolveColor(fill, ''));
  if (L === null) return null;
  const dark = L < 0.62;
  darkCache.set(key, dark);
  return dark;
}

/**
 * The computed colour of a CSS custom property or expression, for canvas
 * code that cannot read `light-dark()` or `color-mix()` itself.
 */
export function resolveColor(expr: string, fallback: string): string {
  if (typeof document === 'undefined' || !document.body) return fallback;
  const probe = document.createElement('span');
  probe.style.color = expr.startsWith('--') ? `var(${expr})` : expr;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const out = getComputedStyle(probe).color;
  probe.remove();
  return out || fallback;
}
