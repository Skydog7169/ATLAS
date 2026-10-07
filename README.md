# ATLAS

An interactive geopolitics map. Two views of the same world:

- **Blocs** — who belongs to which alliance or organisation. Eighteen groupings from NATO and the EU to BRICS, the SCO, the African Union and the 2026 Mecca defence pact, with partner, observer, suspended and frozen memberships drawn distinctly.
- **Conflicts** — 31 active wars, insurgencies and flashpoints, marked by intensity, each with the parties, background, the latest verified status and links to live trackers.

Search any country, bloc or conflict. Every view is a shareable link.

## Running it

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm check        # typecheck + lint + tests + production build
```

Node 20 or newer. The project deploys to Vercel with no configuration beyond `vercel.json`.

## How it is built

| Layer | Choice | Why |
| --- | --- | --- |
| UI | React 19 + TypeScript, Vite 7 | Small, fast, strict types on all data |
| Map | d3-geo + d3-zoom on inline SVG | No tile server, no API key, works offline once loaded |
| Geometry | Natural Earth 1:110m via `world-atlas`, bundled | ~38 KB gzipped; sovereign states too small for the polygons are drawn as markers so no member goes missing |
| Country facts | Slim table derived from `world-countries` at build time | Keeps 20 MB of flags and translations out of the bundle; CI fails if the committed table drifts |
| Data | Hand-curated TypeScript in `src/data/` | Reviewable in a diff; integrity tests check every ISO code resolves and headline member counts hold |

Vendor code is split into `react`, `d3` and `geo` chunks, and the map component loads lazily so the shell paints before the geometry arrives.

### Project layout

```
src/
  data/        blocs.ts, conflicts.ts, types.ts, countries.generated.json, geo/
  lib/         countries, geo, search, labels, url state
  components/  WorldMap, Search, DetailPanel, Legend, BlocChips, ErrorBoundary, ThemeToggle
  hooks/       useAppState (hash-synced)
scripts/       build-countries.mjs
```

## Data and its limits

The datasets are a **snapshot**, not a feed, last refreshed in October 2026 from the sources linked on each entry. Each bloc and conflict carries an `updated` month that the panel shows. Treat anything older than a few months as background and follow the source links (CFR Global Conflict Tracker, ACLED, Crisis Group CrisisWatch, ISW) for current developments.

Conventions worth knowing:

- Kosovo uses the user-assigned code `UNK`. Northern Cyprus and Somaliland are drawn as neutral territory.
- Taiwan, Palestine and Western Sahara are included as map entities without taking a position on status.
- A country is tinted in Conflicts mode by the most intense conflict on its territory, including conflicts where it is an external party.
- Bloc "member" counts in the legend and tests count full members only.

### Updating the data

1. Edit `src/data/blocs.ts` or `src/data/conflicts.ts`. Bump the entry's `updated` month.
2. Run `pnpm test`. The integrity tests catch typos in ISO codes and broken member counts.
3. After bumping `world-countries`, run `pnpm run data:countries` and commit the regenerated table.

## Accessibility

Keyboard users reach everything through search (`/` focuses it) and the detail panel's lists; the map itself is pointer-driven. Colour never carries meaning alone: intensity also sets marker size and is named in every label, and suspended memberships are hatched rather than merely paler. Light and dark themes follow the system and can be overridden. Animations stop under `prefers-reduced-motion`.
