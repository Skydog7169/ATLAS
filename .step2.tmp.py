def patch(path, pairs):
    s = open(path).read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:80], s.count(old))
        s = s.replace(old, new)
    open(path, 'w').write(s)

# ---------------- App.tsx
patch('src/App.tsx', [
("import { ACLED, acledColor, acledSummary } from './lib/acled';",
 "import { ACLED, acledColor, acledSummary } from './lib/acled';\nimport { UNREST, UNREST_BY_ID } from './data/unrest';\nimport { UNREST_COLOR, UNREST_MARKER_PREFIX, UNREST_RADIUS, UNREST_KIND_LABEL, unrestColor, unrestSummary } from './lib/unrest';"),
("import { INTENSITY_COLOR, INTENSITY_RADIUS } from './lib/labels';", "import { INTENSITY_COLOR, INTENSITY_LABEL, INTENSITY_RADIUS } from './lib/labels';"),
("  { id: 'chokepoints', label: 'Chokepoints', hint: 'Eight maritime passages with dated status' },",
 "  { id: 'chokepoints', label: 'Chokepoints', hint: 'Eight maritime passages with dated status' },\n  { id: 'unrest', label: 'Civil unrest', hint: 'Protest movements, riots, uprisings, coups and crackdowns' },"),
("      if (layer === 'trade') return { fill: tradeColor(iso) };", "      if (layer === 'trade') return { fill: tradeColor(iso) };\n      if (layer === 'unrest') return { fill: unrestColor(iso) };"),
("""    if (layer === 'chokepoints') {
      for (const cp of CHOKEPOINTS) {""",
"""    if (layer === 'unrest') {
      for (const u of [...UNREST].sort((a, b) => INTENSITY_ORDER[a.intensity] - INTENSITY_ORDER[b.intensity])) {
        out.push({ id: UNREST_MARKER_PREFIX + u.id, lonLat: u.location, color: UNREST_COLOR[u.intensity], radius: UNREST_RADIUS[u.intensity], label: `${u.name}: ${UNREST_KIND_LABEL[u.kind]}, ${INTENSITY_LABEL[u.intensity].toLowerCase()}`, shape: 'triangle', pulse: u.intensity === 'high' });
      }
    }
    if (layer === 'chokepoints') {
      for (const cp of CHOKEPOINTS) {"""),
("  const selectedMarkerId = selection?.kind === 'conflict' ? selection.id : selection?.kind === 'chokepoint' ? CHOKEPOINT_MARKER_PREFIX + selection.id : null;",
 "  const selectedMarkerId = selection?.kind === 'conflict' ? selection.id : selection?.kind === 'chokepoint' ? CHOKEPOINT_MARKER_PREFIX + selection.id : selection?.kind === 'unrest' ? UNREST_MARKER_PREFIX + selection.id : null;"),
("""  const onMarkerClick = useCallback(
    (id: string) => (id.startsWith(CHOKEPOINT_MARKER_PREFIX) ? selectChokepoint(id.slice(CHOKEPOINT_MARKER_PREFIX.length)) : selectConflict(id)),
    [selectChokepoint, selectConflict],
  );""",
"""  const selectUnrest = useCallback(
    (id: string) => {
      const u = UNREST_BY_ID.get(id);
      update({ layer: 'unrest', selection: { kind: 'unrest', id } });
      if (u) setFocus({ kind: 'point', lonLat: u.location, scale: 3.5 });
    },
    [update],
  );

  const onMarkerClick = useCallback(
    (id: string) => {
      if (id.startsWith(CHOKEPOINT_MARKER_PREFIX)) selectChokepoint(id.slice(CHOKEPOINT_MARKER_PREFIX.length));
      else if (id.startsWith(UNREST_MARKER_PREFIX)) selectUnrest(id.slice(UNREST_MARKER_PREFIX.length));
      else selectConflict(id);
    },
    [selectChokepoint, selectConflict, selectUnrest],
  );"""),
("""      if (hit.kind === 'country') selectCountry(hit.id);
      else if (hit.kind === 'bloc') selectBloc(hit.id);
      else selectConflict(hit.id);
    },
    [selectCountry, selectBloc, selectConflict],""",
"""      if (hit.kind === 'country') selectCountry(hit.id);
      else if (hit.kind === 'bloc') selectBloc(hit.id);
      else if (hit.kind === 'unrest') selectUnrest(hit.id);
      else selectConflict(hit.id);
    },
    [selectCountry, selectBloc, selectConflict, selectUnrest],"""),
("    if (layer === 'trade') return tradeSummary(hover.iso) ?? 'No WITS export data';",
 "    if (layer === 'trade') return tradeSummary(hover.iso) ?? 'No WITS export data';\n    if (layer === 'unrest') return unrestSummary(hover.iso) ?? 'No tracked unrest';"),
("""      } else {
        const b = BLOC_BY_ID.get(w.id);""",
"""      } else if (w.kind === 'unrest') {
        const u = UNREST_BY_ID.get(w.id);
        if (u) out.push({ id: u.id, kind: 'unrest', title: u.name, eyebrow: `Watchlist · ${UNREST_KIND_LABEL[u.kind].toLowerCase()}`, detail: u.status, color: UNREST_COLOR[u.intensity], conflict: u });
      } else {
        const b = BLOC_BY_ID.get(w.id);"""),
("""      } else {
        update({ mode: 'blocs', bloc: item.id, vs: null, selection: null });""",
"""      } else if (item.kind === 'unrest') {
        update({ layer: 'unrest', selection: null });
        if (item.conflict) setFocus({ kind: 'point', lonLat: item.conflict.location, scale: 3.5 });
      } else {
        update({ mode: 'blocs', bloc: item.id, vs: null, selection: null });"""),
("      else update({ brief: false, mode: 'blocs', bloc: item.id, selection: { kind: 'bloc', id: item.id } });",
 "      else if (item.kind === 'unrest') update({ brief: false, layer: 'unrest', selection: { kind: 'unrest', id: item.id } });\n      else update({ brief: false, mode: 'blocs', bloc: item.id, selection: { kind: 'bloc', id: item.id } });"),
("""  const conflictColor = useCallback((id: string) => {
    const c = CONFLICT_BY_ID.get(id);
    return c ? INTENSITY_COLOR[c.intensity] : 'var(--fg-muted)';
  }, []);""",
"""  const conflictColor = useCallback((id: string) => {
    const c = CONFLICT_BY_ID.get(id);
    if (c) return INTENSITY_COLOR[c.intensity];
    const u = UNREST_BY_ID.get(id);
    return u ? UNREST_COLOR[u.intensity] : 'var(--fg-muted)';
  }, []);"""),
("<SinceLastVisit onSelectConflict={selectConflict} onSelectBloc={selectBloc} onOpenChanges",
 "<SinceLastVisit onSelectConflict={selectConflict} onSelectBloc={selectBloc} onSelectUnrest={selectUnrest} onOpenChanges"),
("        <Ticker onSelectConflict={selectConflict} onSelectBloc={selectBloc} />",
 "        <Ticker onSelectConflict={selectConflict} onSelectBloc={selectBloc} onSelectUnrest={selectUnrest} />"),
("              onSelectChokepoint={selectChokepoint}", "              onSelectChokepoint={selectChokepoint}\n              onSelectUnrest={selectUnrest}"),
])

