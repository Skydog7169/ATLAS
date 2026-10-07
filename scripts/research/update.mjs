#!/usr/bin/env node
// Weekly research pass. For each conflict, asks Claude (with web search) for
// a fresh assessment; appends it to conflicts.json only when it is material,
// sourced and within the intensity guardrail. Also reviews bloc memberships
// and scans for conflicts the map is missing (reported, never auto-added).
//
// Usage:
//   node scripts/research/update.mjs [--only id,id] [--limit N] [--dry-run] [--mock] [--report path]
//
// Needs ANTHROPIC_API_KEY (or an `ant auth login` profile) unless --mock.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AssessmentOutputSchema, BlocReviewOutputSchema, BlocsFileSchema, ConflictsFileSchema, NewConflictsOutputSchema } from '../../src/data/schema.ts';
import { clampIntensity, isMaterialChange, verifySources } from '../../src/data/guards.ts';
import { mockClient } from './mock.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const CONFLICTS_PATH = resolve(root, 'src/data/conflicts.json');
const BLOCS_PATH = resolve(root, 'src/data/blocs.json');

const MODEL = 'claude-opus-5-5';
const PRICE = { input: 4 / 1e6, output: 20 / 1e6, cacheRead: 0.2 / 1e6 }; // USD per token

const args = parseArgs(process.argv.slice(2));
const today = args.date ?? new Date().toISOString().slice(0, 10);

const conflicts = ConflictsFileSchema.parse(JSON.parse(readFileSync(CONFLICTS_PATH, 'utf8')));
const blocs = BlocsFileSchema.parse(JSON.parse(readFileSync(BLOCS_PATH, 'utf8')));

const client = args.mock ? mockClient() : new Anthropic();
const usage = { input: 0, output: 0, cacheRead: 0, calls: 0 };
const report = { updated: [], unchanged: [], clamped: [], droppedSources: [], errors: [], blocChanges: [], blocNote: '', candidates: [] };

const SYSTEM = `You are a research analyst maintaining a public geopolitics map. Today is ${today}.
Write in plain, neutral English with specific dates. Never invent events or URLs: every source you return must be a URL that appeared in your web search results. Prefer wire services, UN bodies and established conflict trackers (CFR, ACLED, Crisis Group, ISW). If nothing material happened since the previous assessment, say so by setting changed=false and restating the current situation briefly.`;

let selected = conflicts;
if (args.only) selected = conflicts.filter((c) => args.only.includes(c.id));
if (args.limit) selected = selected.slice(0, args.limit);

for (const conflict of selected) {
  try {
    await assessConflict(conflict);
  } catch (err) {
    report.errors.push(`${conflict.id}: ${describeError(err)}`);
  }
}

if (!args.only) {
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
}

// Validate before writing; a schema failure means a bug above, not bad data.
ConflictsFileSchema.parse(conflicts);
BlocsFileSchema.parse(blocs);

if (!args.dryRun) {
  writeFileSync(CONFLICTS_PATH, JSON.stringify(conflicts, null, 2) + '\n');
  writeFileSync(BLOCS_PATH, JSON.stringify(blocs, null, 2) + '\n');
}

const md = renderReport();
if (args.report) writeFileSync(resolve(args.report), md);
console.log(md);
if (report.errors.length && !report.updated.length && !report.blocChanges.length) process.exitCode = 1;

// ---------------------------------------------------------------------------

async function assessConflict(conflict) {
  const previous = conflict.history[0];
  const context = [
    `Conflict: ${conflict.name} (id ${conflict.id})`,
    `Type: ${conflict.type}. Countries: ${conflict.countries.join(', ')}. Parties: ${conflict.parties.join('; ')}.`,
    `Background: ${conflict.summary}`,
    `Previous assessment (${previous.date}, intensity ${previous.intensity}): ${previous.status}`,
    conflict.history[1] ? `Earlier assessment (${conflict.history[1].date}, intensity ${conflict.history[1].intensity}): ${conflict.history[1].status}` : '',
    '',
    `Task: search for developments between ${previous.date} and ${today}. Then return the structured assessment. Intensity scale: high = large-scale sustained combat; medium = regular deadly fighting; low = sporadic violence; latent = ceasefire or standoff. Keep status to 2-3 sentences (150-600 characters).`,
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

  const material = out.changed && isMaterialChange(previous, out.status, out.intensity);
  if (!material) {
    conflict.lastChecked = today;
    report.unchanged.push({ id: conflict.id, name: conflict.name, note: out.note });
    return;
  }
  if (kept.length === 0) throw new Error('assessment changed but no verifiable sources survived');
  const { intensity, clamped } = clampIntensity(previous.intensity, out.intensity);
  if (clamped) report.clamped.push({ id: conflict.id, from: previous.intensity, proposed: out.intensity, applied: intensity });

  const entry = { date: today, intensity, status: out.status.trim(), sources: kept.slice(0, 3), confidence: out.confidence };
  if (previous.date === today) conflict.history[0] = entry;
  else conflict.history.unshift(entry);
  delete conflict.lastChecked;
  report.updated.push({ id: conflict.id, name: conflict.name, from: previous.intensity, to: intensity, confidence: out.confidence, note: out.note, status: entry.status });
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
  const prompt = `Here are the current membership lists:\n${listing}\n\nSearch for formal membership changes (accessions, withdrawals, suspensions, reinstatements, frozen participation, new founding members) that took effect between ${latest} and ${today}. Return only changes you can source to a page in your search results, with the exact date. Return an empty list if none.`;

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
  const statusFor = { joined: 'member', founded: 'member', reinstated: 'member', suspended: 'suspended', frozen: 'frozen', invited: 'invited' };
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
  lines.push(`## Data refresh ${today}`, '');
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
  lines.push('', `### Bloc membership changes (${report.blocChanges.length})`);
  for (const b of report.blocChanges) lines.push(`- ${b.bloc}: ${b.iso} ${b.change} on ${b.date}${b.note ? ` — ${b.note}` : ''}`);
  if (!report.blocChanges.length) lines.push('- none');
  if (report.blocNote) lines.push(`- _${report.blocNote}_`);
  if (report.candidates.length) {
    lines.push('', '### Possible new conflicts (not added; needs a human)');
    for (const c of report.candidates) lines.push(`- **${c.name}** (${c.countries.join(', ')}; ${c.type}, ${c.intensity}) — ${c.why} [source](${c.source.url})`);
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
  const out = { only: null, limit: 0, dryRun: false, mock: false, report: null, date: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') out.only = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--mock') out.mock = true;
    else if (a === '--report') out.report = argv[++i];
    else if (a === '--date') out.date = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}
