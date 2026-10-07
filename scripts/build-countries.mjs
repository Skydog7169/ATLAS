// Derives a slim, app-specific country reference table from the
// `world-countries` package so the browser bundle does not carry its
// 20 MB of flags and translations. Re-run with `pnpm run data:countries`
// after bumping world-countries; CI fails if the committed output drifts.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = require.resolve('world-countries/countries.json');
const raw = JSON.parse(readFileSync(source, 'utf8'));

const rows = raw
  .map((c) => ({
    cca3: c.cca3,
    cca2: c.cca2,
    ccn3: c.ccn3 || null,
    name: c.name.common,
    official: c.name.official,
    capital: c.capital?.[0] ?? null,
    region: c.region,
    subregion: c.subregion || null,
    latlng: c.latlng,
    area: c.area,
    independent: Boolean(c.independent),
    unMember: Boolean(c.unMember),
  }))
  .sort((a, b) => a.cca3.localeCompare(b.cca3));

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../src/data/countries.generated.json');
writeFileSync(out, JSON.stringify(rows) + '\n');
console.log(`wrote ${rows.length} countries -> ${out}`);
