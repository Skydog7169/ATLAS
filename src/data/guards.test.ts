import { describe, expect, it } from 'vitest';
import { clampIntensity, isMaterialChange, verifySources } from './guards';

describe('clampIntensity', () => {
  it('allows one-step moves', () => {
    expect(clampIntensity('low', 'medium')).toEqual({ intensity: 'medium', clamped: false });
    expect(clampIntensity('high', 'medium')).toEqual({ intensity: 'medium', clamped: false });
  });
  it('clamps larger jumps to one step and flags them', () => {
    expect(clampIntensity('latent', 'high')).toEqual({ intensity: 'low', clamped: true });
    expect(clampIntensity('high', 'latent')).toEqual({ intensity: 'medium', clamped: true });
  });
});

describe('verifySources', () => {
  it('keeps URLs seen in search results or on trusted hosts, drops the rest', () => {
    const { kept, dropped } = verifySources(
      [
        { name: 'seen', url: 'https://example.org/story/' },
        { name: 'trusted', url: 'https://www.aljazeera.com/news/2026/1/1/x' },
        { name: 'invented', url: 'https://made-up.example/x' },
        { name: 'http', url: 'http://reuters.com/x' },
      ],
      ['https://example.org/story'],
    );
    expect(kept.map((s) => s.name)).toEqual(['seen', 'trusted']);
    expect(dropped.map((s) => s.name)).toEqual(['invented', 'http']);
  });
});

describe('isMaterialChange', () => {
  const prev = { date: '2026-10-07', intensity: 'high' as const, status: 'The army retook the city in March and fighting moved east.', sources: [] };
  it('treats intensity moves as material', () => {
    expect(isMaterialChange(prev, prev.status, 'medium')).toBe(true);
  });
  it('ignores identical or trivially reworded text', () => {
    expect(isMaterialChange(prev, prev.status, 'high')).toBe(false);
    expect(isMaterialChange(prev, 'The army retook the city in March, and fighting moved east.', 'high')).toBe(false);
  });
  it('accepts genuinely new text', () => {
    expect(isMaterialChange(prev, 'A ceasefire signed in November collapsed within a week after strikes on the capital.', 'high')).toBe(true);
  });
});