# ---------------- Briefing.tsx
patch('src/components/Briefing.tsx', [
("import type { Conflict } from '../data/types';", "import type { HistoryEntry } from '../data/types';"),
("  kind: 'conflict' | 'country' | 'bloc';", "  kind: 'conflict' | 'country' | 'bloc' | 'unrest';"),
("  conflict?: Conflict;", "  /** A conflict or unrest record: the newest assessment is shown as the caption. */\n  conflict?: { history: HistoryEntry[]; location: [number, number] };"),
])

# ---------------- Ticker / SinceLastVisit
for f in ['src/components/Ticker.tsx', 'src/components/SinceLastVisit.tsx']:
    patch(f, [
    ("  onSelectBloc: (id: string) => void;", "  onSelectBloc: (id: string) => void;\n  onSelectUnrest: (id: string) => void;"),
    ("(it.kind === 'conflict' ? onSelectConflict(it.id) : onSelectBloc(it.id));", "(it.kind === 'conflict' ? onSelectConflict(it.id) : it.kind === 'unrest' ? onSelectUnrest(it.id) : onSelectBloc(it.id));"),
    ])
s = open('src/components/Ticker.tsx').read()
assert s.count("onSelectConflict, onSelectBloc") >= 1
s = s.replace("onSelectConflict, onSelectBloc }", "onSelectConflict, onSelectBloc, onSelectUnrest }", 1)
s = s.replace("{it.kind === 'conflict' ? INTENSITY_LABEL[it.intensity!] : 'Membership'}", "{it.intensity ? INTENSITY_LABEL[it.intensity] : 'Membership'}")
open('src/components/Ticker.tsx', 'w').write(s)
s = open('src/components/SinceLastVisit.tsx').read()
s = s.replace("onSelectConflict, onSelectBloc,", "onSelectConflict, onSelectBloc, onSelectUnrest,", 1)
open('src/components/SinceLastVisit.tsx', 'w').write(s)

