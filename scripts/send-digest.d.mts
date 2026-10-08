import type { FeedItem } from './build-feeds.mjs';
export function sinceDate(now?: Date, days?: number): string;
export function renderDigest(items: FeedItem[], since: string, now?: Date): { subject: string; text: string; html: string; count: number } | null;
export function sendViaResend(msg: { apiKey: string; from: string; to: string[]; subject: string; text: string; html: string }, fetchImpl?: typeof fetch): Promise<unknown>;
