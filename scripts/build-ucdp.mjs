// Pulls organised-violence fatalities per country for the last complete year
// from the Uppsala Conflict Data Program's Georeferenced Event Dataset (GED)
// into src/data/ucdp.generated.json. The API needs a free token issued by
// UCDP on request; without the UCDP_TOKEN secret this script writes an
// "unavailable" file and exits 0, and the app hides the layer. The committed
// file is the fallback when the API is unreachable.
//
//   UCDP_TOKEN=... node scripts/build-ucdp.mjs [--version 26.1] [--year 2025]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/ucdp.generated.json');
const COUNTRIES = JSON.parse(readFileSync(resolve(here, '../src/data/countries.generated.json'), 'utf8'));
const API = 'https://ucdpapi.pcr.uu.se/api/gedevents';
const SOURCE = { name: 'UCDP Georeferenced Event Dataset', url: 'https://ucdp.uu.se/downloads/' };
const PAGE = 1000;
/** UCDP type_of_violence codes. */
const TYPES = { 1: 'stateBased', 2: 'nonState', 3: 'oneSided' };

/** GED country names that do not match the countries table after stripping the parenthetical. */
const ALIASES = {
  'dr congo': 'COD',
  'congo': 'COG',
  'ivory coast': 'CIV',
  'myanmar': 'MMR',
  'russia': 'RUS',
  'yemen': 'YEM',
  'cambodia': 'KHM',
  'united states of america': 'USA',
  'north korea': 'PRK',
  'south korea': 'KOR',
  'czech republic': 'CZE',
  'macedonia': 'MKD',
  'serbia': 'SRB',
  'bosnia-herzegovina': 'BIH',
  'rumania': 'ROU',
  'madagascar': 'MDG',
  'zimbabwe': 'ZWE',
  'tanzania': 'TZA',
  'kingdom of eswatini': 'SWZ',
  'eswatini': 'SWZ',
  'laos': 'LAO',
  'brunei': 'BRN',
  'vietnam': 'VNM',
  'syria': 'SYR',
  'iran': 'IRN',
  'moldova': 'MDA',
  'palestine': 'PSE',
  'turkey': 'TUR',
  'türkiye': 'TUR',
  'east timor': 'TLS',
  'cape verde': 'CPV',
  'the gambia': 'GMB',
  'gambia': 'GMB',
  'micronesia': 'FSM',
  'bolivia': 'BOL',
  'venezuela': 'VEN',
  'kosovo': 'UNK',
};

const BY_NAME = new Map();
for (const c of COUNTRIES) {
  BY_NAME.set(c.name.toLowerCase(), c.cca3);
  BY_NAME.set(c.official.toLowerCase(), c.cca3);
}

function unavailable(reason, version) {
  return { source: SOURCE, available: false, reason, fetchedAt: new Date().toISOString().slice(0, 10), version, from: null, to: null, rows: [] };
}

/** Maps a GED country name ("Russia (Soviet Union)", "DR Congo (Zaire)") to ISO3, or null. Exported for tests. */
export function isoForName(name) {
  if (!name) return null;
  const base = String(name).replace(/\s*\(.*?\)\s*/g, ' ').trim().toLowerCase();
  return ALIASES[base] ?? BY_NAME.get(base) ?? null;
}

/** Aggregates GED events into per-country best-estimate fatalities by type. Exported for tests. */
export function aggregate(rows, into = new Map(), unmapped = new Set()) {
  for (const r of rows) {
    const iso = isoForName(r.country);
    if (!iso) {
      if (r.country) unmapped.add(r.country);
      continue;
    }
    const cur = into.get(iso) ?? { iso, stateBased: 0, nonState: 0, oneSided: 0, events: 0 };
    const key = TYPES[Number(r.type_of_violence)];
    const deaths = Number(r.best) || 0;
    if (key) cur[key] += deaths;
    cur.events += 1;
    into.set(iso, cur);
  }
  return into;
}

async function fetchYear(token, version, year) {
  const counts = new Map();
  const unmapped = new Set();
  let total = 0;
  for (let page = 0; page < 500; page++) {
    const params = new URLSearchParams({ pagesize: String(PAGE), page: String(page), StartDate: `${year}-01-01`, EndDate: `${year}-12-31` });
    const res = await fetch(`${API}/${version}?${params}`, { headers: { 'x-ucdp-access-token': token }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`UCDP read: ${res.status}`);
    const json = await res.json();
    const data = Array.isArray(json.Result) ? json.Result : [];
    aggregate(data, counts, unmapped);
    total += data.length;
    const pages = Number(json.TotalPages) || 0;
    if (!data.length || page + 1 >= pages) break;
  }
  return { counts, unmapped: [...unmapped].sort(), total };
}

async function main() {
  const argv = process.argv.slice(2);
  const version = argv.includes('--version') ? argv[argv.indexOf('--version') + 1] : (process.env.UCDP_VERSION ?? '26.1');
  // The annual release numbered YY.1 covers events through the previous calendar year.
  const year = argv.includes('--year') ? Number(argv[argv.indexOf('--year') + 1]) : 2000 + Number(version.split('.')[0]) - 1;
  const token = process.env.UCDP_TOKEN;
  if (!token) {
    const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
    if (prev?.available) {
      console.warn('UCDP_TOKEN not set; keeping the committed file.');
      return;
    }
    writeFileSync(OUT, JSON.stringify(unavailable('UCDP_TOKEN secret is not set', version), null, 1) + '\n');
    console.log('UCDP_TOKEN not set; wrote an unavailable placeholder so the layer stays hidden.');
    return;
  }
  let result;
  try {
    result = await fetchYear(token, version, year);
  } catch (err) {
    if (existsSync(OUT)) {
      console.warn(`UCDP fetch failed (${err.message}); keeping the committed file.`);
      return;
    }
    throw err;
  }
  const rows = [...result.counts.values()].sort((a, b) => a.iso.localeCompare(b.iso));
  const fetchedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, JSON.stringify({ source: SOURCE, available: true, fetchedAt, version, from: `${year}-01-01`, to: `${year}-12-31`, rows, unmapped: result.unmapped }, null, 1) + '\n');
  console.log(`wrote ${rows.length} countries from ${result.total} events in ${year} (GED ${version}) -> ${OUT}`);
  if (result.unmapped.length) console.warn(`unmapped GED country names: ${result.unmapped.join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