# ---------------- Search.tsx
patch('src/components/Search.tsx', [
("<span className=\"kind\">{hit.kind === 'bloc' ? hit.sub : hit.kind}</span>", "<span className=\"kind\">{hit.kind === 'bloc' || hit.kind === 'unrest' ? hit.sub : hit.kind}</span>"),
])

# ---------------- WorldMap / GlobeMap: triangle markers
patch('src/components/WorldMap.tsx', [
("  shape?: 'circle' | 'diamond';", "  shape?: 'circle' | 'diamond' | 'triangle';"),
("export interface LayerProps {", "/** An upward triangle centred on the origin, sized to match a circle of radius r. */\nexport function triPath(r: number): string {\n  const h = r * 1.25;\n  return `M0 ${-h}L${h * 0.95} ${h * 0.6}L${-h * 0.95} ${h * 0.6}Z`;\n}\n\nexport interface LayerProps {"),
("                  className={'marker' + (mk.pulse ? ' pulse' : '') + (mk.shape === 'diamond' ? ' diamond' : '')}", "                  className={'marker' + (mk.pulse ? ' pulse' : '') + (mk.shape && mk.shape !== 'circle' ? ' ' + mk.shape : '')}"),
("                  {mk.shape === 'diamond' ? (", "                  {mk.shape === 'triangle' ? (\n                    <>\n                      <path className=\"ring\" d={triPath(r + 3)} stroke={mk.color} />\n                      <path className=\"core\" d={triPath(r)} fill={mk.color} filter=\"url(#marker-glow)\" />\n                    </>\n                  ) : mk.shape === 'diamond' ? ("),
])
patch('src/components/GlobeMap.tsx', [
("import { CountryLayer, type Focus, type MapMarker, type CountryFill } from './WorldMap';", "import { CountryLayer, triPath, type Focus, type MapMarker, type CountryFill } from './WorldMap';"),
("                  className={'marker' + (mk.pulse ? ' pulse' : '') + (mk.shape === 'diamond' ? ' diamond' : '')}", "                  className={'marker' + (mk.pulse ? ' pulse' : '') + (mk.shape && mk.shape !== 'circle' ? ' ' + mk.shape : '')}"),
("                  {mk.shape === 'diamond' ? (", "                  {mk.shape === 'triangle' ? (\n                    <>\n                      <path className=\"ring\" d={triPath(r + 3)} stroke={mk.color} />\n                      <path className=\"core\" d={triPath(r)} fill={mk.color} filter=\"url(#marker-glow)\" />\n                    </>\n                  ) : mk.shape === 'diamond' ? ("),
])

