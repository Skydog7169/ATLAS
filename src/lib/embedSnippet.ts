import { serialize, type AppState, type EmbedOptions } from './urlState';

export const EMBED_PRESETS = [
  { label: '360 × 240', width: 360, height: 240 },
  { label: '640 × 360', width: 640, height: 360 },
  { label: '960 × 540', width: 960, height: 540 },
] as const;

/** The embed URL for a view: chrome-less, with host options, and pinned to the replay month only when frozen. */
export function embedUrl(state: AppState, opts: EmbedOptions, freeze: boolean, base: string): string {
  const month = freeze && state.mode === 'conflicts' ? state.month : null;
  const url = new URL(base);
  url.hash = serialize({ ...state, month, brief: false, embed: true, embedOpts: opts });
  return url.href;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function embedSnippet(src: string, height: number, title: string): string {
  return `<iframe src="${escapeAttr(src)}" width="100%" height="${height}" title="${escapeAttr(`ATLAS: ${title}`)}" loading="lazy" style="border:0"></iframe>`;
}
