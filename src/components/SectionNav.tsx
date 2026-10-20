import { useEffect, useRef, useState } from 'react';

export interface SectionNavItem {
  /** Id of the section's heading inside the panel body. */
  id: string;
  label: string;
}

/**
 * Sticky jump strip for long panels, rendered between .panel-head and
 * .panel-body: one chip per section, the one in view marked aria-current.
 */
export default function SectionNav({ items, label }: { items: SectionNavItem[]; label: string }) {
  const ref = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState<string | null>(items[0]?.id ?? null);
  const ids = items.map((i) => i.id).join(' ');

  useEffect(() => {
    const body = ref.current?.nextElementSibling;
    if (!body || typeof IntersectionObserver === 'undefined') return;
    const heads = ids
      .split(' ')
      .map((id) => body.querySelector<HTMLElement>(`#${CSS.escape(id)}`))
      .filter((el): el is HTMLElement => !!el);
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        // The first heading in document order that is on screen.
        const first = heads.find((h) => visible.has(h.id));
        if (first) setCurrent(first.id);
      },
      { root: body, rootMargin: '0px 0px -40% 0px' },
    );
    for (const h of heads) io.observe(h);
    return () => io.disconnect();
  }, [ids]);

  if (items.length < 3) return null;
  return (
    <nav className="section-nav" ref={ref} aria-label={label}>
      {items.map((it) => (
        <button
          key={it.id}
          className="chip"
          aria-current={current === it.id ? 'true' : undefined}
          onClick={() => {
            // Scroll only the panel body; scrollIntoView would also shift the clipped panel.
            const body = ref.current?.nextElementSibling;
            const target = body?.querySelector<HTMLElement>(`#${CSS.escape(it.id)}`);
            if (!body || !target) return;
            const top = body.scrollTop + target.getBoundingClientRect().top - body.getBoundingClientRect().top - 6;
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            body.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
            setCurrent(it.id);
          }}
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}
