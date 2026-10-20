#!/usr/bin/env node
// Weekly research pass. For each conflict and unrest episode, asks Claude (with
// web search) for a fresh assessment; appends it to the JSON only when it is material,
// sourced and within the intensity guardrail. Also reviews bloc memberships,
// scans for conflicts the map is missing (reported, never auto-added) and for
// unrest it is missing (added when two independent sources back it, else reported).
//
// Usage:
//   node scripts/research/update.mjs [--only id,id] [--limit N] [--hot] [--dry-run] [--mock] [--report path]
//
// --hot re-checks only the hot list (high intensity, recently updated, or
// longest unchecked) plus the new-unrest scan, and skips the bloc, election
// and new-conflict scans; the daily workflow uses it.
//
// Needs Anthropic credentials unless --mock: ANTHROPIC_API_KEY, an `ant auth login` profile, or
// Workload Identity Federation env vars (ANTHROPIC_FEDERATION_RULE_ID, ANTHROPIC_ORGANIZATION_ID,
// ANTHROPIC_SERVICE_ACCOUNT_ID, ANTHROPIC_IDENTITY_TOKEN_FILE), which the SDK picks up on its own.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AssessmentOutputSchema, BlocReviewOutputSchema, BlocsFileSchema, ConflictsFileSchema, ElectionOutputSchema, ElectionsFileSchema, MONTH_OR_DATE, NewConflictsOutputSchema, NewUnrestOutputSchema, PARTIAL_DATE, UnrestFileSchema } from '../../src/data/schema.ts';
import { hotSelection } from './select.mjs';
import { clampIntensity, hostOf, isMaterialChange, verifySources } from '../../src/data/guards.ts';
import { mockClient } from './mock.mjs';
import { captureUnrest, MAX_AUTO_ADDS } from './capture.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const CONFLICTS_PATH = resolve(root, 'src/data/conflicts.json');
const BLOCS_PATH = resolve(root, 'src/data/blocs.json');
const ELECTIONS_PATH = resolve(root, 'src/data/elections.json');
const UNREST_PATH = resolve(root, 'src/data/unrest.json');
const COUNTRIES = JSON.parse(readFileSync(resolve(root, 'src/data/countries.generated.json'), 'utf8'));
/** Country centroid as [lon, lat], or null for an unknown code. */
const countryLonLat = (iso) => {
  const c = COUNTRIES.find((k) => k.cca3 === iso);
  return c && Array.isArray(c.latlng) && c.latlng.length === 2 ? [c.latlng[1], c.latlng[0]] : null;
};
/** Election entries re-checked per pass: those past or due within this many days, plus a few of the oldest-verified. */
const ELECTION_DUE_DAYS = 60;
const ELECTION_BUDGET = 12;

const MODEL = 'claude-opus-5-5';
const PRICE = { input: 4 / 1e6, output: 20 / 1e6, cacheRead: 0.2 / 1e6 }; // USD per token

const args = parseArgs(process.argv.slice(2));
const today = args.date ?? new Date().toISOString().slice(0, 10);

const conflicts = ConflictsFileSchema.parse(JSON.parse(readFileSync(CONFLICTS_PATH, 'utf8')));
const blocs = BlocsFileSchema.parse(JSON.parse(readFileSync(BLOCS_PATH, 'utf8')));
const elections = ElectionsFileSchema.parse(JSON.parse(readFileSync(ELECTIONS_PATH, 'utf8')));
const unrest = UnrestFileSchema.parse(JSON.parse(readFileSync(UNREST_PATH, 'utf8')));

const client = args.mock ? mockClient() : new Anthropic();
const usage = { input: 0, output: 0, cacheRead: 0, calls: 0 };
const report = { updated: [], unchanged: [], clamped: [], droppedSources: [], errors: [], blocChanges: [], blocNote: '', candidates: [], unrestCandidates: [], unrestAdded: [], elections: [], peace: [] };

const SYSTEM = `You are a research analyst maintaining a public geopolitics map. Today is ${today}.
Write in plain, neutral English with specific dates. Never invent events or URLs: every source you return must be a URL that appeared in your web search results. Prefer wire services, UN bodies and established conflict trackers (CFR, ACLED, Crisis Group, ISW). If nothing material happened since the previous assessment, say so by setting changed=false and restating the current situation briefly.`;

