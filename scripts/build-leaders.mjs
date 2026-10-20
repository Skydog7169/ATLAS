// Builds src/data/leaders.generated.json: who heads each state and each
// government right now, which of them holds executive power, and since when.
//
// Names, titles and the executive marking come from Wikipedia's "List of
// current heads of state and government", which is edited within hours of a
// change and colours the cell of whoever constitutionally runs the executive
// (green) or runs it de facto (blue). Start dates and parties come from
// Wikidata for the same articles: the "position held" statement for the
// office linked in the cell, and the person's current party. Wikidata is only
// used to enrich, never to name a leader, because its head-of-state
// statements lag the list page. The weekly refresh opens a pull request, so
// every change of leader is reviewed in a diff before it reaches the site; the
// committed file is the fallback when either source is unreachable.
//
//   node scripts/build-leaders.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isoFor, stripTags } from './build-elections.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/leaders.generated.json');
const PAGE = 'List_of_current_heads_of_state_and_government';
const PAGE_URL = `https://en.wikipedia.org/wiki/${PAGE}`;
const API = `https://en.wikipedia.org/w/api.php?action=parse&page=${PAGE}&prop=text&format=json&formatversion=2`;
const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'ATLAS data build (https://github.com/Skydog7169/ATLAS)';
const KNOWN = new Set(JSON.parse(readFileSync(resolve(here, '../src/data/countries.generated.json'), 'utf8')).map((c) => c.cca3));

const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
/** Article links come relative from the API ("/wiki/X") and absolute or "./X" from the page view. */
const normalise = (href) => href.replace(/^https:\/\/en\.wikipedia\.org(?=\/wiki\/)/, '').replace(/^\.\//, '/wiki/');

/** "/wiki/Bajram_Begaj" → "Bajram Begaj"; red links, files and anchors yield null. */
export function wikiTitle(href) {
  const h = href ? normalise(href) : '';
  if (!h.startsWith('/wiki/') || /^\/wiki\/(File|Special|Help|Category):/.test(h)) return null;
  return decode(h.slice(6).split('#')[0]).replace(/_/g, ' ');
}

function attr(tag, name) {
  return (tag.match(new RegExp(`\\b${name}="([^"]*)"`)) ?? [])[1] ?? null;
}

/** Article and red links only: interlanguage "[fr]" links and external links are not people. */
function links(html) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)]
    .map((m) => ({ href: normalise(m[1].replace(/&amp;/g, '&')), text: stripTags(m[2]) }))
    .filter((l) => l.href.startsWith('/wiki/') || /redlink=1/.test(l.href));
}

const STATE_ALIAS = { 'holy see': 'VAT', 'vatican city': 'VAT', 'state of palestine': 'PSE', 'republic of kosovo': 'UNK', 'sahrawi arab democratic republic': 'ESH' };
const resolveIso = (name) => (name ? (STATE_ALIAS[name.toLowerCase()] ?? isoFor(name)) : null);

/**
 * One table cell as an office entry. "President – Name", "Captains Regent –
 * A and B", a collective body with no dash ("Federal Council"), or a member
 * list (<li> items) that belongs to the body above it.
 */
