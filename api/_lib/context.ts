// Builds the dataset context Ask ATLAS answers from. Plain data in, one
// deterministic string out, so the prompt prefix is byte-stable and cacheable.
import conflicts from '../../src/data/conflicts.json' with { type: 'json' };
import blocs from '../../src/data/blocs.json' with { type: 'json' };
import sanctions from '../../src/data/sanctions.generated.json' with { type: 'json' };
import elections from '../../src/data/elections.json' with { type: 'json' };
import nuclear from '../../src/data/nuclear.json' with { type: 'json' };
import chokepoints from '../../src/data/chokepoints.json' with { type: 'json' };
import military from '../../src/data/military.json' with { type: 'json' };
import countries from '../../src/data/countries.generated.json' with { type: 'json' };

type Source = { name: string; url: string };

const NAME = new Map((countries as Array<{ cca3: string; name: string }>).map((c) => [c.cca3, c.name]));
const name = (iso: string) => NAME.get(iso) ?? iso;
const src = (list: Source[]) => list.map((s) => `${s.name} <${s.url}>`).join('; ');

export function buildContext(): string {
  const lines: string[] = [];
  lines.push('# ATLAS dataset', '', 'Every fact below carries an id in [brackets]. Cite the ids you rely on. Sources are given as name <url>.', '');

  lines.push('## Conflicts');
  for (const c of conflicts as Array<Record<string, unknown>>) {
    const history = (c.history as Array<{ date: string; intensity: string; status: string; sources: Source[] }>).slice().sort((a, b) => b.date.localeCompare(a.date));
    const latest = history[0]!;
    lines.push(`[conflict:${c.id}] ${c.name} (${c.type}; since ${c.since}; countries ${(c.countries as string[]).map(name).join(', ')})`);
    lines.push(`  parties: ${(c.parties as string[]).join('; ')}`);
    lines.push(`  background: ${c.summary}`);
    lines.push(`  assessment ${latest.date} (${latest.intensity}): ${latest.status} — sources: ${src(latest.sources)}`);
    if (history[1]) lines.push(`  earlier ${history[1].date} (${history[1].intensity}): ${history[1].status}`);
    for (const a of (c.actors as Array<{ name: string; side: string; backers?: Array<{ name: string; support: string }> }> | undefined) ?? []) {
      lines.push(`  actor (${a.side}): ${a.name}${a.backers?.length ? ` — backed by ${a.backers.map((b) => `${b.name} (${b.support})`).join(', ')}` : ''}`);
    }
    for (const p of (c.peace as Array<{ date: string; kind: string; summary: string; sources: Source[] }> | undefined) ?? []) lines.push(`  peace ${p.date} ${p.kind}: ${p.summary} — ${src(p.sources)}`);
  }

  lines.push('', '## Blocs');
  for (const b of blocs as Array<Record<string, unknown>>) {
    const members = b.members as Array<{ iso: string; status: string }>;
    const full = members.filter((m) => m.status === 'member').map((m) => name(m.iso));
    const other = members.filter((m) => m.status !== 'member').map((m) => `${name(m.iso)} (${m.status})`);
    lines.push(`[bloc:${b.id}] ${b.name} (${b.shortName}; founded ${b.founded}; verified ${b.updated}): ${b.description}`);
    lines.push(`  members (${full.length}): ${full.join(', ')}${other.length ? `; other: ${other.join(', ')}` : ''}`);
    for (const ch of (b.changes as Array<{ date: string; iso: string; change: string; note?: string }>).slice(0, 6)) lines.push(`  change ${ch.date}: ${name(ch.iso)} ${ch.change}${ch.note ? ` — ${ch.note}` : ''}`);
    lines.push(`  sources: ${src(b.sources as Source[])}`);
  }

  lines.push('', `## Sanctions (country-level regimes; fetched ${(sanctions as { fetchedAt: string }).fetchedAt})`);
  for (const r of (sanctions as { rows: Array<{ iso: string; regimes: Array<{ authority: string; name: string; url: string }> }> }).rows) {
    lines.push(`[sanctions:${r.iso}] ${name(r.iso)}: ${r.regimes.map((x) => `${x.authority}: ${x.name} <${x.url}>`).join('; ')}`);
  }

  lines.push('', '## Next national elections');
  for (const e of (elections as { rows: Array<{ iso: string; date: string | null; type: string; note?: string; sources: Source[]; verified: string }> }).rows) {
    lines.push(`[election:${e.iso}] ${name(e.iso)}: ${e.type} ${e.date ?? 'no date set'}${e.note ? ` (${e.note})` : ''}; verified ${e.verified}; ${src(e.sources.slice(0, 1))}`);
  }

  lines.push('', `## Nuclear status (verified ${(nuclear as { verified: string }).verified})`);
  for (const s of (nuclear as { statuses: Array<{ iso: string; status: string; note: string; sources: Source[] }> }).statuses) lines.push(`[nuclear:${s.iso}] ${name(s.iso)}: ${s.status} — ${s.note} — ${src(s.sources)}`);
  lines.push(`  umbrella: every full NATO member is under the alliance's nuclear deterrent.`);
  for (const t of (nuclear as { tests: Array<{ iso: string; date: string; note: string }> }).tests) lines.push(`  test ${t.date} ${name(t.iso)}: ${t.note}`);

  lines.push('', `## Maritime chokepoints (verified ${(chokepoints as { verified: string }).verified})`);
  for (const c of (chokepoints as { chokepoints: Array<{ id: string; name: string; between: string; carries: string; conflicts: string[]; history: Array<{ date: string; status: string; summary: string; sources: Source[] }> }> }).chokepoints) {
    const now = c.history[0]!;
    lines.push(`[chokepoint:${c.id}] ${c.name} (${c.between}): ${c.carries} Status ${now.date} ${now.status}: ${now.summary} — ${src(now.sources)}${c.conflicts.length ? `; linked conflicts: ${c.conflicts.join(', ')}` : ''}`);
  }

  lines.push('', `## Foreign military presence (verified ${(military as { verified: string }).verified})`);
  for (const p of (military as { presence: Array<{ host: string; operator: string; kind: string; name: string; note: string; source: Source; ended?: string }> }).presence) {
    if (p.ended) continue;
    lines.push(`[presence:${p.operator}:${p.host}] ${name(p.operator)} in ${name(p.host)} (${p.kind}): ${p.name}. ${p.note} — ${src([p.source])}`);
  }
  return lines.join('\n') + '\n';
}