const UNREST_SCALE =
  'Intensity scale: high = nationwide mass mobilisation with lethal force or the government\'s survival in question; medium = sustained or recurring protests or riots with violence, or a coup consolidating; low = sporadic, localised or largely peaceful; latent = suppressed or dormant but unresolved.';

let selected = conflicts;
if (args.only) selected = conflicts.filter((c) => args.only.includes(c.id));
if (args.hot) selected = hotSelection(selected, today, { cap: 8 });
if (args.limit) selected = selected.slice(0, args.limit);

for (const conflict of selected) {
  try {
    await assessConflict(conflict);
  } catch (err) {
    report.errors.push(`${conflict.id}: ${describeError(err)}`);
  }
}

let selectedUnrest = unrest;
if (args.only) selectedUnrest = unrest.filter((u) => args.only.includes(u.id));
if (args.hot) selectedUnrest = hotSelection(selectedUnrest, today, { cap: 6 });
if (args.limit) selectedUnrest = selectedUnrest.slice(0, args.limit);
for (const episode of selectedUnrest) {
  try {
    await assessConflict(episode, 'unrest');
  } catch (err) {
    report.errors.push(`${episode.id}: ${describeError(err)}`);
  }
}

if (!args.only && !args.hot) {
  try {
    await reviewBlocs();
  } catch (err) {
    report.errors.push(`blocs: ${describeError(err)}`);
  }
  try {
    await scanForNewConflicts();
  } catch (err) {
    report.errors.push(`new-conflicts: ${describeError(err)}`);
  }
  try {
    await reviewElections();
  } catch (err) {
    report.errors.push(`elections: ${describeError(err)}`);
  }
}
// Riot waves can start and peak within a week, so the daily pass scans too.
if (!args.only) {
  try {
    await scanForNewUnrest();
  } catch (err) {
    report.errors.push(`new-unrest: ${describeError(err)}`);
  }
}

// Validate before writing; a schema failure means a bug above, not bad data.
ConflictsFileSchema.parse(conflicts);
BlocsFileSchema.parse(blocs);
ElectionsFileSchema.parse(elections);
UnrestFileSchema.parse(unrest);

if (!args.dryRun) {
  writeFileSync(CONFLICTS_PATH, JSON.stringify(conflicts, null, 2) + '\n');
  writeFileSync(BLOCS_PATH, JSON.stringify(blocs, null, 2) + '\n');
  writeFileSync(ELECTIONS_PATH, JSON.stringify(elections, null, 2) + '\n');
  writeFileSync(UNREST_PATH, JSON.stringify(unrest, null, 2) + '\n');
}

const md = renderReport();
if (args.report) writeFileSync(resolve(args.report), md);
console.log(md);
if (report.errors.length && !report.updated.length && !report.blocChanges.length) process.exitCode = 1;

// ---------------------------------------------------------------------------

