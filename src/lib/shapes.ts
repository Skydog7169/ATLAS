/** An upward triangle centred on the origin, sized to match a circle of radius r. */
export function triPath(r: number): string {
  const h = r * 1.25;
  return `M0 ${-h}L${h * 0.95} ${h * 0.6}L${-h * 0.95} ${h * 0.6}Z`;
}

/** A jet silhouette pointing up (north), nose at -r, spanning about 2r. */
export function planePath(r: number): string {
  const s = r / 10;
  const pts = [
    [0, -10], [1.6, -4], [9, 1], [9, 3], [1.6, 0.8], [1.2, 6], [4, 8.5], [4, 10], [0, 8.8],
    [-4, 10], [-4, 8.5], [-1.2, 6], [-1.6, 0.8], [-9, 3], [-9, 1], [-1.6, -4],
  ];
  return 'M' + pts.map(([x, y]) => `${(x! * s).toFixed(2)} ${(y! * s).toFixed(2)}`).join('L') + 'Z';
}

/** Screen bearing in degrees clockwise from up, from a point to another; null when they coincide. */
export function screenBearing(dx: number, dy: number): number | null {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}
