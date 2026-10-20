import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BlocChips from './BlocChips';

describe('BlocChips', () => {
  it('is one tab stop with arrow, Home and End movement', () => {
    render(<BlocChips active={null} vs={null} picking={false} onChange={vi.fn()} onVs={vi.fn()} onPicking={vi.fn()} />);
    const chips = screen.getAllByRole('button');
    expect(chips.filter((c) => c.tabIndex === 0)).toHaveLength(1);
    expect(chips[0]!.textContent).toBe('Overview');
    chips[0]!.focus();
    fireEvent.keyDown(chips[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(chips[1]);
    expect(chips[1]!.tabIndex).toBe(0);
    expect(chips[0]!.tabIndex).toBe(-1);
    fireEvent.keyDown(chips[1]!, { key: 'End' });
    expect(document.activeElement).toBe(chips.at(-1));
    fireEvent.keyDown(chips.at(-1)!, { key: 'Home' });
    expect(document.activeElement).toBe(chips[0]);
  });

  it('names chips in full for screen readers and starts on the pressed chip', () => {
    render(<BlocChips active="nato" vs={null} picking={false} onChange={vi.fn()} onVs={vi.fn()} onPicking={vi.fn()} />);
    const nato = screen.getByRole('button', { name: /^NATO\b.*North Atlantic Treaty Organization/ });
    expect(nato.tabIndex).toBe(0);
    expect(screen.getByRole('button', { name: 'Overview' }).tabIndex).toBe(-1);
  });
});