/** Reassesses one conflict or (with kind 'unrest') one civil-unrest episode under the same guards. */
async function assessConflict(conflict, kind = 'conflict') {
  const previous = conflict.history[0];
  const scale = kind === 'unrest' ? UNREST_SCALE : 'Intensity scale: high = large-scale sustained combat; medium = regular deadly fighting; low = sporadic violence; latent = ceasefire or standoff.';
  const context = [
    kind === 'unrest' ? `Unrest: ${conflict.name} (id ${conflict.id})` : `Conflict: ${conflict.name} (id ${conflict.id})`,
    kind === 'unrest' ? `Kind: ${conflict.kind}, since ${conflict.since}. Countries: ${conflict.countries.join(', ')}. Parties: ${conflict.parties.join('; ')}.` : `Type: ${conflict.type}. Countries: ${conflict.countries.join(', ')}. Parties: ${conflict.parties.join('; ')}.`,
    kind === 'unrest' ? `Trigger: ${conflict.trigger}` : '',
    `Background: ${conflict.summary}`,
    `Previous assessment (${previous.date}, intensity ${previous.intensity}): ${previous.status}`,
    conflict.history[1] ? `Earlier assessment (${conflict.history[1].date}, intensity ${conflict.history[1].intensity}): ${conflict.history[1].status}` : '',
    kind === 'unrest' ? 'Peace process: not applicable; return an empty peaceEvents list.' : conflict.peace?.length ? `Peace process so far (newest first): ${conflict.peace.slice(0, 3).map((e) => `${e.date} ${e.kind}: ${e.summary}`).join(' | ')}` : 'Peace process: nothing on record.',
    '',
    `Task: search for developments between ${previous.date} and ${today}. Then return the structured assessment. ${scale} Keep status to 2-3 sentences (150-600 characters).`,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: zodOutputFormat(AssessmentOutputSchema) },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
    messages: [{ role: 'user', content: context }],
  });
  track(response);
  if (response.stop_reason === 'refusal') throw new Error(`refused (${response.stop_details?.category ?? 'unknown'})`);
  const out = response.parsed_output ?? parseTextFallback(response, AssessmentOutputSchema);
  if (!out) throw new Error('no parseable output');

  const seenUrls = collectSearchUrls(response);
  const { kept, dropped } = verifySources(out.sources, seenUrls);
  if (dropped.length) report.droppedSources.push({ id: conflict.id, dropped: dropped.map((s) => s.url) });
  if (kind === 'conflict') applyPeaceEvents(conflict, out.peaceEvents ?? [], seenUrls);

  const material = out.changed && isMaterialChange(previous, out.status, out.intensity);
  if (!material) {
    conflict.lastChecked = today;
    report.unchanged.push({ id: conflict.id, name: kind === 'unrest' ? `${conflict.name} (unrest)` : conflict.name, note: out.note });
    return;
  }
  if (kept.length === 0) throw new Error('assessment changed but no verifiable sources survived');
  const { intensity, clamped } = clampIntensity(previous.intensity, out.intensity);
  if (clamped) report.clamped.push({ id: conflict.id, from: previous.intensity, proposed: out.intensity, applied: intensity });

  const entry = { date: today, intensity, status: out.status.trim(), sources: kept.slice(0, 3), confidence: out.confidence };
  if (previous.date === today) conflict.history[0] = entry;
  else conflict.history.unshift(entry);
  delete conflict.lastChecked;
  report.updated.push({ id: conflict.id, name: kind === 'unrest' ? `${conflict.name} (unrest)` : conflict.name, from: previous.intensity, to: intensity, confidence: out.confidence, note: out.note, status: entry.status });
}

/** Appends sourced peace-process events the model found, skipping duplicates and unverifiable citations. */
export function applyPeaceEvents(conflict, events, seenUrls, log = report) {
  for (const e of events) {
    if (!MONTH_OR_DATE.test(e.date) || e.date.slice(0, 10) > today) continue;
    const summary = String(e.summary ?? '').trim();
    if (summary.length < 20) continue;
    const { kept } = verifySources([e.source], seenUrls);
    if (!kept.length) {
      log.droppedSources.push({ id: `${conflict.id}/peace`, dropped: [e.source?.url ?? '?'] });
      continue;
    }
    conflict.peace ??= [];
    const dup = conflict.peace.some((x) => x.date === e.date && (x.kind === e.kind || x.summary === summary));
    if (dup) continue;
    conflict.peace.unshift({ date: e.date, kind: e.kind, summary: summary.slice(0, 400), sources: kept.slice(0, 2) });
    conflict.peace.sort((a, b) => b.date.localeCompare(a.date));
    log.peace.push({ id: conflict.id, name: conflict.name, date: e.date, kind: e.kind, summary });
  }
}

async function reviewBlocs() {
  const listing = blocs
    .map((b) => {
      const by = {};
      for (const m of b.members) (by[m.status] ??= []).push(m.iso);
      return `${b.id} (${b.shortName}): ${Object.entries(by)
        .map(([k, v]) => `${k}=${v.join(' ')}`)
        .join('; ')}`;
    })
    .join('\n');
  const latest = blocs.flatMap((b) => b.changes.map((c) => c.date)).sort().at(-1) ?? '2020-01-01';
  const prompt = `Here are the current membership lists:\n${listing}\n\nSearch for formal membership changes (accessions, withdrawals, suspensions, reinstatements, frozen participation, new founding members, and candidate status granted, e.g. by the EU) that took effect between ${latest} and ${today}. Return only changes you can source to a page in your search results, with the exact date. Return an empty list if none.`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: zodOutputFormat(BlocReviewOutputSchema) },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 10 }],
    messages: [{ role: 'user', content: prompt }],
  });
  track(response);
  const out = response.parsed_output ?? parseTextFallback(response, BlocReviewOutputSchema);
  if (!out) throw new Error('no parseable output');
  report.blocNote = out.note;
  const seen = collectSearchUrls(response);

  for (const ch of out.changes) {
    const bloc = blocs.find((b) => b.id === ch.blocId);
    if (!bloc || !/^[A-Z]{3}$/.test(ch.iso) || !/^\d{4}-\d{2}-\d{2}$/.test(ch.date)) continue;
    if (bloc.changes.some((x) => x.date === ch.date && x.iso === ch.iso && x.change === ch.change)) continue;
    const { kept } = verifySources([ch.source], seen);
    if (!kept.length) {
      report.droppedSources.push({ id: `${bloc.id}/${ch.iso}`, dropped: [ch.source.url] });
      continue;
    }
    applyBlocChange(bloc, ch, kept[0]);
    report.blocChanges.push({ bloc: bloc.shortName, iso: ch.iso, change: ch.change, date: ch.date, note: ch.note });
  }
}

