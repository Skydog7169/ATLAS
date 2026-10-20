import raw from '../data/trade.generated.json';
import { BLOC_BY_ID } from '../data/blocs';
import { FAINT_FILL, NO_DATA_FILL } from './palette';
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

/** Lower bounds of the three share bands the map and legend key share. */
export const TRADE_BANDS = [0.1, 0.25, 0.5] as const;
export const TRADE_BAND_LABEL = ['10–25%', '25–50%', '50%+'] as const;
const BAND_PCT = [42, 70, 100] as const;
/** Leads closer than this (share points) are a tie, not a finding. */
export const NEAR_TIE = 0.02;

const EU_MEMBERS = new Set((BLOC_BY_ID.get('eu')?.members ?? []).filter((m) => m.status === 'member').map((m) => m.iso));

export function tradeBand(share: number): 0 | 1 | 2 {
  return share >= TRADE_BANDS[2] ? 2 : share >= TRADE_BANDS[1] ? 1 : 0;
}

/** The colour for a partner at a share band: mixed in OKLab so gold stays gold on navy. Map and legend both use this. */
export function tradeMix(partner: TradePartner, band: 0 | 1 | 2): string {
  const pct = BAND_PCT[band];
  return pct >= 100 ? TRADE_COLOR[partner] : `color-mix(in oklab, ${TRADE_COLOR[partner]} ${pct}%, var(--land))`;
}

/** Partners that count for a country: the EU's share of an EU member's exports is its own single market, so it is left out. */
export function tradePartnersFor(iso: string): TradePartner[] {
  return EU_MEMBERS.has(iso) ? TRADE_PARTNERS.filter((p) => p !== 'eu') : TRADE_PARTNERS;
}

/**
 * Map fill: the leading partner's hue at its share band; stripes of both hues
 * when the top two are within two points; a faint neutral when none reaches
 * 10%; the no-data hatch when WITS has no row.
 */
export function tradeFill(iso: string): { fill: string; stripes?: [string, string] } {
  const row = TRADE_BY_ISO.get(iso);
  if (!row) return { fill: NO_DATA_FILL };
  const ranked = tradePartnersFor(iso)
    .filter((p) => row[p] >= TRADE_BANDS[0])
    .sort((a, b) => row[b] - row[a]);
  const [lead, second] = ranked;
  if (!lead) return { fill: FAINT_FILL };
  const fill = tradeMix(lead, tradeBand(row[lead]));
  if (second && row[lead] - row[second] < NEAR_TIE) return { fill, stripes: [fill, tradeMix(second, tradeBand(row[second]))] };
  return { fill };
}

export function tradeColor(iso: string): string {
  return tradeFill(iso).fill;
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
  const base = `Exports ${row.year}: US ${pct(row.us)} · China ${pct(row.china)} · EU ${pct(row.eu)}`;
  if (EU_MEMBERS.has(iso)) return `${base} · EU single market, tinted by the US and China only`;
  if (iso === 'USA' || iso === 'CHN') return `${base} · own share excluded`;
  return base;
}

export function tradeDossier(iso: string): DossierExtra | null {
  const row = TRADE_BY_ISO.get(iso);
  if (!row) return null;
  const lead = leadingPartner(row, 0);
  return {
    id: 'trade',
    title: `Export dependence · ${row.year}`,
    rows: [...TRADE_PARTNERS].sort((a, b) => row[b] - row[a]).map((p) => ({ label: TRADE_PARTNER_LABEL[p], value: pct(row[p]), share: row[p], note: p === lead ? 'Largest of the three' : undefined })),
    footnote: `Share of ${formatUsd(row.exportsUsd)} goods exports in ${row.year}. ${TRADE.source.name}, fetched ${formatDate(TRADE.fetchedAt)}.`,
  };
}
