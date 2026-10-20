// Vercel serverless entry for the live military aircraft layer. Relays the
// community ADS-B networks' military list (they send no CORS headers and
// rate-limit per IP), slimmed and cached: one upstream request per TTL per
// function instance, and the CDN holds the response for the same time.
import { DEFAULT_FEEDS, feedCache } from './_lib/aircraft.js';

const FEEDS = (process.env.AIRCRAFT_FEEDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const TTL_S = Math.max(30, Number(process.env.AIRCRAFT_TTL_SECONDS ?? '90') || 90);
const cache = feedCache(FEEDS.length ? FEEDS : DEFAULT_FEEDS, TTL_S * 1000);

interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

export default async function handler(_req: unknown, res: Res) {
  try {
    const feed = await cache.get();
    res.setHeader('Cache-Control', `public, max-age=30, s-maxage=${TTL_S}, stale-while-revalidate=${TTL_S * 3}`);
    return res.status(200).json(feed);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: (err as Error).message });
  }
}
