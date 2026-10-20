import type { GestureKind } from '../hooks/useGestureHint';

const COPY: Record<GestureKind, string> = {
  touch: 'Use two fingers to move the map',
  wheel: /Mac|iPhone|iPad/.test(typeof navigator === 'undefined' ? '' : navigator.platform) ? '⌘ + scroll to zoom the map' : 'Ctrl + scroll to zoom the map',
};

export default function GestureHint({ kind }: { kind: GestureKind | null }) {
  if (!kind) return null;
  return (
    <div className="gesture-hint" aria-hidden="true">
      <span>{COPY[kind]}</span>
    </div>
  );
}