# ---------------- Legend.tsx: unrest
patch('src/components/Legend.tsx', [
("import { CHOKEPOINTS_FILE, CHOKEPOINT_COLOR, CHOKEPOINT_STATUSES, CHOKEPOINT_STATUS_LABEL } from '../lib/chokepoints';",
 "import { CHOKEPOINTS_FILE, CHOKEPOINT_COLOR, CHOKEPOINT_STATUSES, CHOKEPOINT_STATUS_LABEL } from '../lib/chokepoints';\nimport { UNREST } from '../data/unrest';\nimport { UNREST_COLOR, UNREST_VERIFIED } from '../lib/unrest';"),
("  if (layer === 'acled') {",
"""  if (layer === 'unrest') {
    return (
      <aside className="legend frame" aria-label="Legend">
        <h3>Civil unrest · {UNREST.length}</h3>
        <ul>
          {INTENSITIES.map((i) => (
            <li key={i}>
              <span className="swatch triangle" style={{ background: UNREST_COLOR[i] }} />
              {INTENSITY_LABEL[i]}
            </li>
          ))}
        </ul>
        <div className="note">
          Protest movements, riots, uprisings, coups, mutinies and crackdowns that are not armed conflicts, each with dated, sourced assessments. Countries are tinted by their most intense episode. Curated and reassessed weekly; newest assessment {formatDate(UNREST_VERIFIED)}.
        </div>
      </aside>
    );
  }
  if (layer === 'acled') {"""),
])

