/**
 * Small colour-science helpers used by the palette and token tests: sRGB hex
 * parsing, OKLab (for mixes that match CSS `color-mix(in oklab, …)`), CIELAB
 * ΔE76, WCAG contrast and Machado et al. (2009) colour-vision-deficiency
 * simulation. Nothing here runs in the app at render time.
 */

export type Rgb = [number, number, number]; // 0..1 sRGB, gamma-encoded
export type Lab = [number, number, number];

export function parseHex(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as Rgb;
}

export function toHex(rgb: Rgb): string {
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function linear(rgb: Rgb): Rgb {
  return rgb.map(toLinear) as Rgb;
}

export function delinear(rgb: Rgb): Rgb {
  return rgb.map((c) => fromLinear(Math.min(1, Math.max(0, c)))) as Rgb;
}

export function toOklab(rgb: Rgb): Lab {
  const [r, g, b] = linear(rgb);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function fromOklab([L, a, b]: Lab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return delinear([
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]);
}

/** `color-mix(in oklab, a pct%, b)` for opaque colours. */
export function mixOklab(a: Rgb, pct: number, b: Rgb): Rgb {
  const A = toOklab(a);
  const B = toOklab(b);
  const t = pct / 100;
  return fromOklab([A[0] * t + B[0] * (1 - t), A[1] * t + B[1] * (1 - t), A[2] * t + B[2] * (1 - t)]);
}

/** `color-mix(in srgb, a pct%, b)`. */
export function mixSrgb(a: Rgb, pct: number, b: Rgb): Rgb {
  const t = pct / 100;
  return a.map((c, i) => c * t + b[i]! * (1 - t)) as Rgb;
}

export function toLab(rgb: Rgb): Lab {
  const [r, g, b] = linear(rgb);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 colour difference. */
export function deltaE(a: Rgb, b: Rgb): number {
  const A = toLab(a);
  const B = toLab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

export function luminance(rgb: Rgb): number {
  const [r, g, b] = linear(rgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type Cvd = 'protan' | 'deutan' | 'tritan';

/** Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB. */
const MACHADO: Record<Cvd, number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

export function simulate(rgb: Rgb, type: Cvd): Rgb {
  const lin = linear(rgb);
  const m = MACHADO[type];
  return delinear(m.map((row) => row[0]! * lin[0] + row[1]! * lin[1] + row[2]! * lin[2]) as Rgb);
}
