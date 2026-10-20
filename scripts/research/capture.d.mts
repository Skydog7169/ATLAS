export interface UnrestCandidate {
  name: string;
  kind: string;
  since: string;
  countries: string[];
  location?: unknown;
  parties?: string[];
  trigger?: string;
  summary?: string;
  status?: string;
  intensity: string;
  confidence: string;
}
export interface ExistingEpisode {
  id: string;
  name: string;
  kind: string;
  since: string;
  countries: string[];
}
export interface CapturedEpisode {
  id: string;
  name: string;
  kind: string;
  since: string;
  location: [number, number] | null;
  countries: string[];
  parties: string[];
  trigger: string;
  summary: string;
  history: Array<{ date: string; intensity: string; status: string; sources: Array<{ name: string; url: string }>; confidence: string }>;
}
export const MAX_AUTO_ADDS: number;
export function slugify(name: string): string;
export function findDuplicate<T extends ExistingEpisode>(candidate: { name: string; kind: string; since: string; countries: string[] }, existing: T[]): T | null;
export function placeOf(proposed: unknown, centroid: [number, number] | null): [number, number] | null;
export function captureUnrest(
  candidate: UnrestCandidate,
  kept: Array<{ name: string; url: string }>,
  existing: ExistingEpisode[],
  today: string,
  lonLat: (iso: string) => [number, number] | null,
): { add: true; episode: CapturedEpisode } | { add: false; reason: string };
