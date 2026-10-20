// Types for the feed builder so the vitest suite can import it under strict TypeScript.
export interface FeedSource {
  name: string;
  url: string;
}
export interface FeedItem {
  id: string;
  date: string;
  title: string;
  summary: string;
  url: string;
  tags: string[];
  sources: FeedSource[];
  /** Assessments only: the level now and at the previous assessment (null for a first entry). */
  intensity?: string;
  prev?: string | null;
  delta: 'new' | 'up' | 'down' | 'same' | 'membership';
}
export const SITE: string;
export const FEED_LIMIT: number;
export function deltaOf(prev: string | null, cur: string): 'new' | 'up' | 'down' | 'same';
export function deltaLabel(delta: string, prev: string | null, cur: string): string;
export function collectItems(conflicts: unknown[], blocs: unknown[], countryName: (iso: string) => string, unrest?: Array<{ id: string; name: string; history: Array<{ date: string; intensity: string; status: string; sources?: FeedSource[] }> }>): FeedItem[];
export function renderRss(items: FeedItem[], opts?: { now?: Date; limit?: number }): string;
export function renderJsonFeed(items: FeedItem[], opts?: { limit?: number }): string;
