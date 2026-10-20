import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries';
import { CHANGES_SHOWN, DOSSIER_PROVIDERS, countryDossier, profileLine } from './dossier';

describe('country dossier', () => {
  it('exists for every country with at least four sections', () => {
    for (const c of COUNTRIES) {
      const d = countryDossier(c.cca3);
      expect(d, c.cca3).not.toBeNull();
      expect(d!.sections.length, c.cca3).toBeGreaterThanOrEqual(4);
      expect(d!.sections).toEqual(expect.arrayContaining(['memberships', 'conflicts', 'displacement', 'figures', 'changes']));
      expect(d!.changes.length).toBeLessThanOrEqual(CHANGES_SHOWN);
    }
  });

  it('returns null for an unknown code', () => {
    expect(countryDossier('ZZZ')).toBeNull();
  });

  it('fills in the sections for a country at war', () => {
    const d = countryDossier('SDN')!;
    expect(d.conflicts.map((c) => c.id)).toContain('sudan');
    expect(d.displacement!.total).toBeGreaterThan(1_000_000);
    expect(d.figures!.population).toBeGreaterThan(10_000_000);
    expect(d.changes.length).toBeGreaterThan(0);
    for (const ch of d.changes) {
      if (ch.kind === 'conflict') expect(d.conflicts.some((c) => c.id === ch.id)).toBe(true);
      else expect(ch.iso).toBe('SDN');
    }
    const dates = d.changes.map((c) => c.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('orders conflicts by intensity and memberships follow the bloc order', () => {
    const d = countryDossier('UKR')!;
    const ranks = d.conflicts.map((c) => ({ high: 3, medium: 2, low: 1, latent: 0 })[c.intensity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    expect(countryDossier('FRA')!.memberships.some((m) => m.bloc.id === 'nato')).toBe(true);
  });

  it('registers the unrest, sponsorship, sanctions, elections and nuclear providers in order', () => {
    const irn = countryDossier('IRN')!;
    // ACLED and UCDP sections appear only when their builds had credentials.
    const generated = (id: string) => id === 'acled' || id === 'ucdp';
    expect(irn.extras.map((x) => x.id).filter((id) => !generated(id))).toEqual(['unrest', 'sponsorship', 'sanctions', 'elections', 'nuclear', 'trade']);
    expect(irn.sections.filter((id) => !generated(id)).slice(0, 10)).toEqual(['profile', 'memberships', 'conflicts', 'changes', 'unrest', 'sponsorship', 'sanctions', 'elections', 'nuclear', 'trade']);
    expect(irn.extras.find((x) => x.id === 'sanctions')!.rows.length).toBeGreaterThanOrEqual(3);
    // A country with no nuclear role gets no nuclear section but still an (empty) sanctions one.
    const bra = countryDossier('BRA')!;
    expect(bra.extras.map((x) => x.id)).toEqual(['sanctions', 'elections', 'trade']);
    expect(bra.extras[0]!.rows).toEqual([]);
    expect(bra.extras[0]!.empty).toBeTruthy();
  });

  it('lets later datasets add sections through a provider', () => {
    const before = DOSSIER_PROVIDERS.length;
    DOSSIER_PROVIDERS.push((iso) => (iso === 'IRN' ? { id: 'nuclear', title: 'Test section', rows: [{ label: 'x', value: 'y' }] } : null));
    try {
      expect(countryDossier('IRN')!.extras.some((x) => x.title === 'Test section')).toBe(true);
      expect(countryDossier('FRA')!.extras.some((x) => x.title === 'Test section')).toBe(false);
    } finally {
      DOSSIER_PROVIDERS.splice(before);
    }
  });

  it('writes a readable profile line', () => {
    expect(profileLine(countryDossier('FRA')!.country)).toMatch(/French Republic · Capital: Paris · UN member/);
    expect(profileLine(countryDossier('TWN')!.country)).toMatch(/Taipei/);
  });

  it('states disputed statuses neutrally instead of calling them territories', () => {
    const line = (iso: string) => profileLine(countryDossier(iso)!.country);
    expect(line('TWN')).toMatch(/Self-governing; claimed by the PRC; not a UN member$/);
    expect(line('PSE')).toMatch(/UN non-member observer state$/);
    expect(line('PSE')).toContain('Administrative seat: Ramallah (claims East Jerusalem)');
    expect(line('UNK')).toMatch(/Partially recognised/);
    expect(line('ESH')).toMatch(/^Western Sahara · /);
    expect(line('ESH')).not.toContain('Sahrawi Arab Democratic Republic');
    expect(line('ISR')).toContain('status disputed');
    for (const iso of ['TWN', 'PSE', 'UNK', 'ESH']) expect(line(iso)).not.toMatch(/Territory$/);
    expect(line('PRI')).toMatch(/Territory$/);
  });
});
