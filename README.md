# ATLAS

An interactive geopolitics map. Two views of the same world:

- **Blocs** — who belongs to which alliance or organisation. Eighteen groupings from NATO and the EU to BRICS, the SCO, the African Union and the 2026 Mecca defence pact, with partner, observer, suspended and frozen memberships drawn distinctly.
- **Conflicts** — 31 active wars, insurgencies and flashpoints, marked by intensity, each with the parties, background, the latest verified status and links to live trackers.

- **Compare** — pick a bloc, press Compare, pick another: shared and exclusive members on the map and in a list, with combined population, GDP and military spending from the World Bank side by side.
- **Displacement layer** — people forcibly displaced from each country (refugees, asylum seekers, IDPs and others in need of protection) from the UNHCR Refugee Data Finder, as an overlay on either mode.

- **Country dossiers** — every country has a page at `#country=XXX` with its bloc memberships, conflicts on its territory, UNHCR displacement, World Bank figures and the dated changes that concern it. Later datasets (sanctions, elections) plug in as extra sections.
- **Event ticker** — the strip along the bottom cycles the ten newest dated assessments and membership changes. Hover or focus pauses it; each item opens its panel.
- **Watchlist** — star any country, bloc or conflict from its panel. Stars live in this browser's localStorage only (every read and write is guarded, so a blocked store just means an empty list), and the ticker and the changes feed can be filtered to what you follow.

- **Data layers** — the layers button offers four overlays on either mode: displacement, **sanctions** (countries tinted by how many UN, US and EU country-level regimes target them, with each regime linked from the dossier), **elections** (months to the next national election) and **nuclear status** (armed, threshold, hosting allied weapons, under an umbrella). Each legend names its source and fetch date.

- **Conflict depth** — each conflict panel carries a dated peace-process tracker (ceasefires, agreements, talks, roadmaps, setbacks) that the weekly pass extends, and a who-backs-whom diagram built from structured actors and their outside backers. A country's dossier lists the conflicts it sponsors abroad.

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
| Data | JSON in `src/data/` with zod schemas | Reviewable in a diff, writable by the weekly research script; tests check every ISO code resolves and headline member counts hold |

Vendor code is split into `react`, `d3` and `geo` chunks, and the map component loads lazily so the shell paints before the geometry arrives. The 1:50m geometry is a further chunk fetched only when the map is zoomed in.

### Project layout

```
src/
  data/        conflicts.json, blocs.json, elections.json, nuclear.json, schema.ts, guards.ts, types.ts, *.generated.json, geo/
  lib/         countries, geo, search, labels, url state, feed, dossier, watchlist
  components/  WorldMap, Search, DetailPanel, Legend, BlocChips, Ticker, StarButton, ErrorBoundary, ThemeToggle
  hooks/       useAppState (hash-synced), useWatchlist (localStorage-backed store)
scripts/       build-countries.mjs, build-displacement.mjs, build-worldbank.mjs, build-sanctions.mjs, build-elections.mjs, research/update.mjs (weekly Claude research pass)
```

## Data and its limits

The datasets are a **snapshot**, not a feed, last refreshed in October 2026 from the sources linked on each entry. Each bloc and conflict carries an `updated` month that the panel shows. Treat anything older than a few months as background and follow the source links (CFR Global Conflict Tracker, ACLED, Crisis Group CrisisWatch, ISW) for current developments.

Conventions worth knowing:

- Kosovo uses the user-assigned code `UNK`. Northern Cyprus and Somaliland are drawn as neutral territory.
- Taiwan, Palestine and Western Sahara are included as map entities without taking a position on status.
- A country is tinted in Conflicts mode by the most intense conflict on its territory, including conflicts where it is an external party.
- Bloc "member" counts in the legend and tests count full members only.

### How the data stays current

Every Monday the **Weekly data refresh** workflow runs `scripts/research/update.mjs`. For each conflict it asks Claude, with web search, for a fresh assessment and appends it to `src/data/conflicts.json` only when all of these hold:

- the model reports a material development and the text is not a reworded repeat;
- every cited URL appeared in that run's search results or lives on a trusted tracker or wire-service host (invented links are dropped, and an update with no surviving source is rejected);
- intensity moves at most one step per pass; larger jumps are clamped and flagged.

The same run refreshes `src/data/displacement.generated.json` from the UNHCR API (`pnpm run data:displacement`), `src/data/worldbank.generated.json` from the World Bank API (`pnpm run data:worldbank`) and `src/data/sanctions.generated.json` from OFAC's programme index and the EU Sanctions Map API (`pnpm run data:sanctions`; UN Security Council regimes are a curated table in the script, cross-checked against the EU map's "adopted by UN" flag). If a source is unreachable the committed file stands, so the site never depends on it at runtime. The pass also keeps `src/data/elections.json` current: each week it re-checks up to twelve entries (those past, unset or due within 60 days first, then the longest-unverified) with web search under the same citation rule, and `pnpm run data:elections` bootstraps any country still missing a row from Wikipedia's list of next general elections. `src/data/nuclear.json` is curated by hand with a source per entry and a verification date. Each conflict's `actors` (with `backers`) and `peace` events live in `conflicts.json`; the research pass asks for new peace-process events alongside each assessment and appends only those it can cite. An ACLED layer slot exists (`pnpm run data:acled`, `src/data/acled.generated.json`): with `ACLED_EMAIL` and `ACLED_PASSWORD` repository secrets the pass fetches 30 days of political-violence event counts per country and the layer appears in the menu; without them the script writes an "unavailable" placeholder and the layer stays hidden. It also reviews bloc memberships against the same rules and lists possible new conflicts for a human to consider, without adding them. The run opens a pull request whose body is the research report, so changes are reviewed before they reach the site. Conflicts checked without change get a `lastChecked` date, which the panel shows.

Setup: add an `ANTHROPIC_API_KEY` repository secret (Settings → Secrets and variables → Actions). A full pass costs a few dollars. You can trigger it by hand from the Actions tab with an optional list of conflict ids or a limit. `pnpm run data:research:mock` exercises the pipeline offline, and CI runs that on every push.

### Updating the data by hand

1. Edit `src/data/conflicts.json` or `src/data/blocs.json`. Add a new dated entry to `history` or `changes` rather than editing old ones.
2. Run `pnpm test`. The schema and integrity tests catch bad dates, unknown ISO codes, missing sources and broken member counts.
3. After bumping `world-countries`, run `pnpm run data:countries` and commit the regenerated table.

## Accessibility

Keyboard users reach everything: `/` focuses search, the map itself takes focus (arrows pan, `+` and `-` zoom, `0` resets), conflict markers are tabbable and open on Enter, and the detail panel's lists are plain buttons. Colour never carries meaning alone: intensity also sets marker size and is named in every label, suspended memberships are hatched, and compared blocs use stripes for overlap. Light and dark themes follow the system and can be overridden. Animations stop under `prefers-reduced-motion`. The Playwright suite runs axe-core scans and fails CI on serious or critical violations.

## Testing

```sh
pnpm test                    # unit and data integrity tests (vitest)
pnpm run build && pnpm run test:e2e   # Playwright: desktop + Pixel 7 against the production build
```

CI runs both on every push. To use a preinstalled Chromium locally, set `PW_CHROMIUM_PATH` to its binary.
