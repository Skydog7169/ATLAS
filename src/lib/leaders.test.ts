import { describe, expect, it } from 'vitest';
import { infoKey, parsePage, toRows, wikiTitle } from '../../scripts/build-leaders.mjs';
import { COUNTRY_BY_ISO } from './countries';
import { countryDossier } from './dossier';
import { LEADERS, LEADERS_BY_ISO, TENURE_BINS, TENURE_COLORS, leaderSummary, leadersDossier, powerOffice, tenureBin, tenureBinLabel, tenureLabel, wikiUrl, yearsSince } from './leaders';
import { search } from './search';

const NOW = new Date('2026-10-20T00:00:00Z');

const td = (html: string, attrs = '') => `<td${attrs}>${html}\n</td>`;
const green = ' style="background: #9EFF9E; color:black;" class="table-success"';
const blue = ' style="background: #CEF; color:black;" class="table-success"';
const a = (title: string, text = title) => `<a href="/wiki/${title.replace(/ /g, '_')}" title="${title}">${text}</a>`;
const FIXTURE = `
<table class="wikitable sortable"><tbody>
<tr><th>State</th><th>Head of state</th><th>Head of government</th></tr>
<tr><th scope="row">${a('Albania')}</th>${td(`${a('President of Albania', 'President')} – ${a('Bajram Begaj')}`)}${td(`${a('Prime Minister of Albania', 'Prime Minister')} – ${a('Edi Rama')}`, green)}</tr>
<tr><th scope="row">${a('United States')}</th>${td(`${a('President of the United States', 'President')} – ${a('Donald Trump')}<sup>[a]</sup>`, ` colspan="2"${green}`)}</tr>
<tr><th scope="row" rowspan="2">${a('Switzerland')}</th>${td(a('Federal Council (Switzerland)', 'Federal Council'), ` colspan="2"${green}`)}</tr>
<tr>${td(`<ul><li>${a('Guy Parmelin')} (${a('President of the Swiss Confederation', 'President')})</li><li>${a('Beat Jans')}</li></ul>`, ' colspan="2"')}</tr>
<tr><th scope="row" rowspan="2">${a('Haiti')}</th>${td(`${a('President of Haiti', 'President')} – <i>Vacant</i>`, green)}${td(`<span style="font-size: 85%;">Acting ${a('Prime Minister of Haiti', 'Prime Minister')} – ${a('Alix Didier Fils-Aimé')}</span>`, ` rowspan="2"${blue}`)}</tr>
<tr>${td(`<span style="font-size: 85%;">${a('Laurent Saint-Cyr')} (Coordinator)</span>`)}</tr>
<tr><th scope="row" rowspan="2">${a('China')}</th>${td(`${a('General Secretary of the Chinese Communist Party', 'General Secretary of the Communist Party')} – ${a('Xi Jinping')}`, ` colspan="2"${blue}`)}</tr>
<tr>${td(`${a('President of China', 'President')} – Xi Jinping`)}${td(`${a('Premier of China', 'Premier')} – ${a('Li Qiang')}`, green)}</tr>
</tbody></table>
<table class="wikitable"><tbody>
<tr><th>State</th><th>Also claimed by</th><th>Head of state</th><th>Head of government</th></tr>
<tr><th scope="row">${a('Taiwan')}</th>${td(a('China'))}${td(`${a('President of Taiwan', 'President')} – ${a('Lai Ching-te')}`, green)}${td(`${a('Premier of Taiwan', 'Premier')} – ${a('Cho Jung-tai')}`)}</tr>
</tbody></table>
<table class="wikitable"><tbody>
<tr><th>Government</th><th>State</th><th>Head of state</th><th>Head of government</th></tr>
<tr><th scope="row">${a('Coordination Council (Belarus)')}</th><th scope="row">${a('Belarus')}</th>${td('Leader – Someone')}${td('PM – Other')}</tr>
</tbody></table>`;