function applyBlocChange(bloc, ch, source) {
  const member = bloc.members.find((m) => m.iso === ch.iso);
  const statusFor = { joined: 'member', founded: 'member', reinstated: 'member', suspended: 'suspended', frozen: 'frozen', invited: 'invited', candidate: 'candidate' };
  if (ch.change === 'left') {
    bloc.members = bloc.members.filter((m) => m.iso !== ch.iso);
  } else if (member) {
    member.status = statusFor[ch.change];
    member.note = ch.note || member.note;
  } else {
    bloc.members.push({ iso: ch.iso, status: statusFor[ch.change], ...(ch.note ? { note: ch.note } : {}) });
  }
  bloc.changes.unshift({ date: ch.date, iso: ch.iso, change: ch.change, ...(ch.note ? { note: ch.note } : {}), source });
  bloc.changes.sort((a, b) => b.date.localeCompare(a.date));
  bloc.updated = today.slice(0, 7);
}

async function scanForNewConflicts() {
  const known = conflicts.map((c) => `${c.id}: ${c.name}`).join('\n');
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: zodOutputFormat(NewConflictsOutputSchema) },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
    messages: [
      {
        role: 'user',
        content: `The map already tracks:\n${known}\n\nSearch for armed conflicts or interstate crises that began or escalated sharply in the last 90 days and are NOT covered above. Return up to 3 candidates with one source each, or an empty list.`,
      },
    ],
  });
  track(response);
  const out = response.parsed_output ?? parseTextFallback(response, NewConflictsOutputSchema);
  if (!out) return;
  const seen = collectSearchUrls(response);
  for (const c of out.candidates) {
    const { kept } = verifySources([c.source], seen);
    if (kept.length) report.candidates.push({ ...c, source: kept[0] });
  }
}

/**
 * Finds unrest episodes the tracker is missing. A candidate backed by two
 * independent, verified, non-Wikipedia sources (and passing the other checks
 * in capture.mjs) is added as a new episode; anything weaker is reported for
 * a human with the reason.
 */
async function scanForNewUnrest() {
  const known = unrest.map((u) => `${u.id}: ${u.name} (${u.countries.join(', ')}, since ${u.since})`).join('\n');
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 20000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: zodOutputFormat(NewUnrestOutputSchema) },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 12 }],
    messages: [
      {
        role: 'user',
        content: [
          `The map already tracks these unrest episodes:\n${known}`,
          '',
          `Search for mass protest movements, riot waves, uprisings, coups or coup attempts, mutinies and violent crackdowns anywhere in the world, Europe, North America and other wealthy democracies included, that began or escalated sharply in the last 60 days, are not armed conflicts, and are NOT covered above. Start with broad searches (for example "riots" and "mass protests" with the current month and year), then run at least one follow-up search per candidate to find a second outlet.`,
          `Return up to ${MAX_AUTO_ADDS} candidates, or an empty list. For each: 2-4 sources from different outlets that appeared in your results (wire services, major broadcasters or national press; not Wikipedia), ISO 3166-1 alpha-3 country codes, the month the current wave began as YYYY-MM, the main city with its coordinates, the parties, a one-sentence trigger (20-300 characters), a 2-4 sentence background summary, and a dated status of 2-3 sentences (150-600 characters) covering events up to today. ${UNREST_SCALE}`,
        ].join('\n'),
      },
    ],
  });
  track(response);
  const out = response.parsed_output ?? parseTextFallback(response, NewUnrestOutputSchema);
  if (!out) return;
  const seen = collectSearchUrls(response);
  for (const c of out.candidates) {
    const { kept, dropped } = verifySources(c.sources ?? [], seen);
    if (dropped.length) report.droppedSources.push({ id: `new-unrest/${c.name}`, dropped: dropped.map((s) => s.url) });
    if (!kept.length) continue;
    const location = c.location ? [c.location.lon, c.location.lat] : null;
    const decision = report.unrestAdded.length >= MAX_AUTO_ADDS ? { add: false, reason: 'per-pass limit reached' } : captureUnrest({ ...c, location }, kept, unrest, today, countryLonLat);
    if (decision.add) {
      unrest.push(decision.episode);
      report.unrestAdded.push({ id: decision.episode.id, name: c.name, countries: decision.episode.countries, kind: c.kind, intensity: c.intensity, confidence: c.confidence, why: c.why, sources: decision.episode.history[0].sources });
    } else {
      report.unrestCandidates.push({ ...c, source: kept[0], reason: decision.reason });
    }
  }
}

