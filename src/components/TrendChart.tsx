import { useId } from 'react';
import type { TrendPoint } from '../lib/trends';
import { formatUsd } from '../lib/worldbank';
import { countryName } from '../lib/countries';

interface Props {
  points: TrendPoint[];
  color: string;
  /** Which series to draw. */
  series: 'members' | 'gdpUsd';
  label: string;
  /** Extra text after the headline year, e.g. a share of world GDP. */
  sub?: string;
}

const W = 320;
const H = 90;
const PAD = { l: 6, r: 6, t: 10, b: 18 };

/**
 * Small line chart for a bloc's membership count or combined GDP by year.
 * Pure SVG scaled by viewBox; the values are repeated in a visually hidden
 * table so screen readers get the same numbers.
 */
export default function TrendChart({ points, color, series, label, sub }: Props) {
  const id = useId();
  if (points.length < 2) return null;
  const values = points.map((p) => p[series]);
  const max = Math.max(...values, 1);
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  // GDP points that include carried-forward values: the segment into them is drawn dashed.
  const estimated = (i: number) => series === 'gdpUsd' && points[i]!.estimated > 0;
  const seg = (i: number) => `M${x(i - 1).toFixed(1)} ${y(values[i - 1]!).toFixed(1)} L${x(i).toFixed(1)} ${y(values[i]!).toFixed(1)}`;
  const solid = values.map((_, i) => (i > 0 && !estimated(i) ? seg(i) : '')).join(' ');
  const dashed = values.map((_, i) => (i > 0 && estimated(i) ? seg(i) : '')).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)} ${(H - PAD.b).toFixed(1)} L${x(0).toFixed(1)} ${(H - PAD.b).toFixed(1)} Z`;
  const first = points[0]!;
  const last = points.at(-1)!;
  const fmt = (v: number) => (series === 'members' ? String(v) : formatUsd(v));
  const ticks = [first.year, Math.round((first.year + last.year) / 2), last.year];
  const lastEstimated = estimated(points.length - 1);
  const carriedNote = lastEstimated ? last.carried.map((c) => `${countryName(c.iso)}: ${c.from} value carried forward`).join('; ') : undefined;
  return (
    <figure className="trend" aria-labelledby={`${id}-cap`}>
      <figcaption id={`${id}-cap`} className="trend-cap">
        <span className="label">{label}</span>
        <span className="trend-now">
          <span title={carriedNote}>
            {fmt(last[series])}
            {lastEstimated ? '*' : ''}
          </span>{' '}
          <span className="trend-sub">
            in {last.year}
            {sub ? ` · ${sub}` : ''}
          </span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id}-g)`} />
        <path d={solid} fill="none" stroke={color} strokeWidth="1.6" />
        {dashed && <path d={dashed} fill="none" stroke={color} strokeWidth="1.6" strokeDasharray="3 2.5" />}
        <circle cx={x(points.length - 1)} cy={y(last[series])} r="2.5" fill={lastEstimated ? 'var(--bg-elev)' : color} stroke={color} strokeWidth={lastEstimated ? 1.4 : 0} />
        {ticks.map((t, i) => (
          <text key={t} x={i === 0 ? PAD.l : i === 1 ? W / 2 : W - PAD.r} y={H - 4} className="trend-tick" textAnchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'}>
            {t}
          </text>
        ))}
      </svg>
      <table className="sr-only">
        <caption>{label} by year</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.year}>
              <th scope="row">{p.year}</th>
              <td>
                {fmt(p[series])}
                {estimated(points.indexOf(p)) ? ` (includes ${p.estimated} carried-forward value${p.estimated === 1 ? '' : 's'})` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
