import { useEffect } from 'react';

export const TOAST_MS = 4000;

/** Brief notice that a link switched the map mode, with an Undo that steps history back. */
export default function ModeToast({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(t);
  }, [message, onDismiss]);
  return (
    <div className="mode-toast frame" role="status">
      <span>{message}</span>
      <button className="text-btn" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
