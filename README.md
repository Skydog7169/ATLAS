# ATLAS

An interactive geopolitics map. Two views of the same world:

- **Blocs** — who belongs to which alliance or organisation. Eighteen groupings from NATO and the EU to BRICS, the SCO, the African Union and the 2026 Mecca defence pact, with partner, observer, suspended and frozen memberships drawn distinctly.
- **Conflicts** — 31 active wars, insurgencies and flashpoints, marked by intensity, each panel opening on the latest dated assessment with its citations and a line saying who drafted it (the research pass, with Claude and web search) and that an editor approved it.

- **Compare** — pick a bloc, press Compare, pick another: shared and exclusive members on the map and in a list, with combined population, GDP and military spending from the World Bank side by side.
- **Displacement layer** — people forcibly displaced from each country (refugees, asylum seekers, IDPs and others in need of protection) from the UNHCR Refugee Data Finder, as an overlay on either mode.

- **Country dossiers** — every country has a page at `#country=XXX` with its bloc memberships, conflicts on its territory, UNHCR displacement, World Bank figures and the dated changes that concern it. Later datasets (sanctions, elections) plug in as extra sections.
- **Latest changes ticker** — the strip along the bottom cycles the ten newest dated assessments and membership changes. Hover or focus pauses it; each item opens its panel.
- **Watchlist** — star any country, bloc or conflict from its panel. Stars live in this browser's localStorage only (every read and write is guarded, so a blocked store just means an empty list), and the ticker and the changes feed can be filtered to what you follow.

- **Latest changes** — a strip under the header lists what changed since you last pressed "Mark read" (the date lives in this browser only). RSS and JSON feeds at `/feed.xml` and `/feed.json` are generated on every build. An email digest goes out after each merged weekly refresh.
- **Data layers** — the layers button offers four overlays on either mode: displacement, **sanctions** (countries tinted by how many UN, US and EU country-level regimes target them, with each regime linked from the dossier), **elections** (months to the next national election) and **nuclear status** (armed, threshold, hosting allied weapons, under an umbrella). Each legend names its source and fetch date.

- **Power and trade layers** — eight maritime chokepoints (Hormuz, Bab el-Mandeb, Suez, Malacca, Taiwan Strait, Turkish Straits, Panama, GIUK) drawn as diamonds with a dated status and linked conflicts; foreign military presence by host country (bases, deployments and peace operations, curated and sourced); and export dependence as a three-way tint by the largest of the US, China and the EU from World Bank WITS, with the shares in each dossier.
- **Conflict depth** — each conflict panel carries a dated peace-process tracker (ceasefires, agreements, talks, roadmaps, setbacks) that the weekly pass extends, and a who-backs-whom diagram built from structured actors and their outside backers. A country's dossier lists the conflicts it sponsors abroad.

- **Analysis** — a relationship view for any two countries (shared blocs, conflicts linking them, sanctions one applies to the other, forces either keeps in the other, export share each way); bloc trend charts of membership and combined GDP since 1990; and, behind a flag, **Ask ATLAS**, a question box answered strictly from the dataset with citations.

Search any country, bloc or conflict. Every view is a shareable link.

The first screen shows neutral land with the bloc chips as the call to action, a header readout of when the data last changed (it opens Latest changes), and, for first-time visitors, a dismissible **This week** card: counts of new, escalated and eased situations in the newest week of data, the top three by intensity and recency, and a one-line note that assessments are AI-researched from cited sources and editor-approved. About explains how assessments are written, what intensity and confidence mean, what the editor's review does and does not cover, and how ATLAS words disputed territories.

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
  data/        conflicts.json, unrest.json, blocs.json, elections.json, nuclear.json, schema.ts, guards.ts, types.ts, *.generated.json, geo/
  lib/         countries, geo, search, labels, url state, feed, dossier, watchlist, exportPng
  components/  WorldMap, GlobeMap, Briefing, Search, DetailPanel, Legend, BlocChips, Ticker, StarButton, ErrorBoundary, ThemeToggle
  hooks/       useAppState (hash-synced), useWatchlist (localStorage-backed store), useSize
scripts/       build-countries.mjs, build-feeds.mjs, send-digest.mjs, research/update.mjs (weekly Claude research pass)
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

