// Pulls each country's goods-export shares to the United States, China and
// the European Union from the World Bank WITS trade-statistics API into
// src/data/trade.generated.json. Three SDMX calls per year (US+China, the 27
// EU members, the world total); the newest year with data wins per reporter.
// Refreshed by the weekly workflow; the committed file is the fallback.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/trade.generated.json');
const COUNTRIES = JSON.parse(readFileSync(resolve(here, '../src/data/countries.generated.json'), 'utf8'));
const KNOWN = new Set(COUNTRIES.map((c) => c.cca3));
const BASE = 'https://wits.worldbank.org/API/V1/SDMX/V21/datasource/tradestats-trade';
export const EU27 = ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'];
/** WITS lags two to three years; try the newest plausible year first. */
const YEARS = [new Date().getFullYear() - 2, new Date().getFullYear() - 3, new Date().getFullYear() - 4];

async function query(year, partners) {
  const url = `${BASE}/reporter/all/year/${year}/partner/${partners.join(';').toLowerCase()}/product/Total/indicator/XPRT-TRD-VL?format=JSON`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (res.status === 404) return null; // no data for that year
  if (!res.ok) throw new Error(`WITS ${year}: ${res.status}`);
  return parseSdmx(await res.json());
}

/** SDMX-JSON → Map<reporter, Map<partner, usdThousand>>. Exported for tests. */
export function parseSdmx(json) {
  const dims = json.structure.dimensions.series;
  const pos = Object.fromEntries(dims.map((d, i) => [d.id, i]));
  const reporters = dims[pos.REPORTER].values.map((v) => v.id);
  const partners = dims[pos.PARTNER].values.map((v) => v.id);
  const out = new Map();
  for (const [key, s] of Object.entries(json.dataSets[0].series ?? {})) {
    const idx = key.split(':').map(Number);
    const reporter = reporters[idx[pos.REPORTER]];
    const partner = partners[idx[pos.PARTNER]];
    const value = Object.values(s.observations ?? {})[0]?.[0];
    if (typeof value !== 'number') continue;
    if (!out.has(reporter)) out.set(reporter, new Map());
    out.get(reporter).set(partner, value);
  }
  return out;
}

/** Combines the three query results for one year into rows with shares (0–1). Exported for tests. */
export function buildRows(year, usChn, eu, world) {
  const rows = [];
  for (const [reporter, partners] of world) {
    if (!KNOWN.has(reporter)) continue;
    const total = partners.get('WLD');
    if (!total || total <= 0) continue;
    const us = usChn.get(reporter)?.get('USA') ?? 0;
    const chn = usChn.get(reporter)?.get('CHN') ?? 0;
    let euSum = 0;
    for (const [p, v] of eu.get(reporter) ?? []) if (EU27.includes(p)) euSum += v;
    rows.push({ iso: reporter, year, exportsUsd: Math.round(total * 1000), us: round(us / total), china: round(chn / total), eu: round(euSum / total) });
  }
  return rows;
}

const round = (x) => Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000;

async function main() {
  const byIso = new Map();
  try {
    for (const year of YEARS) {
      const [usChn, eu, world] = await Promise.all([query(year, ['USA', 'CHN']), query(year, EU27), query(year, ['WLD'])]);
      if (!usChn || !eu || !world) {
        console.log(`WITS: no data for ${year}`);
        continue;
      }
      for (const row of buildRows(year, usChn, eu, world)) if (!byIso.has(row.iso)) byIso.set(row.iso, row);
      console.log(`WITS ${year}: ${byIso.size} reporters so far`);
    }
  } catch (err) {
    if (existsSync(OUT)) {
      console.warn(`WITS fetch failed (${err.message}); keeping the committed file.`);
      return;
    }
    throw err;
  }
  if (byIso.size < 100) throw new Error(`only ${byIso.size} reporters; refusing to overwrite`);
  const rows = [...byIso.values()].sort((a, b) => a.iso.localeCompare(b.iso));
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  if (prev && JSON.stringify(prev.rows) === JSON.stringify(rows)) {
    console.log('trade data unchanged');
    return;
  }
  writeFileSync(OUT, JSON.stringify({ source: { name: 'World Bank WITS trade statistics', url: 'https://wits.worldbank.org/' }, fetchedAt: new Date().toISOString().slice(0, 10), rows }, null, 1) + '\n');
  console.log(`wrote ${rows.length} rows -> ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
