export const STATES: Array<[string, string, string]>;
export const HOUSE_SEATS: Record<string, number>;
export function partyCode(label: string): 'D' | 'R' | 'O';
export function parseLongDate(text: string): string | null;
export function parseGovernors(html: string): Map<string, { name: string; wiki?: string; party: 'D' | 'R' | 'O'; partyName: string; since?: string; termEnds?: number; termNote?: string }>;
export function parseCongress(people: unknown[]): Map<string, { senators: Array<Record<string, unknown>>; house: Array<Record<string, unknown>> }>;
export function parseOpenStates(csv: string): Record<string, { D: number; R: number; O: number }>;
export function control(counts: { D: number; R: number; O: number }, override?: string | null): string;
export function buildLegislature(code: string, chambers: Record<string, { D: number; R: number; O: number }>): { unicameral?: boolean; chambers: Array<{ id: string; name: string; control: string }>; note?: string };