The same run refreshes `src/data/displacement.generated.json` from the UNHCR API (`pnpm run data:displacement`), `src/data/worldbank.generated.json` from the World Bank API (`pnpm run data:worldbank`) and `src/data/sanctions.generated.json` from OFAC's programme index and the EU Sanctions Map API (`pnpm run data:sanctions`; UN Security Council regimes are a curated table in the script, cross-checked against the EU map's "adopted by UN" flag). If a source is unreachable the committed file stands, so the site never depends on it at runtime. The pass also keeps `src/data/elections.json` current: each week it re-checks up to twelve entries (those past, unset or due within 60 days first, then the longest-unverified) with web search under the same citation rule, and `pnpm run data:elections` bootstraps any country still missing a row from Wikipedia's list of next general elections. `src/data/nuclear.json` is curated by hand with a source per entry and a verification date. Each conflict's `actors` (with `backers`) and `peace` events live in `conflicts.json`; the research pass asks for new peace-process events alongside each assessment and appends only those it can cite. `src/data/trade.generated.json` comes from `pnpm run data:trade`: three WITS SDMX calls per year (US and China, the 27 EU members, the world total) give the headline shares, then one call per reporter keeps its fifteen largest export destinations for the relationship view, newest year per reporter; `src/data/worldbank-history.generated.json` (`pnpm run data:worldbank-history`) holds GDP by year since 1990 for the bloc trend charts, which also need the accession year (`since`) on every member and `former` spells for past members in `blocs.json`; `src/data/chokepoints.json` and `src/data/military.json` are curated with a source per entry. An ACLED layer slot exists (`pnpm run data:acled`, `src/data/acled.generated.json`): with `ACLED_EMAIL` and `ACLED_PASSWORD` repository secrets the pass fetches 30 days of events per country, overall and by event type, and two layers appear in the menu (all political violence, and protests and riots alone) with a per-type dossier section; without them the script writes an "unavailable" placeholder and the layers stay hidden. The same pattern holds for `pnpm run data:ucdp` (`src/data/ucdp.generated.json`): with a `UCDP_TOKEN` secret, issued free by the Uppsala Conflict Data Program on request, it pulls the last complete year of best-estimate deaths in state-based, non-state and one-sided violence per country from the GED API and the organised-violence layer appears. It also reviews bloc memberships against the same rules and lists possible new conflicts for a human to consider, without adding them. The run opens a pull request whose body is the research report, so changes are reviewed before they reach the site. Conflicts checked without change get a `lastChecked` date, which the panel shows.

### Ask ATLAS

`api/ask.ts` is a Vercel serverless function that answers a question from the dataset only. At cold start it renders every conflict, bloc, sanctions row, election, nuclear status, chokepoint and military presence into one text context (`api/_lib/context.ts`), sends it as a cached system block (1-hour TTL) and asks Claude for a structured answer with citations drawn from the dataset's ids and source URLs; off-dataset questions come back with `covered: false`. Each visitor (hashed IP) gets ten questions an hour and the function stops answering once its estimated spend for the day passes `ASK_DAILY_CAP_USD` (default 2 USD); both counters live in the function instance's memory, so they are per instance rather than global. It is **off by default**: the function returns 503 unless `ASK_ATLAS_ENABLED=1` and `ANTHROPIC_API_KEY` are set in the Vercel project, and the question box only appears in builds made with `VITE_ASK_ATLAS=1`. Do not enable it in production without agreeing the key and the cap first.

A second workflow, **Daily research pass** (`.github/workflows/research-daily.yml`, Tuesday to Sunday 05:23 UTC), runs `update.mjs --hot`: it re-checks only the hot list, meaning high-intensity conflicts and unrest, entries updated in the last 14 days, and anything unchecked for three weeks, capped at eight conflicts and six unrest episodes, and skips the bloc, election and new-conflict scans. Both passes also re-check the status of any chokepoint linked to a high-intensity conflict and update `src/data/chokepoints.json` when a specifically sourced change is found. Every new assessment must cite at least one specific article (a front page or tracker index alone is rejected), each source is stored as "Outlet: Headline (date)", and entries carry `drafted: "ai"` so the panel can say who wrote them. Its changes accumulate on one rolling pull request (`data/daily-research`) that is updated in place each day, so there is one thing to review rather than seven. Both passes also scan for unrest the map is missing (see below); the weekly pass lists possible new conflicts for a human to consider.

The pass authenticates in one of two ways. Preferred: **Workload Identity Federation**, where the job presents GitHub's own OIDC token and the SDK exchanges it for a short-lived Anthropic token, so no key is stored. Set up a GitHub Actions workload in the Claude Console (Settings → Workload identity → Connect workload, subject prefix `repo:Skydog7169/ATLAS:`, audience `https://api.anthropic.com`) and add the three identifiers it gives you as repository *variables*: `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID` (and `ANTHROPIC_WORKSPACE_ID` if the rule spans workspaces). Fallback: an `ANTHROPIC_API_KEY` repository secret. With neither, the research step is skipped with a warning and the generated datasets are still refreshed.

### Feeds and the email digest