describe('leaders build: parsing the Wikipedia list', () => {
  const states = parsePage(FIXTURE);
  const by = new Map(states.map((s) => [s.iso, s]));

  it('reads three- and four-column tables and skips alternative governments', () => {
    expect(states.map((s) => s.iso)).toEqual(['ALB', 'USA', 'CHE', 'HTI', 'CHN', 'TWN']);
  });

  it('maps columns to roles, colspan to both, and the green or blue cell to power', () => {
    const alb = by.get('ALB')!.entries;
    expect(alb.map((e) => [e.role, e.title, e.people[0]?.name, e.power])).toEqual([
      ['state', 'President', 'Bajram Begaj', null],
      ['government', 'Prime Minister', 'Edi Rama', 'executive'],
    ]);
    expect(by.get('USA')!.entries[0]).toMatchObject({ role: 'both', title: 'President', office: 'President of the United States', power: 'executive' });
    expect(by.get('TWN')!.entries.map((e) => e.role)).toEqual(['state', 'government']);
  });

  it('fills a collective body from the member list under it', () => {
    const fc = by.get('CHE')!.entries[0]!;
    expect(fc).toMatchObject({ title: 'Federal Council', collective: true, role: 'both' });
    expect(fc.people.map((p) => [p.name, p.role])).toEqual([
      ['Guy Parmelin', 'President'],
      ['Beat Jans', null],
    ]);
  });

  it('keeps rowspans in their column, marks vacancies, acting holders and "Name (Office)" cells', () => {
    const hti = by.get('HTI')!.entries;
    expect(hti[0]).toMatchObject({ role: 'state', vacant: true, people: [] });
    expect(hti[1]).toMatchObject({ role: 'government', title: 'Acting Prime Minister', acting: true, power: 'de-facto' });
    expect(hti[2]).toMatchObject({ role: 'state', title: 'Coordinator', collective: false, people: [{ name: 'Laurent Saint-Cyr' }] });
  });

  it('reuses the link for a person named twice', () => {
    const chn = by.get('CHN')!.entries;
    expect(chn[1]!.people[0]).toMatchObject({ name: 'Xi Jinping', wiki: 'Xi Jinping' });
  });

  it('merges Wikidata dates by person and office, with the country statement as a fallback', () => {
    const info = new Map([[infoKey('Edi Rama', 'Prime Minister of Albania'), { since: '2013-09-15', party: 'Socialist Party of Albania' }]]);
    const starts = new Map([['Bajram Begaj', { state: '2022-07-24' }]]);
    const rows = toRows(states, info, starts) as Array<{ iso: string; offices: Array<{ people: Array<{ since?: string; party?: string; wiki?: string }> }> }>;
    const alb = rows.find((r) => r.iso === 'ALB')!;
    expect(alb.offices[1]!.people[0]).toMatchObject({ since: '2013-09-15', party: 'Socialist Party of Albania', wiki: 'Edi_Rama' });
    expect(alb.offices[0]!.people[0]!.since).toBe('2022-07-24');
  });

  it('turns article links into titles', () => {
    expect(wikiTitle('/wiki/Josep-Llu%C3%ADs_Serrano_Pentinat')).toBe('Josep-Lluís Serrano Pentinat');
    expect(wikiTitle('/w/index.php?title=X&redlink=1')).toBeNull();
  });
});

describe('leaders dataset', () => {
  it('covers almost every state, with known codes and at least one office each', () => {
    expect(LEADERS.rows.length).toBeGreaterThanOrEqual(190);
    for (const r of LEADERS.rows) {
      expect(COUNTRY_BY_ISO.has(r.iso), r.iso).toBe(true);
      expect(r.offices.length, r.iso).toBeGreaterThan(0);
      for (const o of r.offices) for (const p of o.people) if (p.since) expect(p.since, `${r.iso} ${p.name}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(LEADERS.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('names a holder of power for the large powers', () => {
    for (const iso of ['USA', 'CHN', 'RUS', 'IND', 'GBR', 'FRA', 'DEU', 'JPN', 'BRA']) {
      const p = powerOffice(iso);
      expect(p?.person?.name, iso).toBeTruthy();
      expect(p?.office.power, iso).toBeTruthy();
    }
  });

  it('prefers a de facto ruler over the constitutional executive', () => {
    const row = { iso: 'XXX', offices: [{ role: 'government', title: 'Premier', power: 'executive', people: [{ name: 'B' }] }, { role: 'both', title: 'General Secretary', power: 'de-facto', people: [{ name: 'A' }] }] };
    (LEADERS_BY_ISO as Map<string, unknown>).set('XXX', row);
    try {
      expect(powerOffice('XXX')!.person!.name).toBe('A');
    } finally {
      (LEADERS_BY_ISO as Map<string, unknown>).delete('XXX');
    }
  });

  it('bins tenure with a label and a colour for every bin', () => {
    expect(TENURE_COLORS.length).toBe(TENURE_BINS.length + 2);
    expect(tenureBin(null)).toBe(0);
    expect(tenureBin(0.5)).toBe(1);
    expect(tenureBin(3)).toBe(2);
    expect(tenureBin(12)).toBe(4);
    expect(tenureBin(40)).toBe(5);
    expect(TENURE_COLORS.map((_, i) => tenureBinLabel(i))).toEqual(['No start date or collective rule', 'Under 2 years', '2–5 years', '5–10 years', '10–20 years', '20+ years']);
    expect(tenureLabel(yearsSince('2012-05-07', NOW))).toBe('14 years');
    expect(tenureLabel(yearsSince('2026-07-20', NOW))).toBe('3 months');
  });

  it('writes a tooltip line and a Government dossier section with links', () => {
    expect(leaderSummary('USA', NOW)).toMatch(/^President .+ · since .+ \(\d+ years?\)$/);
    const d = leadersDossier('FRA', NOW)!;
    expect(d.id).toBe('leaders');
    expect(d.rows.length).toBeGreaterThanOrEqual(2);
    expect(d.rows.some((r) => /holds power/.test(r.value))).toBe(true);
    expect(d.rows[0]!.href).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
    expect(countryDossier('FRA')!.government).not.toBeNull();
    expect(wikiUrl('Mohammad_Mustafa_(politician)')).toBe('https://en.wikipedia.org/wiki/Mohammad_Mustafa_(politician)');
  });

  it('makes leaders searchable: a name opens the country', () => {
    const anyLeader = powerOffice('DEU')!.person!.name;
    const hit = search(anyLeader).find((h) => h.kind === 'leader');
    expect(hit).toMatchObject({ kind: 'leader', id: 'DEU' });
  });
});