# ---------------- DetailPanel.tsx
patch('src/components/DetailPanel.tsx', [
("import { CONFLICTS, CONFLICT_BY_ID } from '../data/conflicts';", "import { CONFLICTS, CONFLICT_BY_ID } from '../data/conflicts';\nimport { UNREST_BY_ID } from '../data/unrest';\nimport { UNREST_COLOR, UNREST_KIND_LABEL } from '../lib/unrest';"),
("import type { Bloc, Conflict, HistoryEntry, MembershipStatus } from '../data/types';", "import type { Bloc, Conflict, HistoryEntry, MembershipStatus, Unrest } from '../data/types';"),
("  onSelectChokepoint: (id: string) => void;\n}", "  onSelectChokepoint: (id: string) => void;\n  onSelectUnrest: (id: string) => void;\n}"),
("            <button className=\"inline-link\" onClick={() => (it.kind === 'conflict' ? props.onSelectConflict(it.id) : props.onSelectBloc(it.id))}>",
 "            <button className=\"inline-link\" onClick={() => (it.kind === 'conflict' ? props.onSelectConflict(it.id) : it.kind === 'unrest' ? props.onSelectUnrest(it.id) : props.onSelectBloc(it.id))}>"),
("            <span className=\"label\"> · {it.kind === 'conflict' ? INTENSITY_LABEL[it.intensity!] : 'Membership'}</span>",
 "            <span className=\"label\"> · {it.intensity ? INTENSITY_LABEL[it.intensity] : 'Membership'}{it.kind === 'unrest' ? ' (unrest)' : ''}</span>"),
("""                    {r.conflictId ? (
                      <button onClick={() => props.onSelectConflict(r.conflictId!)}>""",
"""                    {r.conflictId || r.unrestId ? (
                      <button onClick={() => (r.conflictId ? props.onSelectConflict(r.conflictId) : props.onSelectUnrest(r.unrestId!))}>"""),
("    { kind: 'conflict' as const, title: 'Conflicts', name: (id: string) => CONFLICT_BY_ID.get(id)?.name ?? id, open: props.onSelectConflict },",
 "    { kind: 'conflict' as const, title: 'Conflicts', name: (id: string) => CONFLICT_BY_ID.get(id)?.name ?? id, open: props.onSelectConflict },\n    { kind: 'unrest' as const, title: 'Unrest', name: (id: string) => UNREST_BY_ID.get(id)?.name ?? id, open: props.onSelectUnrest },"),
("                      {g.kind === 'bloc' && <span className=\"dot\" style={{ width: 10, height: 10, borderRadius: '50%', background: BLOC_BY_ID.get(it.id)?.color }} />}",
 "                      {g.kind === 'bloc' && <span className=\"dot\" style={{ width: 10, height: 10, borderRadius: '50%', background: BLOC_BY_ID.get(it.id)?.color }} />}\n                      {g.kind === 'unrest' && <span className=\"dot\" style={{ width: 10, height: 10, borderRadius: '50%', background: UNREST_COLOR[UNREST_BY_ID.get(it.id)?.intensity ?? 'latent'] }} />}"),
("          else if (kind === 'chokepoint') props.onSelectChokepoint(key);", "          else if (kind === 'chokepoint') props.onSelectChokepoint(key);\n          else if (kind === 'unrest') props.onSelectUnrest(key);"),
("""  } else if (selection.kind === 'conflict') {
    const c = CONFLICT_BY_ID.get(selection.id);
    body = c ? <ConflictView conflict={c} props={props} /> : null;
  }""",
"""  } else if (selection.kind === 'conflict') {
    const c = CONFLICT_BY_ID.get(selection.id);
    body = c ? <ConflictView conflict={c} props={props} /> : null;
  } else if (selection.kind === 'unrest') {
    const u = UNREST_BY_ID.get(selection.id);
    body = u ? <UnrestView unrest={u} props={props} /> : null;
  }"""),
("""const WINDOWS = [
  { days: 30, label: '30 days' },""",
"""function UnrestView({ unrest, props }: { unrest: Unrest; props: Props }) {
  return (
    <>
      <div className="panel-head">
        <h2>
          <span className="eyebrow">{UNREST_KIND_LABEL[unrest.kind]}</span>
          {unrest.name}
        </h2>
        <StarButton item={{ kind: 'unrest', id: unrest.id }} name={unrest.name} />
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="panel-body">
        <div className="badges">
          <span className="badge" style={{ ['--badge-color' as string]: UNREST_COLOR[unrest.intensity] }}>
            <span className="dot" /> {INTENSITY_LABEL[unrest.intensity]}
          </span>
          <span className="badge muted">Since {formatMonth(unrest.since)}</span>
        </div>
        <h4>Parties</h4>
        <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
          {unrest.parties.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h4 id="unrest-trigger">Trigger</h4>
        <p>{unrest.trigger}</p>
        <h4>Background</h4>
        <p>{unrest.summary}</p>
        <h4 id="unrest-assessments">Assessments</h4>
        <HistoryList history={unrest.history} highlight={null} />
        <h4>Countries</h4>
        <div className="badges">
          {unrest.countries.map((iso) => (
            <button key={iso} className="badge" onClick={() => props.onSelectCountry(iso)} style={{ cursor: 'pointer' }}>
              {countryName(iso)}
            </button>
          ))}
        </div>
        <div className="panel-actions">
          <ShareButton />
        </div>
        <div className="updated">
          Latest assessment verified {formatDate(unrest.updated)}.
          {unrest.lastChecked && unrest.lastChecked > unrest.updated ? ` Re-checked ${formatDate(unrest.lastChecked)} with no material change.` : ''}
          {' '}Intensity here means scale of mobilisation and lethality of the response, not armed combat. Check the linked sources for developments since then.
        </div>
      </div>
    </>
  );
}

const WINDOWS = [
  { days: 30, label: '30 days' },"""),
])
print('ui patched')
