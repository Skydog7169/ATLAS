/**
 * Rasterises the live map SVG to a PNG with the legend and a date stamp.
 * Computed styles are inlined because the standalone SVG has no stylesheet
 * and the fills lean on CSS variables and color-mix().
 */
const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-family', 'font-size', 'letter-spacing', 'paint-order', 'stroke-linejoin'] as const;

export interface LegendRow {
  color: string;
  label: string;
}

export interface ExportOptions {
  svg: SVGSVGElement;
  /** Background colour behind the map. */
  background: string;
  foreground: string;
  muted: string;
  title: string;
  legendTitle: string | null;
  legend: LegendRow[];
  stamp: string;
  scale?: number;
}

export function inlineStyles(source: SVGSVGElement): SVGSVGElement {
  const clone = source.cloneNode(true) as SVGSVGElement;
  const src = source.querySelectorAll<SVGElement>('*');
  const dst = clone.querySelectorAll<SVGElement>('*');
  src.forEach((el, i) => {
    const target = dst[i];
    if (!target) return;
    const cs = getComputedStyle(el);
    for (const prop of STYLE_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v) target.style.setProperty(prop, v);
    }
    // Animated transforms (pulse rings, reticles) are left as drawn.
  });
  clone.removeAttribute('tabindex');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return clone;
}

/** Reads the on-screen legend into rows the canvas can draw. */
export function readLegend(root: ParentNode): { title: string | null; rows: LegendRow[] } {
  const legend = root.querySelector('.legend');
  if (!legend) return { title: null, rows: [] };
  const title = legend.querySelector('h3')?.textContent?.trim() ?? null;
  const rows: LegendRow[] = [];
  legend.querySelectorAll('li').forEach((li) => {
    const swatch = li.querySelector<HTMLElement>('.swatch');
    const color = swatch ? getComputedStyle(swatch).backgroundColor : 'transparent';
    const label = li.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (label) rows.push({ color, label });
  });
  return { title, rows };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG rasterisation failed'));
    img.src = url;
  });
}

export async function renderPng(opts: ExportOptions): Promise<Blob> {
  const scale = opts.scale ?? Math.min(2, window.devicePixelRatio || 1);
  const w = opts.svg.clientWidth || Number(opts.svg.getAttribute('width')) || 1280;
  const h = opts.svg.clientHeight || Number(opts.svg.getAttribute('height')) || 720;
  const clone = inlineStyles(opts.svg);
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  const svgText = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    // The stamp strip is appended below the map so it never crops it (the globe touches the bottom edge).
    const total = h + STAMP_H;
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(total * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.scale(scale, scale);
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, w, total);
    ctx.drawImage(img, 0, 0, w, h);
    drawLegend(ctx, opts, w, total);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG encoding failed');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Height of the title and date strip under the map. */
export const STAMP_H = 26;

function drawLegend(ctx: CanvasRenderingContext2D, opts: ExportOptions, w: number, h: number) {
  const mono = '"Share Tech Mono", ui-monospace, Menlo, monospace';
  const pad = 14;
  const rowH = 18;
  const rows = opts.legend.slice(0, 8);
  const boxW = 250;
  const boxH = pad * 2 + (opts.legendTitle ? 22 : 0) + rows.length * rowH;
  const x = pad;
  const y = h - boxH - pad - 26;
  if (rows.length) {
    ctx.fillStyle = withAlpha(opts.background, 0.88);
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = opts.muted;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);
    let cy = y + pad;
    if (opts.legendTitle) {
      ctx.fillStyle = opts.foreground;
      ctx.font = `bold 11px ${mono}`;
      ctx.fillText(opts.legendTitle.toUpperCase(), x + pad, cy + 10);
      cy += 22;
    }
    ctx.font = `11px ${mono}`;
    for (const r of rows) {
      ctx.fillStyle = r.color;
      ctx.fillRect(x + pad, cy + 3, 14, 10);
      ctx.fillStyle = opts.foreground;
      ctx.fillText(r.label, x + pad + 22, cy + 12);
      cy += rowH;
    }
  }
  // Stamp strip along the bottom.
  ctx.fillStyle = withAlpha(opts.background, 0.9);
  ctx.fillRect(0, h - 26, w, 26);
  ctx.fillStyle = opts.foreground;
  ctx.font = `bold 12px ${mono}`;
  ctx.fillText(opts.title.toUpperCase(), pad, h - 9);
  ctx.fillStyle = opts.muted;
  ctx.font = `11px ${mono}`;
  ctx.textAlign = 'right';
  ctx.fillText(opts.stamp, w - pad, h - 9);
  ctx.textAlign = 'left';
}

function withAlpha(color: string, alpha: number): string {
  const m = color.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const [r, g, b] = m[1]!.split(',').map((s) => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
