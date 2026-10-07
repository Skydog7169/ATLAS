import type { HistoryEntry, Intensity, Source } from './types';

export const INTENSITY_STEPS: Record<Intensity, number> = { latent: 0, low: 1, medium: 2, high: 3 };
const BY_STEP: Intensity[] = ['latent', 'low', 'medium', 'high'];

/**
 * Limits how far an automated assessment may move intensity in one pass.
 * A two-step jump is plausible (a ceasefire collapsing) but should be
 * flagged for a human, so we clamp to one step and report that we did.
 */
export function clampIntensity(previous: Intensity, proposed: Intensity, maxStep = 1): { intensity: Intensity; clamped: boolean } {
  const from = INTENSITY_STEPS[previous];
  const to = INTENSITY_STEPS[proposed];
  if (Math.abs(to - from) <= maxStep) return { intensity: proposed, clamped: false };
  const stepped = BY_STEP[from + Math.sign(to - from) * maxStep] ?? proposed;
  return { intensity: stepped, clamped: true };
}

/** Hosts whose pages are acceptable even if they did not appear in this run's search results. */
export const TRUSTED_HOSTS = [
  'cfr.org',
  'acleddata.com',
  'crisisgroup.org',
  'ucdp.uu.se',
  'understandingwar.org',
  'criticalthreats.org',
  'un.org',
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'bbc.co.uk',
  'aljazeera.com',
  'france24.com',
  'securitycouncilreport.org',
];

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function hostTrusted(host: string): boolean {
  return TRUSTED_HOSTS.some((t) => host === t || host.endsWith('.' + t));
}

/**
 * Keeps only sources whose URL either appeared in the web search results
 * seen during the run or lives on a trusted tracker or wire-service host.
 * This is the main defence against invented citations.
 */
export function verifySources(proposed: Source[], seenUrls: Iterable<string>): { kept: Source[]; dropped: Source[] } {
  const seen = new Set<string>();
  for (const u of seenUrls) seen.add(u.replace(/\/+$/, ''));
  const kept: Source[] = [];
  const dropped: Source[] = [];
  for (const s of proposed) {
    const host = hostOf(s.url);
    const normalised = s.url.replace(/\/+$/, '');
    if (!host || !s.url.startsWith('https://')) {
      dropped.push(s);
      continue;
    }
    if (seen.has(normalised) || hostTrusted(host)) kept.push({ name: s.name.trim(), url: s.url });
    else dropped.push(s);
  }
  return { kept, dropped };
}

/** True when a proposed status is essentially the previous one (same text or trivially edited). */
export function isMaterialChange(previous: HistoryEntry | undefined, proposedStatus: string, proposedIntensity: Intensity): boolean {
  if (!previous) return true;
  if (previous.intensity !== proposedIntensity) return true;
  const norm = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  const a = norm(previous.status);
  const b = norm(proposedStatus);
  if (a === b) return false;
  // Jaccard similarity on word sets: near-identical rewordings are not material.
  const wa = new Set(a.split(' '));
  const wb = new Set(b.split(' '));
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter += 1;
  const union = wa.size + wb.size - inter;
  return union === 0 ? false : inter / union < 0.85;
}
