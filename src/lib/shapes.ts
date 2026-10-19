/** An upward triangle centred on the origin, sized to match a circle of radius r. */
export function triPath(r: number): string {
  const h = r * 1.25;
  return `M0 ${-h}L${h * 0.95} ${h * 0.6}L${-h * 0.95} ${h * 0.6}Z`;
}
