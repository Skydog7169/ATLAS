// Live military aircraft: fetches the community ADS-B networks' "military"
// list, keeps only what the map draws, and caches it so a crowd of viewers
// costs the upstream one request per TTL. Split from the Vercel entry so the
// dev server and the tests can use it too.

/** ADSBExchange-v2-compatible feeds of aircraft flagged military, tried in order. */
export const DEFAULT_FEEDS = ['https://api.adsb.lol/v2/mil', 'https://opendata.adsb.fi/api/v2/mil'];

export const FEED_NAMES: Record<string, { name: string; url: string; license: string }> = {
  'api.adsb.lol': { name: 'adsb.lol', url: 'https://adsb.lol/', license: 'ODbL 1.0' },
  'opendata.adsb.fi': { name: 'adsb.fi', url: 'https://adsb.fi/', license: 'adsb.fi open data terms' },
};

export interface Aircraft {
  hex: string;
  /** Callsign, trimmed. */
  flight?: string;
  /** Registration or military serial. */
  r?: string;
  /** ICAO type designator, e.g. K35R. */
  t?: string;
  /** Long type name when the feed has one, e.g. "SIKORSKY UH-60 Black Hawk". */
  desc?: string;
  /** Operator when the feed has one. */
  op?: string;
  lat: number;
  lon: number;
  /** Barometric altitude in feet; null on the ground or unknown. */
  alt: number | null;
  ground?: true;
  /** Ground speed, knots. */
  gs?: number;
  /** Track over ground, degrees clockwise from north. */
  track?: number;
  /** Vertical rate, feet per minute. */
  vr?: number;
  squawk?: string;
  /** "general", "nordo", "unlawful" and so on when the transponder declares one. */
  emergency?: string;
  /** Seconds between the position and the snapshot time. */
  age: number;
  /** Position from multilateration rather than the aircraft's own ADS-B report. */
  mlat?: true;
  /** ADS-B emitter category, e.g. A7 rotorcraft. */
  cat?: string;
}

export interface AircraftFeed {
  /** Snapshot time, ms since epoch, from the upstream. */
  now: number;
  source: { name: string; url: string; license: string };
  /** Aircraft in the upstream list before filtering. */
  total: number;
  aircraft: Aircraft[];
  /** Set when the upstream failed and an older snapshot is served. */
  stale?: true;
}

type Raw = Record<string, unknown>;
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Positions older than this are dropped: the aircraft has likely landed or left coverage. */
export const MAX_POSITION_AGE_S = 600;

/**
 * One upstream record as an Aircraft, or null when it has no usable position
 * or is a ground vehicle or obstacle (emitter categories C*, type TWR).
 */
export function slim(a: Raw): Aircraft | null {
  const hex = str(a.hex)?.toLowerCase();
  if (!hex) return null;
  let lat = num(a.lat);
  let lon = num(a.lon);
  let age = num(a.seen_pos) ?? num(a.seen) ?? 0;
  const last = a.lastPosition as Raw | undefined;
  if ((lat === undefined || lon === undefined) && last) {
    lat = num(last.lat);
    lon = num(last.lon);
    age = num(last.seen_pos) ?? MAX_POSITION_AGE_S + 1;
  }
  if (lat === undefined || lon === undefined || age > MAX_POSITION_AGE_S) return null;
  const cat = str(a.category);
  const t = str(a.t);
  if (cat?.startsWith('C') || t === 'TWR') return null;
  const ground = a.alt_baro === 'ground';
  const alt = ground ? null : (num(a.alt_baro) ?? num(a.alt_geom) ?? null);
  const emergency = str(a.emergency);
  const out: Aircraft = { hex, lat: round(lat, 4), lon: round(lon, 4), alt, age: Math.round(age) };
  const flight = str(a.flight);
  if (flight) out.flight = flight;
  const r = str(a.r);
  if (r) out.r = r;
  if (t && t !== 'ZZZZ') out.t = t;
  const desc = str(a.desc);
  if (desc) out.desc = desc;
  const op = str(a.ownOp);
  if (op) out.op = op;
  if (ground) out.ground = true;
  const gs = num(a.gs);
  if (gs !== undefined) out.gs = Math.round(gs);
  const track = num(a.track) ?? num(a.true_heading) ?? num(a.mag_heading);
  if (track !== undefined) out.track = Math.round(track);
  const vr = num(a.baro_rate) ?? num(a.geom_rate);
  if (vr !== undefined) out.vr = Math.round(vr);
  const squawk = str(a.squawk);
  if (squawk) out.squawk = squawk;
  if (emergency && emergency !== 'none') out.emergency = emergency;
  if (Array.isArray(a.mlat) && a.mlat.includes('lat')) out.mlat = true;
  if (cat) out.cat = cat;
  return out;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function toFeed(body: Raw, feedUrl: string, fallbackNow = Date.now()): AircraftFeed {
  const list = Array.isArray(body.ac) ? (body.ac as Raw[]) : [];
  const host = new URL(feedUrl).host;
  return {
    now: num(body.now) ?? fallbackNow,
    source: FEED_NAMES[host] ?? { name: host, url: `https://${host}/`, license: 'see provider' },
    total: list.length,
    aircraft: list.map(slim).filter((a): a is Aircraft => a !== null),
  };
}

export interface FeedCache {
  get(now?: number): Promise<AircraftFeed>;
}

/**
 * Serves the cached snapshot while it is younger than `ttlMs`; otherwise
 * tries each feed in order. When every feed fails it serves the last good
 * snapshot marked stale, and throws only when there has never been one.
 * Concurrent misses share one upstream request.
 */
export function feedCache(feeds: string[], ttlMs: number, fetcher: typeof fetch = fetch): FeedCache {
  let last: { at: number; feed: AircraftFeed } | null = null;
  let inflight: Promise<AircraftFeed> | null = null;
  // After a failed round, wait a full TTL before asking the upstreams again rather than retrying on every request.
  let retryAt = 0;
  async function refresh(now: number): Promise<AircraftFeed> {
    const errors: string[] = [];
    for (const url of feeds) {
      try {
        const res = await fetcher(url, { headers: { accept: 'application/json', 'user-agent': 'ATLAS geopolitics map (https://github.com/Skydog7169/ATLAS)' }, signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error(`${res.status}`);
        const feed = toFeed((await res.json()) as Raw, url, now);
        last = { at: now, feed };
        return feed;
      } catch (err) {
        errors.push(`${new URL(url).host}: ${(err as Error).message}`);
      }
    }
    retryAt = now + ttlMs;
    if (last) return { ...last.feed, stale: true };
    throw new Error(`every aircraft feed failed (${errors.join('; ')})`);
  }
  return {
    get(now = Date.now()) {
      if (last && now - last.at < ttlMs) return Promise.resolve(last.feed);
      if (last && now < retryAt) return Promise.resolve({ ...last.feed, stale: true });
      inflight ??= refresh(now).finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}