/**
 * Keeps the elections table current. Each pass re-checks entries whose date
 * has passed, is unset, or falls within ELECTION_DUE_DAYS, then the entries
 * verified longest ago, up to ELECTION_BUDGET countries. An entry changes
 * only when the model cites a page from its own search results (or a trusted
 * host) and returns a well-formed date.
 */
export function electionsDue(rows, today, budget = ELECTION_BUDGET, dueDays = ELECTION_DUE_DAYS) {
  const horizon = new Date(new Date(today + 'T00:00:00Z').getTime() + dueDays * 86400000).toISOString().slice(0, 10);
  const due = rows.filter((r) => !r.date || r.date.padEnd(10, '0') <= horizon);
  const rest = rows.filter((r) => !due.includes(r)).sort((a, b) => a.verified.localeCompare(b.verified));
  return [...due, ...rest].slice(0, budget);
}

async function reviewElections() {
  const name = (iso) => COUNTRIES.find((c) => c.cca3 === iso)?.name ?? iso;
  for (const row of electionsDue(elections.rows, today)) {
    const prompt = [
      `Country: ${name(row.iso)} (${row.iso}).`,
      `Current entry: ${row.date ? `${row.type} election ${row.date}${row.deadline ? ' (deadline)' : ''}` : 'no date set'}${row.note ? `; note: ${row.note}` : ''}, last verified ${row.verified}.`,
      '',
      `Task: find the date of the next national election (presidential or legislative, whichever comes first) as of ${today}. If the listed date has passed, find the following one. Return the most precise date known (YYYY-MM-DD, YYYY-MM or YYYY) and cite the page in your search results that states it. If no election is scheduled, set known=false.`,
    ].join('\n');
    let response;
    try {
      response = await client.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        output_config: { effort: 'low', format: zodOutputFormat(ElectionOutputSchema) },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }],
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err) {
      report.errors.push(`elections/${row.iso}: ${describeError(err)}`);
      continue;
    }
    track(response);
    const out = response.parsed_output ?? parseTextFallback(response, ElectionOutputSchema);
    if (!out) continue;
    const { kept } = verifySources([out.source], collectSearchUrls(response));
    if (!kept.length) {
      report.droppedSources.push({ id: `elections/${row.iso}`, dropped: [out.source.url] });
      continue;
    }
    const date = out.known && PARTIAL_DATE.test(out.date) ? out.date : null;
    if (date && date.padEnd(10, '0') < today) continue; // a past date is not "next"
    const changed = date !== row.date || out.type !== row.type;
    row.date = date;
    row.type = out.type;
    if (out.deadline && date) row.deadline = true;
    else delete row.deadline;
    if (out.note) row.note = out.note.slice(0, 200);
    else delete row.note;
    row.sources = [kept[0], ...row.sources.filter((s) => s.url !== kept[0].url)].slice(0, 4);
    row.verified = today;
    report.elections.push({ iso: row.iso, name: name(row.iso), date, type: out.type, changed });
  }
}

// ---------------------------------------------------------------------------

function collectSearchUrls(response) {
  const urls = [];
  for (const block of response.content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) if (r.type === 'web_search_result' && r.url) urls.push(r.url);
    }
  }
  return urls;
}

