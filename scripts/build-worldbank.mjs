// Pulls the latest available population, GDP and military-expenditure figures
// per country from the World Bank API into src/data/worldbank.generated.json
// for bloc analytics. Refreshed by the weekly workflow; committed file is the fallback.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/worldbank.generated.json');
// World Bank aggregates (regions, income groups) also use 3-letter codes; keep only real countries.
const KNOWN = new Set(JSON.parse(readFileSync(resolve(here, '../src/data/countries.generated.json'), 'utf8')).map((c) => c.cca3));
const INDICATORS = {
  population: 'SP.POP.TOTL',
  gdpUsd: 'NY.GDP.MKTP.CD',
  militaryUsd: 'MS.MIL.XPND.CD',
};

async function fetchIndicator(code) {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&mrnev=1&per_page=500`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`World Bank ${code}: ${res.status}`);
  const [, rows] = await res.json();
  const out = new Map();
  for (const r of rows ?? []) {
    const iso = r.countryiso3code;
    if (!/^[A-Z]{3}$/.test(iso) || r.value == null) continue;
    out.set(iso, { value: Number(r.value), year: Number(r.date) });
  }
  return out;
}

async function main() {
  let maps;
  try {
    maps = Object.fromEntries(await Promise.all(Object.entries(INDICATORS).map(async ([k, code]) => [k, await fetchIndicator(code)])));
  } catch (err) {
    if (existsSync(OUT)) {
      console.warn(`World Bank fetch failed (${err.message}); keeping the committed file.`);
      return;
    }
    throw err;
  }
  const isos = new Set();
  for (const m of Object.values(maps)) for (const iso of m.keys()) isos.add(iso);
  const rows = [...isos]
    .filter((iso) => KNOWN.has(iso))
    .map((iso) => ({
      iso,
      population: maps.population.get(iso)?.value ?? null,
      populationYear: maps.population.get(iso)?.year ?? null,
      gdpUsd: maps.gdpUsd.get(iso)?.value ?? null,
      gdpYear: maps.gdpUsd.get(iso)?.year ?? null,
      militaryUsd: maps.militaryUsd.get(iso)?.value ?? null,
      militaryYear: maps.militaryUsd.get(iso)?.year ?? null,
    }))
    .filter((r) => r.population !== null)
    .sort((a, b) => a.iso.localeCompare(b.iso));
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  if (prev && JSON.stringify(prev.rows) === JSON.stringify(rows)) {
    console.log('world bank data unchanged');
    return;
  }
  writeFileSync(OUT, JSON.stringify({ source: { name: 'World Bank Open Data', url: 'https://data.worldbank.org/' }, fetchedAt: new Date().toISOString().slice(0, 10), rows }, null, 1) + '\n');
  console.log(`wrote ${rows.length} rows -> ${OUT}`);
}
await main();
