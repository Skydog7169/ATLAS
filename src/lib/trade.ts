import raw from '../data/trade.generated.json';
import type { DossierExtra } from './dossier';
import { formatDate } from './labels';
import { formatUsd } from './worldbank';

export interface TradeRow {
  iso: string;
  year: number;
  exportsUsd: number;
  /** Shares of goods exports, 0–1. */
  us: number;
  china: number;
  eu: number;
  /** Largest export destinations, share of goods exports, largest first (up to 15). */
  partners?: Array<{ iso: string; share: number }>;
}

interface TradeFile {
  source: { name: string; url: string };
  fetchedAt: string;
  rows: TradeRow[];
}

export const TRADE = raw as TradeFile;
export const TRADE_BY_ISO: ReadonlyMap<string, TradeRow> = new Map(TRADE.rows.map((r) => [r.iso, r]));

export type TradePartner = 'us' | 'china' | 'eu';
export const TRADE_PARTNERS: TradePartner[] = ['us', 'china', 'eu'];
export const TRADE_PARTNER_LABEL: Record<TradePartner, string> = { us: 'United States', china: 'China', eu: 'European Union' };
/** Three categorical hues: US blue, China red, EU gold. */
export const TRADE_COLOR: Record<TradePartner, string> = { us: '#4f8cff', china: '#ff4f5e', eu: '#ffcc4a' };

/** The partner taking the largest share, or null below a floor where the tint would mislead. */
export function leadingPartner(row: TradeRow, floor = 0.1): TradePartner | null {
  let best: TradePartner | null = null;
  for (const p of TRADE_PARTNERS) if (row[p] >= floor && (best === null || row[p] > row[best])) best = p;
  return best;
}

/** Mix the leading partner's hue into the land colour in proportion to its share (10% → faint, 60%+ → full). */
export function tradeColor(iso: string): string {
  const row = TRADE_BY_ISO.get(iso);
  if (!row) return 'var(--land)';
  const lead = leadingPartner(row);
  if (!lead) return 'var(--land-dim)';
  const pct = Math.round(Math.min(1, (row[lead] - 0.1) / 0.5) * 70 + 30);
  return `color-mix(in srgb, ${TRADE_COLOR[lead]} ${pct}%, var(--land))`;
}

/** Share of `from`'s goods exports that go to `to`, or null when `to` is not among its listed partners. */
export function exportShare(from: string, to: string): number | null {
  const row = TRADE_BY_ISO.get(from);
  if (!row?.partners) return null;
  return row.partners.find((p) => p.iso === to)?.share ?? null;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function tradeSummary(iso: string): string | null {
  const row = TRADE_BY_ISO.get(iso);
  if (!row) return null;
  return `Exports ${row.year}: US ${pct(row.us)} · China ${pct(row.china)} · EU ${pct(row.eu)}`;
}

export function tradeDossier(iso: string): DossierExtra | null {
  const row = TRADE_BY_ISO.get(iso);
  if (!row) return null;
  const lead = leadingPartner(row, 0);
  return {
    id: 'trade',
    title: `Export dependence · ${row.year}`,
    rows: TRADE_PARTNERS.map((p) => ({ label: TRADE_PARTNER_LABEL[p], value: pct(row[p]), note: p === lead ? 'Largest of the three' : undefined })),
    footnote: `Share of ${formatUsd(row.exportsUsd)} goods exports in ${row.year}. ${TRADE.source.name}, fetched ${formatDate(TRADE.fetchedAt)}.`,
  };
}
