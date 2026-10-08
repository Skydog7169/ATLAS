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
}
export const SITE: string;
export const FEED_LIMIT: number;
export function collectItems(conflicts: unknown[], blocs: unknown[], countryName: (iso: string) => string): FeedItem[];
export function renderRss(items: FeedItem[], opts?: { now?: Date; limit?: number }): string;
export function renderJsonFeed(items: FeedItem[], opts?: { limit?: number }): string;
