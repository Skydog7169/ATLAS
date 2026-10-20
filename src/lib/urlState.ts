export type Mode = 'blocs' | 'conflicts';

export type Selection =
  | { kind: 'country'; iso: string }
  | { kind: 'bloc'; id: string }
  | { kind: 'conflict'; id: string }
  /** `since`: opened from the since-last-visit strip, so the panel preselects the unseen window. */
  | { kind: 'changes'; since?: boolean }
  | { kind: 'compare' }
  | { kind: 'about' }
  | { kind: 'watchlist' }
  | { kind: 'chokepoint'; id: string }
  | { kind: 'unrest'; id: string }
  | { kind: 'pair'; a: string; b: string | null }
  | { kind: 'ask' }
  | null;

export interface AppState {
  mode: Mode;
  /** In blocs mode: the single bloc being highlighted, or null for the overview. */
  bloc: string | null;
  /** In blocs mode: a second bloc to compare against `bloc`. */
  vs: string | null;
  selection: Selection;
  /** Conflicts mode: YYYY-MM being replayed, or null for the live view. */
  month: string | null;
  /** Optional data overlay drawn instead of the mode's fill. */
  layer: Layer;
  /** Flat Natural Earth map or an orthographic globe. */
  view: View;
  /** Globe centre as [longitude, latitude], whole degrees. */
  rotation: [number, number];
  /** Full-screen briefing mode: chrome hidden, items auto-cycling. */
  brief: boolean;
  /** Chrome-less view for iframes. */
  embed: boolean;
  /** Host options for an embed; only serialised when `embed` is set. */
  embedOpts: EmbedOptions;
  /** Embeds only: the theme the host pinned (dark when absent). Kept in the link so a reload keeps it. */
  theme?: 'light' | 'auto';
}

export interface EmbedOptions {
  /** Legend: shown as the frame size allows, or left off for a bare map. */
  legend: 'auto' | 'off';
  /** False freezes pan and zoom; clicks still answer "what is this?". */
  interactive: boolean;
}

export const DEFAULT_EMBED_OPTS: EmbedOptions = { legend: 'auto', interactive: true };
const EMBED_LEGENDS: readonly EmbedOptions['legend'][] = ['auto', 'off'];

export type View = 'flat' | 'globe';
export const DEFAULT_ROTATION: [number, number] = [15, 20];

export const LAYERS = ['displacement', 'sanctions', 'elections', 'nuclear', 'acled', 'acled-unrest', 'ucdp', 'military', 'trade', 'chokepoints', 'unrest'] as const;
export type Layer = (typeof LAYERS)[number] | null;

export const DEFAULT_STATE: AppState = { mode: 'blocs', bloc: null, vs: null, selection: null, month: null, layer: null, view: 'flat', rotation: DEFAULT_ROTATION, brief: false, embed: false, embedOpts: DEFAULT_EMBED_OPTS };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Encodes state in the hash so links are shareable without a server. */
export function serialize(state: AppState): string {
  const p = new URLSearchParams();
  p.set('mode', state.mode);
  // The bloc highlight only exists in blocs mode; it stays in memory so toggling back restores it.
  const bloc = state.mode === 'blocs' ? state.bloc : null;
  if (bloc) p.set('bloc', bloc);
  if (bloc && state.vs) p.set('vs', state.vs);
  // A bare #bloc=… link opens its panel, so say so when the user closed it.
  if (bloc && !state.selection) p.set('panel', '0');
  if (state.month) p.set('t', state.month);
  if (state.layer) p.set('layer', state.layer);
  if (state.view === 'globe') {
    p.set('view', 'globe');
    if (state.rotation[0] !== DEFAULT_ROTATION[0] || state.rotation[1] !== DEFAULT_ROTATION[1]) p.set('rot', `${state.rotation[0]},${state.rotation[1]}`);
  }
  if (state.brief) p.set('brief', '1');
  if (state.embed) {
    p.set('embed', '1');
    const o = state.embedOpts;
    if (o.legend !== 'auto') p.set('legend', o.legend);
    if (!o.interactive) p.set('interactive', '0');
    if (state.theme) p.set('theme', state.theme);
  }
  if (state.selection) {
    if (state.selection.kind === 'country') p.set('country', state.selection.iso);
    else if (state.selection.kind === 'changes') p.set('changes', state.selection.since ? 'since' : '1');
    else if (state.selection.kind === 'compare') p.set('compare', '1');
    else if (state.selection.kind === 'about') p.set('about', '1');
    else if (state.selection.kind === 'watchlist') p.set('watchlist', '1');
    else if (state.selection.kind === 'chokepoint') p.set('chokepoint', state.selection.id);
    else if (state.selection.kind === 'unrest') p.set('unrest', state.selection.id);
    else if (state.selection.kind === 'pair') p.set('pair', state.selection.b ? `${state.selection.a},${state.selection.b}` : state.selection.a);
    else if (state.selection.kind === 'ask') p.set('ask', '1');
    // With a comparison set, bloc+vs alone would reopen the compare panel.
    else if (state.selection.kind === 'bloc' && bloc && state.vs) p.set('selbloc', state.selection.id);
    else p.set(state.selection.kind, state.selection.id);
  }
  return '#' + p.toString();
}

