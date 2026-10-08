// Builds src/data/sanctions.generated.json: which countries are the target of
// a country-level sanctions regime, by authority.
//
//   US  — OFAC's programme index (country programmes only; thematic programmes
//         such as counter-terrorism or Magnitsky target people, not countries)
//   EU  — the EU Sanctions Map API, which also flags regimes adopted by the UN
//   UN  — Security Council regimes, curated below and cross-checked against
//         the EU map's "adopted by UN" flag
//
// Refreshed by the weekly workflow; the committed file is the fallback when a
// source is unreachable. Unknown OFAC country programmes are listed under
// `unmapped` so a human can extend the table rather than silently dropping them.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/sanctions.generated.json');
const COUNTRIES = JSON.parse(readFileSync(resolve(here, '../src/data/countries.generated.json'), 'utf8'));
const KNOWN = new Set(COUNTRIES.map((c) => c.cca3));
const ISO2_TO_3 = new Map(COUNTRIES.map((c) => [c.cca2, c.cca3]));
ISO2_TO_3.set('XK', 'UNK');

const OFAC_INDEX = 'https://ofac.treasury.gov/sanctions-programs-and-country-information';
const EU_API = 'https://www.sanctionsmap.eu/api/v1/regime';
const EU_DETAILS = 'https://www.sanctionsmap.eu/#/main/details/';

/** OFAC programme slug → the countries it targets. Thematic programmes are deliberately absent. */
const OFAC_SLUG_TO_ISO = {
  'afghanistan-related-sanctions': ['AFG'],
  'balkans-related-sanctions': ['BIH', 'SRB', 'MKD', 'MNE', 'ALB', 'UNK'],
  'belarus-sanctions': ['BLR'],
  burma: ['MMR'],
  'central-african-republic-sanctions': ['CAF'],
  'chinese-military-companies-sanctions': ['CHN'],
  'cuba-sanctions': ['CUB'],
  'democratic-republic-of-the-congo-related-sanctions': ['COD'],
  'ethiopia-related-sanctions': ['ETH'],
  'hong-kong-related-sanctions': ['HKG'],
  'iran-sanctions': ['IRN'],
  'iraq-related-sanctions': ['IRQ'],
  'lebanon-related-sanctions': ['LBN'],
  'libya-sanctions': ['LBY'],
  'mali-related-sanctions': ['MLI'],
  'nicaragua-related-sanctions': ['NIC'],
  'north-korea-sanctions': ['PRK'],
  paarss: ['SYR'],
  'syria-sanctions': ['SYR'],
  'russia-related-sanctions': ['RUS'],
  'russian-harmful-foreign-activities-sanctions': ['RUS'],
  'ukraine-russia-related-sanctions': ['RUS'],
  'somalia-sanctions': ['SOM'],
  'south-sudan-related-sanctions': ['SSD'],
  'sudan-and-darfur-sanctions': ['SDN'],
  'venezuela-related-sanctions': ['VEN'],
  'yemen-related-sanctions': ['YEM'],
  'zimbabwe-sanctions': ['ZWE'],
};
/** Slugs that are thematic (persons and entities, not a country) and so are expected to go unmapped. */
const OFAC_THEMATIC = /counter-|cyber|magnitsky|narcotics|non-proliferation|rough-diamond|transnational|criminal-court|hostages|foreign-interference|adversaries|where-is-ofac|terrorism/;

/** UN Security Council regimes in force, by committee resolution. Source: https://main.un.org/securitycouncil/en/sanctions/information */
const UN_REGIMES = [
  { iso: 'SOM', name: 'Somalia (res. 751)', url: 'https://main.un.org/securitycouncil/en/sanctions/751' },
  { iso: 'IRQ', name: 'Iraq (res. 1518)', url: 'https://main.un.org/securitycouncil/en/sanctions/1518' },
  { iso: 'COD', name: 'Democratic Republic of the Congo (res. 1533)', url: 'https://main.un.org/securitycouncil/en/sanctions/1533' },
  { iso: 'SDN', name: 'Sudan (res. 1591)', url: 'https://main.un.org/securitycouncil/en/sanctions/1591' },
  { iso: 'LBN', name: 'Lebanon (res. 1636)', url: 'https://main.un.org/securitycouncil/en/sanctions/1636' },
  { iso: 'PRK', name: 'DPRK (res. 1718)', url: 'https://main.un.org/securitycouncil/en/sanctions/1718' },
  { iso: 'IRN', name: 'Iran (res. 1737, restored by snapback in September 2025)', url: 'https://main.un.org/securitycouncil/en/sanctions/1737' },
  { iso: 'LBY', name: 'Libya (res. 1970)', url: 'https://main.un.org/securitycouncil/en/sanctions/1970' },
  { iso: 'AFG', name: 'Taliban (res. 1988)', url: 'https://main.un.org/securitycouncil/en/sanctions/1988' },
  { iso: 'GNB', name: 'Guinea-Bissau (res. 2048)', url: 'https://main.un.org/securitycouncil/en/sanctions/2048' },
  { iso: 'CAF', name: 'Central African Republic (res. 2127)', url: 'https://main.un.org/securitycouncil/en/sanctions/2127' },
  { iso: 'YEM', name: 'Yemen (res. 2140)', url: 'https://main.un.org/securitycouncil/en/sanctions/2140' },
  { iso: 'SSD', name: 'South Sudan (res. 2206)', url: 'https://main.un.org/securitycouncil/en/sanctions/2206' },
  { iso: 'HTI', name: 'Haiti (res. 2653)', url: 'https://main.un.org/securitycouncil/en/sanctions/2653' },
];

