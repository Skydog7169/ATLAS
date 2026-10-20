import { describe, expect, it } from 'vitest';
import { isHomepage } from '../data/guards';
import { parseSource, provenanceLine, shortProvenance, sourceLabel, splitSources } from './sources';

describe('source rendering', () => {
  it('splits outlet, headline and date from the stored name', () => {
    expect(parseSource({ name: 'Al Jazeera: Al-Burhan rejects talks (Oct 2026)', url: 'https://www.aljazeera.com/news/2026/10/1/x' })).toMatchObject({ outlet: 'Al Jazeera', headline: 'Al-Burhan rejects talks', date: 'Oct 2026', background: false });
    expect(parseSource({ name: 'Bloomberg – Saudi Arabia intercepts new Houthi missile attacks on Riyadh (13 Oct 2026)', url: 'https://www.bloomberg.com/news/x' })).toMatchObject({ outlet: 'Bloomberg', headline: 'Saudi Arabia intercepts new Houthi missile attacks on Riyadh', date: '13 Oct 2026' });
    expect(parseSource({ name: 'The National – Lebanon to reject talks (2026-10-19)', url: 'https://www.thenationalnews.com/x' }).date).toBe('19 Oct 2026');
    const bare = parseSource({ name: 'Sudan Tribune', url: 'https://sudantribune.com/article/320162' });
    expect(bare).toMatchObject({ outlet: 'Sudan Tribune', headline: null, date: null });
    expect(sourceLabel(bare)).toBe('Sudan Tribune');
  });

  it('treats front pages and tracker indexes as background references', () => {
    expect(isHomepage('https://acleddata.com/')).toBe(true);
    expect(isHomepage('https://www.cfr.org/global-conflict-tracker')).toBe(true);
    expect(isHomepage('https://www.crisisgroup.org/crisiswatch')).toBe(true);
    expect(isHomepage('https://libyaobserver.ly')).toBe(true);
    expect(isHomepage('https://www.cfr.org/global-conflict-tracker/conflict/instability-venezuela')).toBe(false);
    expect(isHomepage('https://www.reuters.com/world/africa/sudan-2026-10-18/')).toBe(false);
    const { cited, background } = splitSources([
      { name: 'ACLED', url: 'https://acleddata.com/' },
      { name: 'Reuters: Fighting in El Fasher (18 Oct 2026)', url: 'https://www.reuters.com/world/x' },
    ]);
    expect(cited.map((c) => c.outlet)).toEqual(['Reuters']);
    expect(background.map((c) => c.outlet)).toEqual(['ACLED']);
  });

  it('writes the provenance line under each assessment', () => {
    const base = { date: '2026-10-19', intensity: 'high' as const, status: 'x'.repeat(50) };
    const two = [
      { name: 'Reuters: A (19 Oct 2026)', url: 'https://www.reuters.com/a' },
      { name: 'AP: B (18 Oct 2026)', url: 'https://apnews.com/article/b' },
      { name: 'ACLED', url: 'https://acleddata.com/' },
    ];
    expect(provenanceLine({ ...base, sources: two })).toBe('AI-drafted (Claude, web search) from 2 cited sources · approved by an editor · 19 Oct 2026');
    expect(provenanceLine({ ...base, sources: two.slice(0, 1), drafted: 'editor' })).toBe('Editor-written from 1 cited source · 19 Oct 2026');
    expect(provenanceLine({ ...base, sources: two.slice(2) })).toBe('Baseline summary · general references only');
    expect(shortProvenance({ ...base, sources: two })).toBe('AI-drafted · 2 sources');
  });
});
