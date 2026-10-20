// Builds src/data/us-states.generated.json: who governs each US state and how
// its delegations and legislature split by party.
//
//   governors      Wikipedia "List of current United States governors" (the
//                  DC row is the mayor), edited within hours of a change
//   Congress       unitedstates/congress-legislators legislators-current.json,
//                  the public-domain roster GovTrack and others maintain
//   legislatures   Open States (Plural Policy) current-people CSV per state:
//                  one row per sitting legislator, so vacancies drop out
//
// Each source falls back to the committed file on its own, so one outage
// never blanks the others. The weekly refresh runs this and opens a pull
// request, so every change is reviewed in a diff.
//
//   node scripts/build-us-states.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTags } from './build-elections.mjs';
import { wikiTitle } from './build-leaders.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/us-states.generated.json');
const UA = 'ATLAS data build (https://github.com/Skydog7169/ATLAS)';
const GOVERNORS_URL = 'https://en.wikipedia.org/wiki/List_of_current_United_States_governors';
const CONGRESS_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const OPENSTATES_URL = (code) => `https://data.openstates.org/people/current/${code.toLowerCase()}.csv`;

/** Postal code, FIPS code (the us-atlas feature id), name. */
export const STATES = [
  ['AL', '01', 'Alabama'], ['AK', '02', 'Alaska'], ['AZ', '04', 'Arizona'], ['AR', '05', 'Arkansas'], ['CA', '06', 'California'], ['CO', '08', 'Colorado'],
  ['CT', '09', 'Connecticut'], ['DE', '10', 'Delaware'], ['DC', '11', 'District of Columbia'], ['FL', '12', 'Florida'], ['GA', '13', 'Georgia'], ['HI', '15', 'Hawaii'],
  ['ID', '16', 'Idaho'], ['IL', '17', 'Illinois'], ['IN', '18', 'Indiana'], ['IA', '19', 'Iowa'], ['KS', '20', 'Kansas'], ['KY', '21', 'Kentucky'],
  ['LA', '22', 'Louisiana'], ['ME', '23', 'Maine'], ['MD', '24', 'Maryland'], ['MA', '25', 'Massachusetts'], ['MI', '26', 'Michigan'], ['MN', '27', 'Minnesota'],
  ['MS', '28', 'Mississippi'], ['MO', '29', 'Missouri'], ['MT', '30', 'Montana'], ['NE', '31', 'Nebraska'], ['NV', '32', 'Nevada'], ['NH', '33', 'New Hampshire'],
  ['NJ', '34', 'New Jersey'], ['NM', '35', 'New Mexico'], ['NY', '36', 'New York'], ['NC', '37', 'North Carolina'], ['ND', '38', 'North Dakota'], ['OH', '39', 'Ohio'],
  ['OK', '40', 'Oklahoma'], ['OR', '41', 'Oregon'], ['PA', '42', 'Pennsylvania'], ['RI', '44', 'Rhode Island'], ['SC', '45', 'South Carolina'], ['SD', '46', 'South Dakota'],
  ['TN', '47', 'Tennessee'], ['TX', '48', 'Texas'], ['UT', '49', 'Utah'], ['VT', '50', 'Vermont'], ['VA', '51', 'Virginia'], ['WA', '53', 'Washington'],
  ['WV', '54', 'West Virginia'], ['WI', '55', 'Wisconsin'], ['WY', '56', 'Wyoming'],
];
const BY_NAME = new Map(STATES.map(([code, , name]) => [name.toLowerCase(), code]));

/** House seats per state from the 2020 apportionment (435 in all; DC's delegate does not vote). */
export const HOUSE_SEATS = {
  AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, DC: 1, FL: 28, GA: 14, HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8, MA: 9, MI: 13,
  MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12, NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7, SD: 1, TN: 9, TX: 38, UT: 4, VT: 1,
  VA: 11, WA: 10, WV: 2, WI: 8, WY: 1,
};

/** Lower chambers not called the House of Representatives. Nebraska has one chamber. */
const LOWER_NAME = { CA: 'Assembly', NV: 'Assembly', NY: 'Assembly', WI: 'Assembly', NJ: 'General Assembly', MD: 'House of Delegates', VA: 'House of Delegates', WV: 'House of Delegates' };

/**
 * Chambers run by a bipartisan majority coalition or a power-sharing deal,
 * where the seat count alone would name the wrong party in control. Curated;
 * check after each election.
 */
export const COALITIONS = {
  AK: { chambers: { upper: 'coalition', lower: 'coalition' }, note: 'Both chambers are run by bipartisan majority coalitions of Democrats, independents and moderate Republicans.', source: { name: 'Ballotpedia: Alaska State Legislature', url: 'https://ballotpedia.org/Alaska_State_Legislature' } },
  MN: { chambers: { lower: 'shared' }, note: 'The House runs under a 2025–26 power-sharing agreement after the parties tied 67–67: a Republican speaker and co-chaired committees.', source: { name: 'Ballotpedia: Minnesota House of Representatives', url: 'https://ballotpedia.org/Minnesota_House_of_Representatives' } },
};

