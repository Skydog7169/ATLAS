// Picks the entries worth re-checking every day: the hot list. Exported
// separately from update.mjs (which runs on import) so it can be unit-tested.

/** Days since an ISO date, relative to `today` (YYYY-MM-DD). */
export function daysBetween(from, today) {
  return Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

/**
 * Entries that are high intensity, or whose newest assessment is at most
 * `recentDays` old, or that were never re-checked in `staleDays`. Sorted so
 * high intensity comes first, then the most recently updated. Capped so a
 * daily run stays small and cheap.
 */
export function hotSelection(entries, today, { recentDays = 14, staleDays = 21, cap = 10 } = {}) {
  const scored = entries
    .map((e) => {
      const newest = [...e.history].sort((a, b) => b.date.localeCompare(a.date))[0];
      const updated = newest?.date ?? '1970-01-01';
      const checked = e.lastChecked && e.lastChecked > updated ? e.lastChecked : updated;
      const age = daysBetween(updated, today);
      const sinceCheck = daysBetween(checked, today);
      const hot = newest?.intensity === 'high' || age <= recentDays || sinceCheck >= staleDays;
      return { e, hot, high: newest?.intensity === 'high' ? 1 : 0, updated, sinceCheck };
    })
    .filter((x) => x.hot)
    .sort((a, b) => b.high - a.high || b.sinceCheck - a.sinceCheck || b.updated.localeCompare(a.updated));
  return scored.slice(0, cap).map((x) => x.e);
}
