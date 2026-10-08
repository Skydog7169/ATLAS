// Seeds and tops up src/data/elections.json: the next national election per
// country. The weekly research pass is the maintained path (it re-checks dated
// entries with web search and cites what it finds); this script bootstraps
// from Wikipedia's "List of next general elections" so every country has a
// row, and only fills gaps: it never overwrites an entry that carries a
// non-bootstrap source. The committed file is the fallback when the fetch fails.
//
//   node scripts/build-elections.mjs [--force]   (--force rewrites bootstrap rows too)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/elections.json');
const COUNTRIES = JSON.parse(readFileSync(resolve(here, '../src/data/countries.generated.json'), 'utf8'));
const LIST_URL = 'https://en.wikipedia.org/wiki/List_of_next_general_elections';
const GUIDE_URL = 'https://www.electionguide.org/elections/';
const BOOTSTRAP_NAME = 'Wikipedia: List of next general elections';
const force = process.argv.includes('--force');

const BY_NAME = new Map();
for (const c of COUNTRIES) {
  BY_NAME.set(c.name.toLowerCase(), c.cca3);
  BY_NAME.set(c.official.toLowerCase(), c.cca3);
}
const ALIAS = {
  'ivory coast': 'CIV', "côte d'ivoire": 'CIV', 'cape verde': 'CPV', 'democratic republic of the congo': 'COD', 'republic of the congo': 'COG', congo: 'COG', eswatini: 'SWZ',
  'são tomé and príncipe': 'STP', 'sao tome and principe': 'STP', 'the gambia': 'GMB', gambia: 'GMB', 'czech republic': 'CZE', czechia: 'CZE', 'north macedonia': 'MKD', 'vatican city': 'VAT',
  'bosnia and herzegovina': 'BIH', 'united states': 'USA', 'united kingdom': 'GBR', russia: 'RUS', 'south korea': 'KOR', 'north korea': 'PRK', taiwan: 'TWN', vietnam: 'VNM', laos: 'LAO',
  syria: 'SYR', iran: 'IRN', palestine: 'PSE', 'east timor': 'TLS', 'timor-leste': 'TLS', brunei: 'BRN', micronesia: 'FSM', 'federated states of micronesia': 'FSM', 'saint kitts and nevis': 'KNA',
  'saint lucia': 'LCA', 'saint vincent and the grenadines': 'VCT', bahamas: 'BHS', 'the bahamas': 'BHS', 'trinidad and tobago': 'TTO', türkiye: 'TUR', turkey: 'TUR', kosovo: 'UNK', moldova: 'MDA',
  bolivia: 'BOL', venezuela: 'VEN', tanzania: 'TZA', myanmar: 'MMR', burma: 'MMR', netherlands: 'NLD', 'the netherlands': 'NLD', philippines: 'PHL', 'marshall islands': 'MHL',
  'solomon islands': 'SLB', maldives: 'MDV', 'sahrawi arab democratic republic': 'ESH', 'western sahara': 'ESH', 'hong kong': 'HKG', macau: 'MAC',
  'united states of america': 'USA', 'russian federation': 'RUS', 'republic of korea': 'KOR', 'viet nam': 'VNM', 'the republic of north macedonia': 'MKD',
};

function isoFor(name) {
  const key = name.toLowerCase().trim();
  return BY_NAME.get(key) ?? ALIAS[key] ?? null;
}
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/**
 * "20 Dec 2026" → { date: '2026-12-20' }, "Jul 2031" → { date: '2031-07' }, "by 2027" → { date: '2027', deadline: true },
 * "Oct 25 2026" → { date: '2026-10-25' }; anything else → null.
 */
export function parseWhen(text) {
  let t = text.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/,/g, '').trim();
  const deadline = /^(by|before|no later than)\s+/i.test(t);
  t = t.replace(/^(by|before|no later than)\s+/i, '');
  const mon = (w) => MONTHS[w.slice(0, 3).toLowerCase()];
  const pad = (n) => String(n).padStart(2, '0');
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (m && mon(m[2])) return { date: `${m[3]}-${pad(mon(m[2]))}-${pad(m[1])}`, deadline };
  m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})\s+(\d{4})$/);
  if (m && mon(m[1])) return { date: `${m[3]}-${pad(mon(m[1]))}-${pad(m[2])}`, deadline };
  m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (m && mon(m[1])) return { date: `${m[2]}-${pad(mon(m[1]))}`, deadline };
  m = t.match(/^(\d{4})$/);
  if (m) return { date: m[1], deadline };
  return null;
}