`scripts/build-feeds.mjs` runs at the start of `pnpm run build` and writes `public/feed.xml` (RSS 2.0) and `public/feed.json` (JSON Feed 1.1) from the same dated entries the changes feed shows; the files are build artefacts, not committed. `.github/workflows/digest.yml` runs `scripts/send-digest.mjs` when a pull request labelled `data-refresh` merges into `main` (or on demand), and emails the last eight days of changes through [Resend](https://resend.com). It needs a `RESEND_API_KEY` repository secret and a `DIGEST_RECIPIENTS` repository variable (comma-separated addresses); an optional `DIGEST_FROM` variable sets the sender once a domain is verified in Resend, otherwise Resend's onboarding sender is used, which only delivers to the Resend account owner. Without the secret or recipients the workflow prints the digest and exits cleanly. No browser push notifications are used.

Setup: add an `ANTHROPIC_API_KEY` repository secret (Settings → Secrets and variables → Actions). A full pass costs a few dollars. You can trigger it by hand from the Actions tab with an optional list of conflict ids or a limit. `pnpm run data:research:mock` exercises the pipeline offline, and CI runs that on every push.

### Updating the data by hand

1. Edit `src/data/conflicts.json` or `src/data/blocs.json`. Add a new dated entry to `history` or `changes` rather than editing old ones.
2. Run `pnpm test`. The schema and integrity tests catch bad dates, unknown ISO codes, missing sources and broken member counts.
3. After bumping `world-countries`, run `pnpm run data:countries` and commit the regenerated table.

## Civil unrest

`src/data/unrest.json` tracks protest movements, riot waves, uprisings, coups, mutinies and crackdowns that are not armed conflicts, with the same dated, sourced history model as conflicts (the intensity scale here means scale of mobilisation and lethality of the response, not combat). Each entry has a kind, a start month, a trigger, parties and countries. The weekly research pass reassesses every entry under the same rules as conflicts: cited pages must appear in its own search results, intensity moves at most one step per pass, and an unchanged situation only earns a `lastChecked` date. Because riot waves can start and peak within a week, every research pass, daily and weekly, also scans for episodes the map is missing (`scripts/research/capture.mjs`). A candidate is added automatically only when two independent, non-Wikipedia sources from its own search results back it, its country code and start month check out, its confidence is at least medium, nothing already on the map looks like the same episode (same country and kind within six months, or a similar name), and the model supplied enough text to fill the schema; the pass adds at most three per run and lists everything weaker in the report with the reason it was held back, so a human can curate it. The Unrest layer tints countries by their most intense episode and draws triangle markers that open an episode panel; episodes also appear in country dossiers, search, the ticker, the changes feed, RSS and JSON feeds, the email digest, the watchlist and briefing mode.

## Globe, briefing, embed and export

The globe button in the map controls swaps the flat Natural Earth projection for an orthographic globe (`#view=globe`). Dragging rotates it with a short inertial glide on release, pinch and wheel zoom, and arrow keys rotate in 12° steps; the centre is written to the URL as `rot=lon,lat` so a shared link reopens on the same face of the planet. The globe always uses the 1:110m geometry because every path is re-projected on each frame.

Briefing mode (`#brief=1`, or the grid button in the map controls) asks for browser full screen, hides every piece of chrome and cycles through the live high-intensity conflicts followed by the watchlist, flying the map to each and showing a caption with the latest assessment. Space pauses, arrows step, Escape exits, and "Open" drops out of the briefing into that item's panel. Auto-advance is off under `prefers-reduced-motion`.

Adding `embed=1` to any link gives a chrome-less view for an iframe: no header, ticker or chips, just the map, legend, controls and a small badge linking back to the full app. The `Content-Security-Policy: frame-ancestors *` header in `vercel.json` allows framing from any site.

The download button rasterises the live SVG to a PNG (at up to 2× device pixel ratio) with the current legend and a strip naming the data month, the export date and the site. Computed styles are inlined first because the fills lean on CSS variables and `color-mix()`.

## Accessibility

Keyboard users reach everything: `/` focuses search, the map itself takes focus (arrows pan, `+` and `-` zoom, `0` resets), conflict markers are tabbable and open on Enter, and the detail panel's lists are plain buttons. Colour never carries meaning alone: intensity also sets marker size and is named in every label, suspended memberships are hatched, and compared blocs use stripes for overlap. Light and dark themes follow the system and can be overridden. Animations stop under `prefers-reduced-motion`. The Playwright suite runs axe-core scans and fails CI on serious or critical violations.

## Testing

```sh
pnpm test                    # unit and data integrity tests (vitest)
pnpm run build && pnpm run test:e2e   # Playwright: desktop + Pixel 7 against the production build
```

CI runs both on every push. To use a preinstalled Chromium locally, set `PW_CHROMIUM_PATH` to its binary.
