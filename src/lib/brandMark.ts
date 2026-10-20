/**
 * The ATLAS mark: a sci-fi compass rose. Four faceted cardinal points (north in
 * the warning amber), thin intercardinal points, a segmented ring with ticks and a
 * hollow centre, on a 32×32 grid. Path data lives here once; the React logo draws
 * from it, and brandMark.test.ts checks that the static copies (the first-paint
 * shell in index.html, public/favicon.svg and scripts/build-og.mjs) still match.
 */
export const MARK_RING = 'M18.83 3.72A12.6 12.6 0 0 1 28.28 13.17M28.28 18.83A12.6 12.6 0 0 1 18.83 28.28M13.17 28.28A12.6 12.6 0 0 1 3.72 18.83M3.72 13.17A12.6 12.6 0 0 1 13.17 3.72';
export const MARK_TICKS = 'M25.05 6.95L26.32 5.68M25.05 25.05L26.32 26.32M6.95 25.05L5.68 26.32M6.95 6.95L5.68 5.68';
export const MARK_INTERCARDINALS = 'M22.51 9.49L18.10 16L16 16L16 13.90ZM22.51 22.51L16 18.10L16 16L18.10 16ZM9.49 22.51L13.90 16L16 16L16 18.10ZM9.49 9.49L16 13.90L16 16L13.90 16Z';
/** Each cardinal point as its lit half and its shaded half. */
export const MARK_CARDINALS = [
  { name: 'N', lit: 'M16 2.20L18.12 13.88L16 16Z', shade: 'M16 2.20L16 16L13.88 13.88Z' },
  { name: 'E', lit: 'M29.80 16L18.12 18.12L16 16Z', shade: 'M29.80 16L16 16L18.12 13.88Z' },
  { name: 'S', lit: 'M16 29.80L13.88 18.12L16 16Z', shade: 'M16 29.80L16 16L18.12 18.12Z' },
  { name: 'W', lit: 'M2.20 16L13.88 13.88L16 16Z', shade: 'M2.20 16L16 16L13.88 18.12Z' },
] as const;