function embedThemeOf(p: URLSearchParams): Pick<AppState, 'theme'> {
  const t = p.get('theme');
  return p.get('embed') === '1' && (t === 'light' || t === 'auto') ? { theme: t } : {};
}

/** Where a link to a layer this build cannot draw lands instead: the nearest tracked view. */
const LAYER_FALLBACK: Partial<Record<string, { layer: Layer; mode?: Mode }>> = {
  'acled-unrest': { layer: 'unrest' },
  acled: { layer: null, mode: 'conflicts' },
  ucdp: { layer: null, mode: 'conflicts' },
};

export interface Validators {
  bloc: (id: string) => boolean;
  conflict: (id: string) => boolean;
  country: (iso: string) => boolean;
  chokepoint?: (id: string) => boolean;
  unrest?: (id: string) => boolean;
  layer?: (id: string) => boolean;
  /** Normalises a replay month: the month to show, or null for live. */
  month?: (m: string) => string | null;
}

/** An id the link named that this edition doesn't know. */
export interface DroppedId {
  kind: 'bloc' | 'vs' | 'conflict' | 'country' | 'chokepoint' | 'unrest' | 'pair';
  id: string;
}

export function parse(hash: string, isValid: Validators): AppState {
  return parseHash(hash, isValid).state;
}

