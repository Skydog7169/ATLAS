import { captionFor } from '../lib/caption';
import type { Selection } from '../lib/urlState';

/**
 * Embeds show the subject, not the full panel: a one-line caption at the
 * bottom with a link to the full view in ATLAS.
 */
export default function EmbedCaption({ selection, month = null, href }: { selection: Exclude<Selection, null>; month?: string | null; href: string }) {
  const cap = captionFor(selection, month);
  if (!cap) return null;
  return (
    <div className="embed-caption">
      <div className="text">
        <span className="kicker">{cap.kicker}</span>
        <strong>{cap.title}</strong>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer">
        Details ↗
      </a>
    </div>
  );
}