function parseTextFallback(response, schema) {
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

function track(response) {
  usage.calls += 1;
  usage.input += response.usage?.input_tokens ?? 0;
  usage.output += response.usage?.output_tokens ?? 0;
  usage.cacheRead += response.usage?.cache_read_input_tokens ?? 0;
}

function estimatedCost() {
  return usage.input * PRICE.input + usage.output * PRICE.output + usage.cacheRead * PRICE.cacheRead;
}

function describeError(err) {
  if (err instanceof Anthropic.RateLimitError) return 'rate limited';
  if (err instanceof Anthropic.AuthenticationError) return 'authentication failed (check ANTHROPIC_API_KEY)';
  if (err instanceof Anthropic.APIError) return `API error ${err.status}: ${err.message}`;
  return err?.message ?? String(err);
}

function renderReport() {
  const lines = [];
  lines.push(args.hot ? `## Daily research pass ${today}` : `## Data refresh ${today}`, '');
  lines.push(`Model: ${MODEL}. Calls: ${usage.calls}. Tokens in/out: ${usage.input}/${usage.output}. Estimated cost: $${estimatedCost().toFixed(2)}.${args.mock ? ' (mock run)' : ''}`, '');
  lines.push(`### Updated assessments (${report.updated.length})`);
  for (const u of report.updated) {
    const move = u.from === u.to ? u.to : `${u.from} → ${u.to}`;
    lines.push(`- **${u.name}** (${u.id}) — ${move}, ${u.confidence} confidence${u.note ? ` — _${u.note}_` : ''}`);
    lines.push(`  ${u.status}`);
  }
  if (!report.updated.length) lines.push('- none');
  lines.push('', `### Checked, no material change (${report.unchanged.length})`);
  lines.push(report.unchanged.length ? report.unchanged.map((u) => `${u.name}${u.note ? ` (${u.note})` : ''}`).join('; ') : '- none');
  if (report.clamped.length) {
    lines.push('', '### Intensity moves clamped to one step (review)');
    for (const c of report.clamped) lines.push(`- ${c.id}: ${c.from} → proposed ${c.proposed}, applied ${c.applied}`);
  }
  lines.push('', `### Peace-process events added (${report.peace.length})`);
  for (const p of report.peace) lines.push(`- **${p.name}** ${p.date} ${p.kind}: ${p.summary}`);
  if (!report.peace.length) lines.push('- none');
  lines.push('', `### Bloc membership changes (${report.blocChanges.length})`);
  for (const b of report.blocChanges) lines.push(`- ${b.bloc}: ${b.iso} ${b.change} on ${b.date}${b.note ? ` — ${b.note}` : ''}`);
  if (!report.blocChanges.length) lines.push('- none');
  if (report.blocNote) lines.push(`- _${report.blocNote}_`);
  const changedElections = report.elections.filter((e) => e.changed);
  lines.push('', `### Elections re-checked (${report.elections.length}, ${changedElections.length} changed)`);
  for (const e of report.elections) lines.push(`- ${e.name}: ${e.date ? `${e.type} ${e.date}` : 'no date set'}${e.changed ? ' (changed)' : ''}`);
  if (!report.elections.length) lines.push('- none');
  if (report.candidates.length) {
    lines.push('', '### Possible new conflicts (not added; needs a human)');
    for (const c of report.candidates) lines.push(`- **${c.name}** (${c.countries.join(', ')}; ${c.type}, ${c.intensity}) — ${c.why} [source](${c.source.url})`);
  }
  if (report.unrestAdded.length) {
    lines.push('', `### New unrest episodes added (${report.unrestAdded.length})`);
    for (const c of report.unrestAdded) lines.push(`- **${c.name}** (${c.id}; ${c.countries.join(', ')}; ${c.kind}, ${c.intensity}, ${c.confidence} confidence) — ${c.why} Sources: ${c.sources.map((s) => `[${hostOf(s.url)}](${s.url})`).join(', ')}`);
  }
  if (report.unrestCandidates.length) {
    lines.push('', '### Possible new unrest episodes (not added; needs a human)');
    for (const c of report.unrestCandidates) lines.push(`- **${c.name}** (${c.countries.join(', ')}; ${c.kind}, ${c.intensity}) — ${c.why} Not added: ${c.reason}. [source](${c.source.url})`);
  }
  if (report.droppedSources.length) {
    lines.push('', '### Sources dropped as unverifiable');
    for (const d of report.droppedSources) lines.push(`- ${d.id}: ${d.dropped.join(', ')}`);
  }
  if (report.errors.length) {
    lines.push('', '### Errors');
    for (const e of report.errors) lines.push(`- ${e}`);
  }
  return lines.join('\n') + '\n';
}

function parseArgs(argv) {
  const out = { only: null, limit: 0, hot: false, dryRun: false, mock: false, report: null, date: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') out.only = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--hot') out.hot = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--mock') out.mock = true;
    else if (a === '--report') out.report = argv[++i];
    else if (a === '--date') out.date = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}
