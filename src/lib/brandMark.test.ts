import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MARK_CARDINALS, MARK_INTERCARDINALS, MARK_RING, MARK_TICKS } from './brandMark';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const PATHS = [MARK_RING, MARK_TICKS, MARK_INTERCARDINALS, ...MARK_CARDINALS.flatMap((c) => [c.lit, c.shade])];

describe('brand mark: the static copies match the React logo', () => {
  it.each([
    ['the first-paint shell in index.html', '../../index.html'],
    ['public/favicon.svg', '../../public/favicon.svg'],
    ['the social card script', '../../scripts/build-og.mjs'],
  ])('%s draws the same compass rose', (_name, rel) => {
    const src = read(rel);
    for (const d of PATHS) expect(src).toContain(`d="${d}"`);
  });

  it('north is the one amber point', () => {
    expect(MARK_CARDINALS.map((c) => c.name)).toEqual(['N', 'E', 'S', 'W']);
    expect(read('../../public/favicon.svg').match(/#ffb347/g)).toHaveLength(2);
  });
});