/** ElectionGuide's "upcoming" listing: national elections in the next few weeks, with exact dates. */
export function parseGuide(html) {
  const out = [];
  for (const tr of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const link = (tr[1].match(/href="(\/elections\/id\/\d+\/?)"/) ?? [])[1];
    const cells = [...tr[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((m) => stripTags(m[1]));
    if (!link || cells.length < 4) continue;
    const [, country, name, when] = cells;
    const iso = isoFor(country);
    const parsed = parseWhen(when.replace(/\(d\)/g, ''));
    if (!iso || !parsed || /referendum|governor|senate|house of representatives|council|assembly of|local|municipal|state|provincial/i.test(name) && !/national assembly|knesset|parliament/i.test(name)) continue;
    out.push({ iso, date: parsed.date, name, url: `https://www.electionguide.org${link}` });
  }
  return out;
}

function stripTags(html) {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/gs, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Rows of the per-continent tables: country, leg term, leg last, leg next, pres term, pres last, pres next, ... */
export function parseList(html) {
  const out = [];
  for (const table of html.matchAll(/<table class="wikitable[^"]*"[^>]*>(.*?)<\/table>/gs)) {
    for (const tr of table[1].matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
      const cells = [...tr[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((m) => ({ text: stripTags(m[1]), link: (m[1].match(/href="(\/wiki\/[^"#]+)"/) ?? [])[1] }));
      if (cells.length < 7 || cells[0].text === 'Country' || !cells[0].text) continue;
      const iso = isoFor(cells[0].text);
      if (!iso) continue;
      out.push({ iso, leg: cells[3], pres: cells[6] });
    }
  }
  return out;
}

/** Earliest future date of the legislative and presidential columns; identical dates mean a general election. */
export function pick(row, today) {
  const leg = parseWhen(row.leg.text);
  const pres = parseWhen(row.pres.text);
  const future = (p) => p && p.date.padEnd(10, 'z') >= today; // "2027" and "2027-03" count as not yet passed
  const cands = [future(leg) && { ...leg, type: 'legislative', link: row.leg.link }, future(pres) && { ...pres, type: 'presidential', link: row.pres.link }].filter(Boolean);
  if (!cands.length) return { date: null, type: 'general', link: null, note: 'No date set' };
  cands.sort((a, b) => a.date.localeCompare(b.date));
  const [first, second] = cands;
  if (second && second.date === first.date) return { ...first, type: 'general', link: first.link ?? second.link };
  return first;
}

async function main() {
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { source: { name: BOOTSTRAP_NAME, url: LIST_URL }, rows: [] };
  let html;
  try {
    const res = await fetch(LIST_URL, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'ATLAS data build (https://github.com/Skydog7169/ATLAS)' } });
    if (!res.ok) throw new Error(`${res.status}`);
    html = await res.text();
  } catch (err) {
    if (prev.rows.length) {
      console.warn(`Election list fetch failed (${err.message}); keeping the committed file.`);
      return;
    }
    throw err;
  }
  const parsed = parseList(html);
  if (parsed.length < 100) throw new Error(`parsed only ${parsed.length} countries; page layout changed?`);
  const today = new Date().toISOString().slice(0, 10);
  // ElectionGuide knows about runoffs and second rounds that the list page has already moved past.
  const guide = new Map();
  try {
    const res = await fetch(GUIDE_URL, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'ATLAS data build (https://github.com/Skydog7169/ATLAS)' } });
    if (res.ok) for (const g of parseGuide(await res.text())) if (g.date >= today && (!guide.has(g.iso) || g.date < guide.get(g.iso).date)) guide.set(g.iso, g);
  } catch (err) {
    console.warn(`ElectionGuide unreachable (${err.message}); bootstrapping from the list page alone.`);
  }
  const byIso = new Map(prev.rows.map((r) => [r.iso, r]));
  let added = 0;
  let replaced = 0;
  for (const row of parsed) {
    const existing = byIso.get(row.iso);
    const bootstrap = !existing || existing.sources.every((s) => s.name === BOOTSTRAP_NAME);
    if (existing && !(force && bootstrap)) continue;
    const p = pick(row, today);
    const sources = [{ name: BOOTSTRAP_NAME, url: LIST_URL }];
    if (p.link) sources.push({ name: 'Wikipedia: election article', url: `https://en.wikipedia.org${p.link}` });
    const g = guide.get(row.iso);
    const entry = { iso: row.iso, date: p.date, type: p.type, ...(p.deadline ? { deadline: true } : {}), ...(p.note ? { note: p.note } : {}), sources, verified: today };
    if (g && (!p.date || g.date < p.date.padEnd(10, 'z'))) {
      entry.date = g.date;
      entry.type = /presiden/i.test(g.name) ? 'presidential' : 'legislative';
      entry.note = g.name;
      delete entry.deadline;
      entry.sources = [{ name: 'IFES ElectionGuide', url: g.url }, { name: BOOTSTRAP_NAME, url: LIST_URL }];
    }
    byIso.set(row.iso, entry);
    if (existing) replaced += 1;
    else added += 1;
  }
  const rows = [...byIso.values()].sort((a, b) => a.iso.localeCompare(b.iso));
  if (!added && !replaced) {
    console.log('elections data unchanged');
    return;
  }
  writeFileSync(OUT, JSON.stringify({ source: prev.source ?? { name: BOOTSTRAP_NAME, url: LIST_URL }, rows }, null, 2) + '\n');
  console.log(`elections: ${added} added, ${replaced} replaced -> ${rows.length} rows`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
