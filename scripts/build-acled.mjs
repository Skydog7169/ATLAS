// Pulls recent political-violence event and fatality counts per country from
// the ACLED API into src/data/acled.generated.json. ACLED requires a free
// myACLED account; without the ACLED_EMAIL and ACLED_PASSWORD secrets this
// script writes an "unavailable" file and exits 0, and the app hides the
// layer. The committed file is the fallback when the API is unreachable.
//
//   ACLED_EMAIL=... ACLED_PASSWORD=... node scripts/build-acled.mjs [--days 30]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/acled.generated.json');
const COUNTRIES = JSON.parse(readFileSync(resolve(here, '../src/data/countries.generated.json'), 'utf8'));
const KNOWN = new Set(COUNTRIES.map((c) => c.cca3));
const TOKEN_URL = 'https://acleddata.com/oauth/token';
const READ_URL = 'https://acleddata.com/api/acled/read';
const SOURCE = { name: 'ACLED', url: 'https://acleddata.com/' };
const PAGE = 5000;

function unavailable(reason) {
  return { source: SOURCE, available: false, reason, fetchedAt: new Date().toISOString().slice(0, 10), days: 0, from: null, to: null, rows: [] };
}

async function token(email, password) {
  const body = new URLSearchParams({ username: email, password, grant_type: 'password', client_id: 'acled', scope: 'authenticated' });
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`ACLED token: ${res.status}`);
  const json = await res.json();
  if (!json.access_token) throw new Error('ACLED token: no access_token in response');
  return json.access_token;
}

/** Aggregates one page of events into per-country counts. Exported for tests. */
export function aggregate(rows, into = new Map()) {
  for (const r of rows) {
    const iso = r.iso3 ?? r.iso;
    if (!iso || !KNOWN.has(iso)) continue;
    const cur = into.get(iso) ?? { iso, events: 0, fatalities: 0 };
    cur.events += 1;
    cur.fatalities += Number(r.fatalities) || 0;
    into.set(iso, cur);
  }
  return into;
}

async function fetchWindow(accessToken, from, to) {
  const counts = new Map();
  let total = 0;
  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({
      _format: 'json',
      event_date: `${from}|${to}`,
      event_date_where: 'BETWEEN',
      fields: 'event_id_cnty|event_date|event_type|iso3|fatalities',
      limit: String(PAGE),
      page: String(page),
    });
    const res = await fetch(`${READ_URL}?${params}`, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`ACLED read: ${res.status}`);
    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    aggregate(data, counts);
    total += data.length;
    if (data.length < PAGE) break;
  }
  return { counts, total };
}

async function main() {
  const argv = process.argv.slice(2);
  const days = argv.includes('--days') ? Number(argv[argv.indexOf('--days') + 1]) : 30;
  const email = process.env.ACLED_EMAIL;
  const password = process.env.ACLED_PASSWORD;
  if (!email || !password) {
    const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
    if (prev?.available) {
      console.warn('ACLED credentials not set; keeping the committed file.');
      return;
    }
    writeFileSync(OUT, JSON.stringify(unavailable('ACLED_EMAIL and ACLED_PASSWORD secrets are not set'), null, 1) + '\n');
    console.log('ACLED credentials not set; wrote an unavailable placeholder so the layer stays hidden.');
    return;
  }
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  let result;
  try {
    result = await fetchWindow(await token(email, password), from, to);
  } catch (err) {
    if (existsSync(OUT)) {
      console.warn(`ACLED fetch failed (${err.message}); keeping the committed file.`);
      return;
    }
    throw err;
  }
  const rows = [...result.counts.values()].sort((a, b) => a.iso.localeCompare(b.iso));
  writeFileSync(OUT, JSON.stringify({ source: SOURCE, available: true, fetchedAt: to, days, from, to, rows }, null, 1) + '\n');
  console.log(`wrote ${rows.length} countries from ${result.total} events (${from} to ${to}) -> ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
