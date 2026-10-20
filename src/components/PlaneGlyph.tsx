import { planePath, screenBearing } from '../lib/shapes';

interface Props {
  r: number;
  color: string;
  /** Track in degrees, used when the leader line is too short to give a screen direction. */
  heading: number;
  /** Earlier reported positions, in screen pixels relative to the marker. */
  trail: Array<[number, number]>;
  /** Where the aircraft will be in two minutes, relative to the marker. */
  leader: [number, number] | null;
  pulse?: boolean;
}

/**
 * A live aircraft: a fading trail of reported positions, a leader line along
 * its track, and a jet glyph rotated to the direction it is travelling on
 * screen (projections bend north, so the raw track would point wrong).
 */
export default function PlaneGlyph({ r, color, heading, trail, leader, pulse }: Props) {
  const bearing = (leader && screenBearing(leader[0], leader[1])) ?? heading;
  return (
    <>
      {trail.length > 0 && <polyline className="plane-trail" points={[...trail, [0, 0] as [number, number]].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} stroke={color} />}
      {leader && <line className="plane-leader" x1={0} y1={0} x2={leader[0].toFixed(1)} y2={leader[1].toFixed(1)} stroke={color} />}
      {pulse && <circle className="ring" r={r + 4} stroke={color} />}
      <path className="core plane-body" d={planePath(r)} fill={color} transform={`rotate(${bearing.toFixed(0)})`} />
    </>
  );
}