async function get(url, as = 'text') {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'ATLAS data build (https://github.com/Skydog7169/ATLAS)' } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

async function ofac() {
  const html = await get(OFAC_INDEX);
  const seen = new Map(); // slug -> title
  for (const m of html.matchAll(/href="\/sanctions-programs-and-country-information\/([a-z0-9-]+)"[^>]*>(.*?)<\/a>/gs)) {
    const slug = m[1];
    const title = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/[\u200b\u00a0]/g, '').trim();
    if (!seen.has(slug) && title) seen.set(slug, title);
  }
  if (seen.size < 10) throw new Error('OFAC index parsed to fewer than 10 programmes; page layout changed?');
  const regimes = [];
  const unmapped = [];
  for (const [slug, title] of seen) {
    const isos = OFAC_SLUG_TO_ISO[slug];
    if (isos) for (const iso of isos) regimes.push({ iso, authority: 'US', name: title, url: `${OFAC_INDEX}/${slug}` });
    else if (!OFAC_THEMATIC.test(slug)) unmapped.push(slug);
  }
  return { regimes, unmapped };
}

async function eu() {
  const { data } = await get(EU_API, 'json');
  const regimes = [];
  const unAdopted = new Set();
  for (const r of data) {
    const code = r.country?.data?.code;
    if (!code) continue; // thematic regime
    const spec = String(r.specification ?? '');
    // Claim-blocking and blocking-statute measures protect EU operators, and asset freezes on former
    // officials for misappropriation target individuals; neither sanctions the country.
    if (/^(Prohibiting the satisfying|Measures protecting|Misappropriation of state funds)/i.test(spec)) continue;
    const iso = ISO2_TO_3.get(code);
    if (!iso) continue;
    const by = r.adopted_by?.data?.title ?? 'EU';
    if (/UN/.test(by)) unAdopted.add(iso);
    if (/EU/.test(by)) regimes.push({ iso, authority: 'EU', name: spec.replace(/^Restrictive measures /, 'Restrictive measures '), url: `${EU_DETAILS}${r.id}/` });
  }
  if (regimes.length < 20) throw new Error('EU sanctions map returned fewer than 20 country regimes; API changed?');
  return { regimes, unAdopted };
}

async function main() {
  let us;
  let euRows;
  try {
    [us, euRows] = await Promise.all([ofac(), eu()]);
  } catch (err) {
    if (existsSync(OUT)) {
      console.warn(`Sanctions fetch failed (${err.message}); keeping the committed file.`);
      return;
    }
    throw err;
  }
  const un = UN_REGIMES.map((r) => ({ ...r, authority: 'UN' }));
  // UN regimes the EU map flags that our curated list lacks: surface for review rather than guess.
  const unCurated = new Set(un.map((r) => r.iso));
  const unReview = [...euRows.unAdopted].filter((iso) => !unCurated.has(iso)).sort();

  const byIso = new Map();
  for (const r of [...us.regimes, ...euRows.regimes, ...un]) {
    if (!KNOWN.has(r.iso)) continue;
    if (!byIso.has(r.iso)) byIso.set(r.iso, []);
    byIso.get(r.iso).push({ authority: r.authority, name: r.name, url: r.url });
  }
  const order = { UN: 0, US: 1, EU: 2 };
  const rows = [...byIso]
    .map(([iso, regimes]) => ({ iso, regimes: regimes.sort((a, b) => order[a.authority] - order[b.authority] || a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  if (prev && JSON.stringify(prev.rows) === JSON.stringify(rows) && JSON.stringify(prev.unmapped) === JSON.stringify(us.unmapped)) {
    console.log('sanctions data unchanged');
    return;
  }
  const file = {
    sources: [
      { name: 'OFAC sanctions programmes', url: OFAC_INDEX },
      { name: 'EU Sanctions Map', url: 'https://www.sanctionsmap.eu/' },
      { name: 'UN Security Council sanctions', url: 'https://main.un.org/securitycouncil/en/sanctions/information' },
    ],
    fetchedAt: new Date().toISOString().slice(0, 10),
    unmapped: us.unmapped.sort(),
    unReview,
    rows,
  };
  writeFileSync(OUT, JSON.stringify(file, null, 1) + '\n');
  console.log(`wrote ${rows.length} countries (${us.regimes.length} US, ${euRows.regimes.length} EU, ${un.length} UN regimes) -> ${OUT}`);
  if (us.unmapped.length) console.warn(`OFAC programmes not in the table (add to OFAC_SLUG_TO_ISO if country-level): ${us.unmapped.join(', ')}`);
  if (unReview.length) console.warn(`EU map flags UN-adopted measures for ${unReview.join(', ')} that the curated UN list lacks; review.`);
}
await main();
