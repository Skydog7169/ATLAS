import { describe, expect, it } from 'vitest';
import { inlineStyles, readLegend } from './exportPng';

describe('exportPng helpers', () => {
  it('reads the on-screen legend into rows with swatch colours', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <aside class="legend"><h3>Export dependence</h3>
        <ul>
          <li><span class="swatch" style="background: rgb(79, 140, 255)"></span> United States</li>
          <li><span class="swatch" style="background: rgb(255, 59, 59)"></span> China</li>
          <li><span class="swatch"></span>   </li>
        </ul>
        <p class="src">WITS, fetched 2026</p>
      </aside>`;
    document.body.appendChild(root);
    const legend = readLegend(root);
    expect(legend.title).toBe('Export dependence');
    expect(legend.rows).toEqual([
      { color: 'rgb(79, 140, 255)', label: 'United States' },
      { color: 'rgb(255, 59, 59)', label: 'China' },
    ]);
    root.remove();
  });

  it('returns an empty legend when none is shown', () => {
    expect(readLegend(document.createElement('div'))).toEqual({ title: null, rows: [] });
  });

  it('clones the svg with computed fills inlined and the tabindex dropped', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('tabindex', '0');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('style', 'fill: rgb(1, 2, 3); stroke-width: 2px');
    svg.appendChild(path);
    document.body.appendChild(svg);
    const clone = inlineStyles(svg);
    expect(clone).not.toBe(svg);
    expect(clone.hasAttribute('tabindex')).toBe(false);
    expect(clone.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
    const cloned = clone.querySelector('path')!;
    expect(cloned.style.getPropertyValue('fill')).toBe('rgb(1, 2, 3)');
    expect(cloned.style.getPropertyValue('stroke-width')).toBe('2px');
    // The source is untouched.
    expect(svg.getAttribute('tabindex')).toBe('0');
    svg.remove();
  });
});