/** "Democratic", "Democratic-Farmer-Labor", "Democratic/Progressive" → D; "Republican" → R; anything else → O. */
export function partyCode(label) {
  if (/^democrat/i.test(label) || /farmer.labor/i.test(label)) return 'D';
  if (/^republican/i.test(label)) return 'R';
  return 'O';
}

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

/** "April 10, 2017" → "2017-04-10". */
export function parseLongDate(text) {
  const m = text.match(/([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!m || !MONTHS[m[1].toLowerCase()]) return null;
  return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** Rows of the states table and the federal-district table: state, governor, party, term start, term end. */
export function parseGovernors(html) {
  const out = new Map();
  for (const table of html.matchAll(/<table class="wikitable[^"]*"[^>]*>(.*?)<\/table>/gs)) {
    for (const tr of table[1].matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gs)) {
      const cells = [...tr[1].matchAll(/<(t[hd])\b([^>]*)>(.*?)(?=<\/t[hd]>)/gs)].map((m) => ({ tag: m[1], attrs: m[2], html: m[3].replace(/<sup\b.*?<\/sup>/gs, '') }));
      const g = cells.findIndex((c) => c.tag === 'th' && /scope="row"/.test(c.attrs));
      if (g < 1) continue;
      const state = stripTags(cells[0].html).replace(/\(list\)/, '').trim();
      const code = BY_NAME.get(state.toLowerCase());
      if (!code) continue;
      const link = [...cells[g].html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)].map((m) => ({ href: m[1], text: stripTags(m[2]), title: wikiTitle(m[1]) })).find((l) => l.title);
      // After the governor: the party colour swatch, the party name, born, prior experience, term start, term end.
      const rest = cells.slice(g + 1).map((c) => stripTags(c.html));
      const party = rest[1] ?? '';
      const since = parseLongDate(rest[4] ?? '');
      const end = (rest[5] ?? '').match(/(\d{4})\s*(?:\(([^)]+)\))?/);
      out.set(code, {
        name: link?.text ?? stripTags(cells[g].html),
        ...(link ? { wiki: link.title.replace(/ /g, '_') } : {}),
        party: partyCode(party),
        partyName: party,
        ...(since ? { since } : {}),
        ...(end ? { termEnds: Number(end[1]) } : {}),
        ...(end?.[2] ? { termNote: end[2] } : {}),
      });
    }
  }
  return out;
}

const PARTY = { Democrat: 'D', Republican: 'R', Independent: 'I' };

/** First day of the person's unbroken run of terms of this type, ending with the current one. */
function serviceStart(terms, type) {
  let start = terms.at(-1).start;
  for (let i = terms.length - 2; i >= 0; i--) {
    // A gap of more than two months (a lost race, a later return) ends the run.
    if (terms[i].type !== type || Date.parse(terms[i + 1].start) - Date.parse(terms[i].end) > 60 * 86400000) break;
    start = terms[i].start;
  }
  return start;
}

/** Senators and House members per state from legislators-current.json. */
export function parseCongress(people) {
  const out = new Map();
  for (const p of people) {
    const t = p.terms.at(-1);
    const row = out.get(t.state) ?? { senators: [], house: [] };
    const name = p.name.official_full ?? `${p.name.first} ${p.name.last}`;
    const party = PARTY[t.party] ?? 'I';
    const base = { name, party, ...(party === 'I' && t.caucus ? { caucus: PARTY[t.caucus] } : {}), ...(p.id.wikipedia ? { wiki: p.id.wikipedia.replace(/ /g, '_') } : {}) };
    if (t.type === 'sen') {
      const special = t['end-type'] === 'special-election';
      row.senators.push({
        ...base,
        class: t.class,
        since: serviceStart(p.terms, 'sen'),
        // A full term ends on 3 January after the November election; a special election falls on the term's end date.
        nextElection: special ? Number(t.end.slice(0, 4)) : Number(t.end.slice(0, 4)) - 1,
        ...(special ? { special: true } : {}),
        ...(t.how === 'appointment' ? { appointed: true } : {}),
        ...(t.url ? { url: t.url } : {}),
      });
    } else {
      row.house.push({ ...base, district: t.district });
    }
    out.set(t.state, row);
  }
  for (const r of out.values()) {
    r.senators.sort((a, b) => a.class - b.class);
    r.house.sort((a, b) => a.district - b.district);
  }
  return out;
}

