export function daysBetween(from: string, today: string): number;
export function hotSelection<T extends { history: Array<{ date: string; intensity: string }>; lastChecked?: string }>(
  entries: T[],
  today: string,
  options?: { recentDays?: number; staleDays?: number; cap?: number },
): T[];
