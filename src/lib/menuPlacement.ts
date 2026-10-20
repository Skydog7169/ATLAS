export interface MenuPlacement {
  /** 'up' anchors the menu's bottom to the trigger's bottom; 'down' its top to the trigger's top. */
  side: 'up' | 'down';
  maxHeight: number;
}

type Box = Pick<DOMRect, 'top' | 'bottom'>;

/** Where a popover beside a trigger fits inside its container, keeping `gap` px clear of the edges. */
export function menuPlacement(trigger: Box, container: Box, gap = 8): MenuPlacement {
  const up = trigger.bottom - container.top - gap;
  const down = container.bottom - trigger.top - gap;
  return up >= down ? { side: 'up', maxHeight: Math.max(120, Math.floor(up)) } : { side: 'down', maxHeight: Math.max(120, Math.floor(down)) };
}
