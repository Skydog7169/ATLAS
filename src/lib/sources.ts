import { isHomepage } from '../data/guards';
import type { HistoryEntry, Source } from '../data/types';
import { formatDate } from './labels';

export interface CitedSource {
  url: string;
  outlet: string;
  headline: string | null;
  /** As written in the source name, e.g. "Oct 2026" or "17 Oct 2026". */
  date: string | null;
  /** A front page or tracker index: background, not a citation for the claim. */
  background: boolean;
}

/**
 * Splits a stored source name into outlet, headline and date. Names come in as
 * "Outlet: Headline (Oct 2026)", "Outlet – Headline (17 Oct 2026)" or a bare
 * outlet; the panel renders all of them as "Outlet: Headline (date)".
 */
export function parseSource(s: Source): CitedSource {
  let rest = s.name.trim();
  let date: string | null = null;
  const dated = /\s*\(([^()]*\d{4}[^()]*)\)\s*$/.exec(rest);
  if (dated) {
    date = /^\d{4}-\d{2}(-\d{2})?$/.test(dated[1]!) ? formatDate(dated[1]!) : dated[1]!;
    rest = rest.slice(0, dated.index).trim();
  }
  const split = /^(.{2,60}?)\s*(?::|\s[–—-])\s+(.{4,})$/.exec(rest);
  const outlet = split ? split[1]!.trim() : rest;
  const headline = split ? split[2]!.trim() : null;
  return { url: s.url, outlet, headline, date, background: isHomepage(s.url) };
}

export function sourceLabel(c: CitedSource): string {
  return `${c.outlet}${c.headline ? `: ${c.headline}` : ''}${c.date ? ` (${c.date})` : ''}`;
}

/** Specific citations first, homepages and tracker indexes set aside as background. */
export function splitSources(sources: readonly Source[]): { cited: CitedSource[]; background: CitedSource[] } {
  const parsed = sources.map(parseSource);
  return { cited: parsed.filter((p) => !p.background), background: parsed.filter((p) => p.background) };
}

/**
 * The line under each assessment saying who wrote it and from what. Entries
 * with only background references are the December 2025 baseline summaries.
 */
export function provenanceLine(h: HistoryEntry): string {
  const { cited } = splitSources(h.sources);
  if (cited.length === 0) return 'Baseline summary · general references only';
  const n = `${cited.length} cited source${cited.length === 1 ? '' : 's'}`;
  if (h.drafted === 'editor') return `Editor-written from ${n} · ${formatDate(h.date)}`;
  return `AI-drafted (Claude, web search) from ${n} · approved by an editor · ${formatDate(h.date)}`;
}

/** Compact form for captions: "AI-drafted · 3 sources". */
export function shortProvenance(h: HistoryEntry): string {
  const n = splitSources(h.sources).cited.length;
  if (n === 0) return 'Baseline summary';
  return `${h.drafted === 'editor' ? 'Editor-written' : 'AI-drafted'} · ${n} source${n === 1 ? '' : 's'}`;
}
