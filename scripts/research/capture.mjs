// Turns a candidate from the new-unrest scan into a curated episode when it
// clears the evidence bar, or says why it was only reported. Pure functions so
// the rules are unit-tested without the API.
const ISO3 = /^[A-Z]{3}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Candidates auto-added per pass, at most. */
export const MAX_AUTO_ADDS = 3;
/** Degrees of longitude/latitude a proposed location may sit from the country centroid. */
const PLACE_RADIUS = 25;

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const isWikipedia = (url) => /(^|\.)wikipedia\.org$/.test(hostOf(url) ?? '');

function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return Math.abs((ay - by) * 12 + (am - bm));
}

function wordSet(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function jaccard(a, b) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

/** Finds an existing episode that plausibly describes the same unrest, or null. */
export function findDuplicate(candidate, existing) {
  const id = slugify(candidate.name);
  const words = wordSet(candidate.name);
  for (const e of existing) {
    if (e.id === id) return e;
    if (!e.countries.some((c) => candidate.countries.includes(c))) continue;
    if (e.kind === candidate.kind && MONTH.test(candidate.since) && monthsBetween(e.since, candidate.since) <= 6) return e;
    if (jaccard(wordSet(e.name), words) >= 0.5) return e;
  }
  return null;
}

/** Uses the proposed [lon, lat] when it is plausible for the country, else the country centroid. */
export function placeOf(proposed, centroid) {
  if (Array.isArray(proposed) && proposed.length === 2) {
    const [lon, lat] = proposed.map(Number);
    const valid = Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
    if (valid && (!centroid || Math.hypot(lon - centroid[0], lat - centroid[1]) <= PLACE_RADIUS)) return [round(lon), round(lat)];
  }
  return centroid;
}

const round = (n) => Math.round(n * 10000) / 10000;

/**
 * Decides whether a scan candidate becomes an episode. `kept` are the sources
 * that survived verifySources; `lonLat(iso)` returns a country centroid as
 * [lon, lat] or null, which doubles as the ISO-code check. A candidate is
 * added only with two independent non-Wikipedia sources, a known country, a
 * plausible start month, medium or better confidence, no look-alike already
 * on the map, and enough text to fill the episode schema.
 */
export function captureUnrest(candidate, kept, existing, today, lonLat) {
  const reject = (reason) => ({ add: false, reason });
  const countries = [...new Set(candidate.countries ?? [])];
  if (!countries.length || countries.some((c) => !ISO3.test(c) || !lonLat(c))) return reject('unknown country code');
  if (!MONTH.test(candidate.since ?? '') || candidate.since > today.slice(0, 7)) return reject('start month missing or in the future');
  if (candidate.confidence === 'low') return reject('low confidence');
  const sources = (kept ?? []).filter((s) => !isWikipedia(s.url));
  const hosts = new Set(sources.map((s) => hostOf(s.url)));
  if (hosts.size < 2) return reject(`needs two independent non-Wikipedia sources (had ${hosts.size})`);
  const dup = findDuplicate({ ...candidate, countries }, existing);
  if (dup) return reject(`looks like the existing episode ${dup.id}`);
  const id = slugify(candidate.name);
  const name = String(candidate.name ?? '').trim();
  const trigger = String(candidate.trigger ?? '').trim();
  const summary = String(candidate.summary ?? '').trim();
  const status = String(candidate.status ?? '').trim();
  const parties = (candidate.parties ?? [])
    .map((p) => String(p).trim())
    .filter((p) => p.length >= 2)
    .slice(0, 4);
  if (id.length < 3 || name.length < 3 || trigger.length < 20 || summary.length < 40 || status.length < 40 || !parties.length) return reject('description too thin');
  const episode = {
    id,
    name,
    kind: candidate.kind,
    since: candidate.since,
    location: placeOf(candidate.location, lonLat(countries[0])),
    countries,
    parties,
    trigger: trigger.slice(0, 300),
    summary,
    history: [{ date: today, intensity: candidate.intensity, status: status.slice(0, 700), sources: sources.slice(0, 4), confidence: candidate.confidence }],
  };
  return { add: true, episode };
}
