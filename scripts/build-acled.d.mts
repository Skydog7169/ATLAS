export const EVENT_TYPES: Record<string, string>;
export interface AcledByType {
  battles: number;
  explosions: number;
  civilians: number;
  protests: number;
  riots: number;
  strategic: number;
}
export function aggregate(rows: Array<{ iso3?: string; iso?: string; event_type?: string; fatalities?: number | string | null }>, into?: Map<string, { iso: string; events: number; fatalities: number; byType: AcledByType }>): Map<string, { iso: string; events: number; fatalities: number; byType: AcledByType }>;