export function parseCell(html) {
  const clean = html.replace(/<sup\b.*?<\/sup>/gs, '').replace(/<link\b[^>]*>/g, '');
  const power = /#9EFF9E/i.test(html) ? 'executive' : /background: ?#CEF\b/i.test(html) ? 'de-facto' : null;
  const acting = /font-size: ?85%/.test(html);
  if (/<li\b/.test(clean)) {
    const members = [...clean.matchAll(/<li\b[^>]*>(.*?)<\/li>/gs)]
      .map((m) => {
        const first = links(m[1])[0];
        const role = (stripTags(m[1]).match(/\((.*)\)\s*$/) ?? [])[1] ?? null;
        const name = first ? first.text : stripTags(m[1]).replace(/\(.*\)\s*$/, '').trim();
        return name ? { name, wiki: wikiTitle(first?.href) ?? null, role, incoming: /<i>/.test(m[1]) } : null;
      })
      .filter(Boolean);
    return { kind: 'members', members, power };
  }
  // Split on the first spaced dash; the office link sits before it, the people after.
  const parts = clean.split(/\s(?:–|&#8211;|&ndash;)\s/);
  // "Name (Office)" with no dash is one named person, not a collective body.
  const named = parts.length === 1 ? stripTags(clean).match(/^(.+?)\s*\((.+)\)$/) : null;
  const firstLink = links(clean)[0];
  if (named && firstLink && firstLink.text === named[1].trim()) {
    return { kind: 'office', title: named[2], office: wikiTitle(links(clean)[1]?.href), people: [{ name: named[1].trim(), wiki: wikiTitle(firstLink.href), incoming: /<i>/.test(clean) }], power, acting, vacant: false, collective: false };
  }
  const head = parts[0] ?? '';
  const tail = parts.slice(1).join(' – ');
  const officeLink = links(head).at(-1);
  const title = stripTags(head).replace(/:$/, '').trim();
  if (!title) return null;
  const people = tail
    ? (() => {
        const ls = links(tail).filter((l) => !/^\/wiki\/(Acting|Interim)/.test(l.href));
        const text = stripTags(tail);
        if (/^vacant\b/i.test(text)) return [];
        if (!ls.length) return text ? [{ name: text, wiki: null, incoming: /<i>/.test(tail) }] : [];
        return ls.map((l) => ({ name: l.text, wiki: wikiTitle(l.href), incoming: new RegExp(`<i>[^]*?${l.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(tail) }));
      })()
    : [];
  return { kind: 'office', title, office: wikiTitle(officeLink?.href), people, power, acting, vacant: Boolean(tail) && people.length === 0, collective: !tail };
}

/**
 * Reads every table whose first column is the state and which has head-of-state
 * and head-of-government columns, resolving rowspan and colspan into roles.
 * Extra columns ("Also claimed by") are tracked for layout and then ignored.
 */
export function parsePage(html) {
  const states = [];
  for (const table of html.matchAll(/<table class="wikitable[^"]*"[^>]*>(.*?)<\/table>/gs)) {
    const header = (table[1].match(/<tr[^>]*>(.*?)<\/tr>/s) ?? [])[1] ?? '';
    const heads = [...header.matchAll(/<th\b[^>]*>(.*?)<\/th>/gs)].map((m) => stripTags(m[1]));
    // Alternative governments (no territory) put "Government" first; sui generis entities put "Entity".
    if (!/^State/.test(heads[0] ?? '')) continue;
    const roleOf = heads.slice(1).map((h) => (/^Head of state/i.test(h) ? 'state' : /^Head of government/i.test(h) ? 'government' : null));
    if (!roleOf.includes('state') || !roleOf.includes('government')) continue;
    const width = roleOf.length;
    let current = null;
    let stateRows = 0;
    let pending = new Array(width).fill(0); // rows each column is still covered by a rowspan from above
    for (const tr of table[1].matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gs)) {
      const cells = [...tr[1].matchAll(/<(t[hd])\b([^>]*)>(.*?)(?=<\/t[hd]>)/gs)].map((m) => ({ tag: m[1], attrs: m[2], html: m[3] }));
      if (!cells.length) continue;
      let i = 0;
      if (cells[0].tag === 'th' && /scope="row"/.test(cells[0].attrs)) {
        // Some rows link the state and its government ("Libya", "Government of National Unity"); the first that resolves wins.
        const ls = links(cells[0].html);
        const hit = ls.map((l) => ({ l, iso: resolveIso(wikiTitle(l.href)) ?? resolveIso(l.text) })).find((x) => x.iso);
        current = { name: wikiTitle(ls[0]?.href) ?? stripTags(cells[0].html), iso: hit?.iso ?? null, entries: [] };
        states.push(current);
        stateRows = Number(attr('<x ' + cells[0].attrs + '>', 'rowspan') ?? 1);
        pending = new Array(width).fill(0);
        i = 1;
      } else if (!current || stateRows <= 0) continue;
      stateRows -= 1;
      const free = pending.map((n, c) => (n <= 0 ? c : -1)).filter((c) => c >= 0);
      pending = pending.map((n) => Math.max(0, n - 1));
      let col = 0;
      for (; i < cells.length; i++) {
        const cell = cells[i];
        const span = Number(attr('<x ' + cell.attrs + '>', 'colspan') ?? 1);
        const rows = Number(attr('<x ' + cell.attrs + '>', 'rowspan') ?? 1);
        const cols = free.slice(col, col + span);
        col += cols.length;
        if (!cols.length) continue;
        for (const c of cols) if (rows > 1) pending[c] = rows - 1;
        const roles = new Set(cols.map((c) => roleOf[c]).filter(Boolean));
        if (!roles.size) continue;
        const entry = parseCell(`<td${cell.attrs}>${cell.html}`);
        if (!entry) continue;
        const role = roles.size === 2 ? 'both' : [...roles][0];
        if (entry.kind === 'members') {
          // A member list fills in the collective body above it in the same column.
          const body = [...current.entries].reverse().find((e) => e.role === role && e.collective);
          if (body) body.people = entry.members;
          continue;
        }
        // The page links a person once; a second office held by the same person reuses that link.
        for (const p of entry.people) if (!p.wiki) p.wiki = current.entries.flatMap((e) => e.people).find((q) => q.name === p.name && q.wiki)?.wiki ?? null;
        current.entries.push({ role, ...entry });
      }
    }
  }
  return states;
}

async function sparql(query) {
  const res = await fetch(SPARQL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/sparql-results+json', 'user-agent': UA },
    body: new URLSearchParams({ query }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  return (await res.json()).results.bindings;
}

const lit = (s) => JSON.stringify(s) + '@en';
/** Dates belong to a person in one office; someone holding two offices has two start dates. */
export const infoKey = (person, office) => `${person}\u0000${office ?? ''}`;

/**
 * For each person article: the start of the current "position held" for the
 * linked office (or any current position whose article matches), and the
 * current party. Returns Map<infoKey(person, office), { since, party }>.
 */
export async function enrich(pairs) {
  const out = new Map();
  for (let i = 0; i < pairs.length; i += 80) {
    const batch = pairs.slice(i, i + 80);
    const values = batch.map((p) => `(${lit(p.person)} ${p.office ? lit(p.office) : 'UNDEF'})`).join(' ');
    const rows = await sparql(`
      SELECT ?title ?officeTitle ?start ?posArticle ?partyLabel ?partyStart ?partyRank WHERE {
        VALUES (?title ?officeTitle) { ${values} }
        ?article schema:about ?person ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
        OPTIONAL {
          ?person p:P39 ?ps . ?ps ps:P39 ?pos ; pq:P580 ?start .
          FILTER NOT EXISTS { ?ps pq:P582 ?end }
          ?ps wikibase:rank ?posRank . FILTER(?posRank != wikibase:DeprecatedRank)
          OPTIONAL { ?posArt schema:about ?pos ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?posArticle . }
        }
        OPTIONAL {
          ?person p:P102 ?pp . ?pp ps:P102 ?party ; wikibase:rank ?partyRank .
          FILTER NOT EXISTS { ?pp pq:P582 ?pend } FILTER(?partyRank != wikibase:DeprecatedRank)
          OPTIONAL { ?pp pq:P580 ?partyStart }
          ?party rdfs:label ?partyLabel . FILTER(LANG(?partyLabel) = "en")
        }
      }`);
    for (const p of batch) {
      const mine = rows.filter((r) => r.title.value === p.person);
      const positions = mine.filter((r) => r.start).map((r) => ({ start: r.start.value.slice(0, 10), article: r.posArticle?.value ?? null }));
      const matched = positions.filter((x) => x.article && p.office && x.article === p.office);
      // Without an exact office match, fall back to a current position whose article names the same title.
      const loose = positions.filter((x) => x.article && p.titleWords && p.titleWords.every((w) => x.article.toLowerCase().includes(w)));
      const since = (matched.length ? matched : loose).map((x) => x.start).sort()[0] ?? null;
      const parties = mine.filter((r) => r.partyLabel).map((r) => ({ label: r.partyLabel.value, start: r.partyStart?.value ?? '', preferred: r.partyRank?.value.endsWith('PreferredRank') }));
      parties.sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.start.localeCompare(a.start));
      out.set(infoKey(p.person, p.office), { since, party: partyName(parties[0]?.label) });
    }
  }
  return out;
}

const partyName = (label) => (!label ? null : /^independent politician$/i.test(label) ? 'Independent' : label);

/**
 * Second chance for a start date: the country's own current "head of state"
 * (P35) or "head of government" (P6) statement naming the person. Returns
 * Map<person article, { state?: date, government?: date }>.
 */
export async function countryStarts() {
  const rows = await sparql(`
    SELECT ?title ?prop ?start WHERE {
      VALUES ?prop { p:P35 p:P6 }
      ?country wdt:P298 ?iso ; ?prop ?st .
      ?st ?ps ?person ; pq:P580 ?start ; wikibase:rank ?rank .
      FILTER(?ps IN (ps:P35, ps:P6)) FILTER(?rank != wikibase:DeprecatedRank)
      FILTER NOT EXISTS { ?st pq:P582 ?end }
      ?article schema:about ?person ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
    }`);
  const out = new Map();
  for (const r of rows) {
    const role = r.prop.value.endsWith('P35') ? 'state' : 'government';
    const cur = out.get(r.title.value) ?? {};
    const start = r.start.value.slice(0, 10);
    if (!cur[role] || start < cur[role]) cur[role] = start;
    out.set(r.title.value, cur);
  }
  return out;
}

const STOP = new Set(['of', 'the', 'and', 'acting', 'interim', 'transitional']);

/** `info` holds Wikidata dates and parties by infoKey; `starts` the country-statement fallback by person. */
export function toRows(states, info = new Map(), starts = new Map()) {
  const rows = [];
  for (const s of states) {
    if (!s.iso || !KNOWN.has(s.iso) || rows.some((r) => r.iso === s.iso)) continue;
    const offices = s.entries.map((e) => ({
      role: e.role,
      title: e.title,
      ...(e.power ? { power: e.power } : {}),
      ...(e.acting ? { acting: true } : {}),
      ...(e.vacant ? { vacant: true } : {}),
      ...(e.collective ? { collective: true } : {}),
      people: e.people.map((p) => {
        const extra = p.wiki ? (info.get(infoKey(p.wiki, e.office)) ?? info.get(infoKey(p.wiki, null))) : null;
        // The country's head-of-state/government statements say nothing about party posts held de facto.
        const fallback = p.wiki && e.power !== 'de-facto' ? starts.get(p.wiki) : null;
        const since = extra?.since ?? (e.role === 'both' ? [fallback?.state, fallback?.government].filter(Boolean).sort()[0] : fallback?.[e.role]) ?? null;
        return {
          name: p.name,
          ...(p.wiki ? { wiki: p.wiki.replace(/ /g, '_') } : {}),
          ...(p.role ? { role: p.role } : {}),
          ...(p.incoming ? { incoming: true } : {}),
          ...(since ? { since } : {}),
          ...(extra?.party ? { party: extra.party } : {}),
        };
      }),
    }));
    if (offices.length) rows.push({ iso: s.iso, offices });
  }
  return rows.sort((a, b) => a.iso.localeCompare(b.iso));
}

/** The parse API, falling back to the article view when the API is rate-limited. */
async function fetchPage() {
  try {
    const res = await fetch(API, { signal: AbortSignal.timeout(60000), headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()).parse.text;
  } catch (err) {
    console.warn(`Parse API failed (${err.message}); reading the article view.`);
    const res = await fetch(PAGE_URL, { signal: AbortSignal.timeout(60000), headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.text();
  }
}

async function main() {
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  let html;
  try {
    html = await fetchPage();
  } catch (err) {
    if (prev) {
      console.warn(`Leaders list fetch failed (${err.message}); keeping the committed file.`);
      return;
    }
    throw err;
  }
  const states = parsePage(html);
  const unresolved = states.filter((s) => !s.iso).map((s) => s.name);
  if (unresolved.length) console.warn(`No ISO code for: ${unresolved.join(', ')}`);
  const base = toRows(states);
  if (base.length < 180) throw new Error(`parsed only ${base.length} states; page layout changed?`);

  // Enrichment is best-effort: a Wikidata outage keeps last week's dates rather than dropping them.
  const pairs = [];
  for (const s of states) for (const e of s.entries) for (const p of e.people) if (p.wiki) pairs.push({ person: p.wiki, office: e.office, titleWords: e.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)) });
  let info = new Map();
  let starts = new Map();
  try {
    info = await enrich(pairs);
    starts = await countryStarts();
  } catch (err) {
    console.warn(`Wikidata enrichment failed (${err.message}); reusing committed dates and parties.`);
    for (const r of prev?.rows ?? []) for (const o of r.offices) for (const p of o.people) if (p.wiki) info.set(infoKey(p.wiki.replace(/_/g, ' '), null), { since: p.since ?? null, party: p.party ?? null });
  }
  const rows = toRows(states, info, starts);
  if (prev && JSON.stringify(prev.rows) === JSON.stringify(rows)) {
    console.log('leaders data unchanged');
    return;
  }
  const out = {
    source: { name: 'Wikipedia: List of current heads of state and government', url: PAGE_URL },
    enrichment: { name: 'Wikidata (position held, member of political party)', url: 'https://www.wikidata.org/' },
    fetchedAt: new Date().toISOString().slice(0, 10),
    rows,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  const dated = rows.flatMap((r) => r.offices.flatMap((o) => o.people)).filter((p) => p.since).length;
  console.log(`wrote ${rows.length} states (${dated} people with a start date) -> ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
