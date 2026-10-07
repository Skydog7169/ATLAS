// Pulls forcibly-displaced population figures by country of origin from the
// UNHCR Refugee Data Finder API into src/data/displacement.generated.json.
// Run by the weekly data-refresh workflow; the committed file is the fallback
// when the API is unreachable, so the site never depends on UNHCR at runtime.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/displacement.generated.json');
const BASE = 'https://api.unhcr.org/population/v1/population/';
const COLUMNS = ['refugees', 'asylum_seekers', 'idps', 'oip'];

async function fetchYear(year) {
  const params = new URLSearchParams({ limit: '1000', yearFrom: String(year), yearTo: String(year), coo_all: 'true' });
  for (const c of COLUMNS) params.append('columns[]', c);
  const res = await fetch(`${BASE}?${params}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`UNHCR API ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.items) ? json.items : [];
}

function toRows(items) {
  const rows = [];
  for (const it of items) {
    const iso = String(it.coo_iso ?? '');
    if (!/^[A-Z]{3}$/.test(iso)) continue;
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const row = { iso, refugees: n(it.refugees), asylumSeekers: n(it.asylum_seekers), idps: n(it.idps), oip: n(it.oip) };
    row.total = row.refugees + row.asylumSeekers + row.idps + row.oip;
    if (row.total > 0) rows.push(row);
  }
  return rows.sort((a, b) => b.total - a.total);
}

async function main() {
  const thisYear = new Date().getUTCFullYear();
  let year = thisYear;
  let items = [];
  try {
    for (; year >= thisYear - 2; year--) {
      items = await fetchYear(year);
      if (items.length > 50) break;
    }
  } catch (err) {
    if (existsSync(OUT)) {
      console.warn(`UNHCR fetch failed (${err.message}); keeping the committed file.`);
      return;
    }
    throw err;
  }
  const rows = toRows(items);
  if (rows.length < 50) {
    if (existsSync(OUT)) {
      console.warn(`UNHCR returned only ${rows.length} rows; keeping the committed file.`);
      return;
    }
    throw new Error('UNHCR returned too few rows');
  }
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  const out = {
    source: { name: `UNHCR Refugee Data Finder (${year} figures, by country of origin)`, url: 'https://www.unhcr.org/refugee-statistics/' },
    year,
    fetchedAt: new Date().toISOString().slice(0, 10),
    rows,
  };
  // Avoid churn: if the data is identical, keep the previous fetchedAt so the PR is empty.
  if (prev && JSON.stringify(prev.rows) === JSON.stringify(rows) && prev.year === year) {
    console.log('displacement data unchanged');
    return;
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${rows.length} rows for ${year} -> ${OUT}`);
}

await main();