/** Like parse, and also reports every id that failed validation so the app can say so. */
export function parseHash(hash: string, isValid: Validators): { state: AppState; dropped: DroppedId[] } {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const dropped: DroppedId[] = [];
  const check = (kind: DroppedId['kind'], id: string, ok: boolean | undefined) => {
    if (!ok) dropped.push({ kind, id });
    return !!ok;
  };
  const layerParam = p.get('layer');
  // Credential-gated layers (ACLED, UCDP) may be missing from this build; never draw them as an all-zero map.
  const fallback = layerParam && isValid.layer && !isValid.layer(layerParam) ? LAYER_FALLBACK[layerParam] : undefined;
  let mode: Mode = fallback?.mode ?? (p.get('mode') === 'conflicts' ? 'conflicts' : 'blocs');
  const blocParam = p.get('bloc');
  const bloc = blocParam && check('bloc', blocParam, isValid.bloc(blocParam)) ? blocParam : null;
  const vsParam = p.get('vs');
  const vs = bloc && vsParam && vsParam !== bloc && check('vs', vsParam, isValid.bloc(vsParam)) ? vsParam : null;

  const t = p.get('t');
  // The month validator clamps to the replay range: before it snaps to the first stop, the live month or later is live.
  const month = t && MONTH.test(t) ? (isValid.month ? isValid.month(t) : t) : null;
  const drawable = (id: string) => (LAYERS as readonly string[]).includes(id) && (!isValid.layer || isValid.layer(id));
  const layer: Layer = layerParam && drawable(layerParam) ? (layerParam as Layer) : fallback?.layer && drawable(fallback.layer) ? fallback.layer : null;

  let selection: Selection = null;
  const country = p.get('country');
  const conflict = p.get('conflict');
  const selBloc = p.get('selbloc');
  const chokepoint = p.get('chokepoint');
  const unrest = p.get('unrest');
  const pair = (p.get('pair') ?? '').toUpperCase().split(',').filter(Boolean);
  const pairOk = !!pair[0] && check('pair', pair.join(','), isValid.country(pair[0]) && (!pair[1] || (isValid.country(pair[1]) && pair[1] !== pair[0])));
  const chokepointOk = !!chokepoint && check('chokepoint', chokepoint, isValid.chokepoint?.(chokepoint));
  const unrestOk = !!unrest && check('unrest', unrest, isValid.unrest?.(unrest));
  const countryOk = !!country && check('country', country, isValid.country(country.toUpperCase()));
  const conflictOk = !!conflict && check('conflict', conflict, isValid.conflict(conflict));
  // panel=0: the bloc is highlighted but its panel was closed.
  const inferPanel = p.get('panel') !== '0' && !country && !conflict;
  if (p.get('about') === '1') selection = { kind: 'about' };
  else if (p.get('ask') === '1') selection = { kind: 'ask' };
  else if (pairOk) selection = { kind: 'pair', a: pair[0]!, b: pair[1] ?? null };
  else if (chokepointOk) selection = { kind: 'chokepoint', id: chokepoint! };
  else if (unrestOk) selection = { kind: 'unrest', id: unrest! };
  else if (p.get('watchlist') === '1') selection = { kind: 'watchlist' };
  else if (p.get('changes') === '1') selection = { kind: 'changes' };
  else if (p.get('changes') === 'since') selection = { kind: 'changes', since: true };
  else if (vs && mode === 'blocs' && p.get('compare') === '1') selection = { kind: 'compare' };
  else if (countryOk) selection = { kind: 'country', iso: country!.toUpperCase() };
  else if (conflictOk) selection = { kind: 'conflict', id: conflict! };
  else if (selBloc && isValid.bloc(selBloc)) selection = { kind: 'bloc', id: selBloc };
  // A leftover bloc highlight doesn't open its panel over a conflicts map.
  else if (bloc && vs && inferPanel && mode === 'blocs') selection = { kind: 'compare' };
  else if (bloc && inferPanel && mode === 'blocs') selection = { kind: 'bloc', id: bloc };
  // A war is only shown on the conflicts map.
  if (selection?.kind === 'conflict') mode = 'conflicts';

  const view: View = p.get('view') === 'globe' ? 'globe' : 'flat';
  const rotation = parseRotation(p.get('rot'));
  const embed = p.get('embed') === '1';
  const legendParam = p.get('legend') as EmbedOptions['legend'];
  const embedOpts: EmbedOptions = embed ? { legend: EMBED_LEGENDS.includes(legendParam) ? legendParam : 'auto', interactive: p.get('interactive') !== '0' } : DEFAULT_EMBED_OPTS;
  return { state: { mode, bloc, vs, selection, month, layer, view, rotation, brief: p.get('brief') === '1', embed, embedOpts, ...embedThemeOf(p) }, dropped };
}

export function parseRotation(raw: string | null): [number, number] {
  if (!raw) return DEFAULT_ROTATION;
  const [lon, lat] = raw.split(',').map(Number);
  if (lon === undefined || lat === undefined || !Number.isFinite(lon) || !Number.isFinite(lat)) return DEFAULT_ROTATION;
  return [Math.round(((((lon + 180) % 360) + 360) % 360) - 180), Math.round(Math.max(-89, Math.min(89, lat)))];
}
