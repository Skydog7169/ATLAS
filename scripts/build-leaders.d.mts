export interface ParsedPerson { name: string; wiki: string | null; role?: string | null; incoming?: boolean }
export interface ParsedEntry {
  role: 'state' | 'government' | 'both';
  kind: 'office';
  title: string;
  office: string | null;
  people: ParsedPerson[];
  power: 'executive' | 'de-facto' | null;
  acting: boolean;
  vacant: boolean;
  collective: boolean;
}
export interface ParsedState { name: string; iso: string | null; entries: ParsedEntry[] }
export function wikiTitle(href: string | null | undefined): string | null;
export function parsePage(html: string): ParsedState[];
export function infoKey(person: string, office: string | null | undefined): string;
export function toRows(states: ParsedState[], info?: Map<string, { since: string | null; party: string | null }>, starts?: Map<string, { state?: string; government?: string }>): Array<{ iso: string; offices: unknown[] }>;