/** Seats held by party per chamber from an Open States current-people CSV. */
export function parseOpenStates(csv) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = splitCsv(lines[0] ?? '');
  const ci = header.indexOf('current_chamber');
  const pi = header.indexOf('current_party');
  const chambers = {};
  for (const line of lines.slice(1)) {
    const cells = splitCsv(line);
    const chamber = cells[ci];
    if (!chamber) continue;
    const c = (chambers[chamber] ??= { D: 0, R: 0, O: 0 });
    c[partyCode(cells[pi] ?? '')] += 1;
  }
  return chambers;
}

function splitCsv(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * The larger party runs the chamber (with independents it may hold a
 * plurality rather than a majority, as in Maine's House), unless a curated
 * coalition says otherwise.
 */
export function control(counts, override = null) {
  if (override) return override;
  if (counts.D > counts.R) return 'D';
  if (counts.R > counts.D) return 'R';
  return 'tied';
}

export function buildLegislature(code, chambers) {
  const coalition = COALITIONS[code];
  if (chambers.legislature) {
    // Nebraska: one officially nonpartisan chamber; Open States records no party.
    return { unicameral: true, chambers: [{ id: 'legislature', name: 'Legislature', ...chambers.legislature, control: 'nonpartisan' }] };
  }
  const out = [];
  if (chambers.upper) out.push({ id: 'upper', name: 'Senate', ...chambers.upper, control: control(chambers.upper, coalition?.chambers.upper) });
  if (chambers.lower) out.push({ id: 'lower', name: LOWER_NAME[code] ?? 'House of Representatives', ...chambers.lower, control: control(chambers.lower, coalition?.chambers.lower) });
  return { chambers: out, ...(coalition ? { note: coalition.note, noteSource: coalition.source } : {}) };
}

async function get(url, as = 'text') {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return as === 'json' ? res.json() : res.text();
}

async function main() {
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  const prevBy = new Map((prev?.states ?? []).map((s) => [s.code, s]));
  const fetched = {};

  let governors = null;
  try {
    governors = parseGovernors(await get(GOVERNORS_URL));
    if (governors.size < 50) throw new Error(`parsed only ${governors.size} governors; page layout changed?`);
    fetched.governors = true;
  } catch (err) {
    console.warn(`Governors: ${err.message}; keeping the committed rows.`);
  }

  let congress = null;
  try {
    congress = parseCongress(await get(CONGRESS_URL, 'json'));
    const senators = [...congress.values()].reduce((n, r) => n + r.senators.length, 0);
    if (senators < 95) throw new Error(`only ${senators} senators; roster changed shape?`);
    fetched.congress = true;
  } catch (err) {
    console.warn(`Congress: ${err.message}; keeping the committed rows.`);
  }

  const legislatures = new Map();
  for (let i = 0; i < STATES.length; i += 6) {
    await Promise.all(
      STATES.slice(i, i + 6)
        .filter(([code]) => code !== 'DC')
        .map(async ([code]) => {
          try {
            const chambers = parseOpenStates(await get(OPENSTATES_URL(code)));
            if (!Object.keys(chambers).length) throw new Error('no legislators');
            legislatures.set(code, buildLegislature(code, chambers));
          } catch (err) {
            console.warn(`Open States ${code}: ${err.message}; keeping the committed row.`);
          }
        }),
    );
  }
  if (legislatures.size) fetched.legislatures = true;
  if (!Object.keys(fetched).length) {
    if (prev) return console.warn('Every source failed; keeping the committed file.');
    throw new Error('Every source failed and there is no committed file.');
  }

  const states = STATES.map(([code, fips, name]) => {
    const old = prevBy.get(code) ?? {};
    const cong = congress?.get(code);
    return {
      code,
      fips,
      name,
      governor: governors?.get(code) ?? old.governor ?? null,
      senators: cong ? cong.senators : (old.senators ?? []),
      houseSeats: HOUSE_SEATS[code],
      house: cong ? cong.house : (old.house ?? []),
      legislature: code === 'DC' ? null : (legislatures.get(code) ?? old.legislature ?? null),
    };
  });
  const missing = states.filter((s) => !s.governor).map((s) => s.code);
  if (missing.length) console.warn(`No governor for: ${missing.join(', ')}`);

  if (prev && JSON.stringify(prev.states) === JSON.stringify(states)) {
    console.log('US states data unchanged');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const out = {
    sources: [
      { id: 'governors', name: 'Wikipedia: List of current United States governors', url: GOVERNORS_URL },
      { id: 'congress', name: 'congress-legislators (unitedstates project)', url: 'https://github.com/unitedstates/congress-legislators' },
      { id: 'legislatures', name: 'Open States (Plural Policy)', url: 'https://open.pluralpolicy.com/data/' },
    ],
    fetchedAt: today,
    // A source that failed this run keeps the date its rows were last refreshed.
    sourceDates: Object.fromEntries(['governors', 'congress', 'legislatures'].map((k) => [k, fetched[k] ? today : (prev?.sourceDates?.[k] ?? today)])),
    states,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${states.length} states -> ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
