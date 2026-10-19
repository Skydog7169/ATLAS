// Pulls annual GDP (current US$) per country from 1990 from the World Bank
// API into src/data/worldbank-history.generated.json for the bloc trend
// charts. Refreshed by the weekly workflow; committed file is the fallback.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/worldbank-history.generated.json');
const KNOWN = new Set(JSON.parse(readFileSync(resolve(here, '../src/data/countries.generated.json'), 'utf8')).map((c) => c.cca3));
export const FROM = 1990;

/** World Bank rows → { iso: [gdp1990, gdp1991, ...] } with null gaps. Exported for tests. */
export function tabulate(rows, from = FROM, to = new Date().getFullYear()) {
  const out = {};
  for (const r of rows ?? []) {
    const iso = r.countryiso3code;
    const year = Number(r.date);
    if (!/^[A-Z]{3}$/.test(iso) || !KNOWN.has(iso) || year < from || year > to) continue;
    out[iso] ??= Array(to - from + 1).fill(null);
    out[iso][year - from] = r.value == null ? null : Math.round(Number(r.value));
  }
  // Trim trailing years with no data anywhere.
  let last = to;
  while (last > from && Object.values(out).every((a) => a[last - from] === null)) last -= 1;
  for (const iso of Object.keys(out)) out[iso] = out[iso].slice(0, last - from + 1);
  return { from, to: last, gdpUsd: out };
}

async function main() {
  const to = new Date().getFullYear();
  let rows;
  try {
    const url = `https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&date=${FROM}:${to}&per_page=20000`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`World Bank: ${res.status}`);
    [, rows] = await res.json();
  } catch (err) {
    if (existsSync(OUT)) {
      console.warn(`World Bank history fetch failed (${err.message}); keeping the committed file.`);
      return;
    }
    throw err;
  }
  const table = tabulate(rows, FROM, to);
  if (Object.keys(table.gdpUsd).length < 150) throw new Error('too few countries; refusing to overwrite');
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  if (prev && JSON.stringify(prev.gdpUsd) === JSON.stringify(table.gdpUsd)) {
    console.log('world bank history unchanged');
    return;
  }
  writeFileSync(OUT, JSON.stringify({ source: { name: 'World Bank Open Data', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD' }, fetchedAt: new Date().toISOString().slice(0, 10), ...table }) + '\n');
  console.log(`wrote GDP ${table.from}–${table.to} for ${Object.keys(table.gdpUsd).length} countries -> ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
