import { describe, expect, it, vi } from 'vitest';
import { collectItems } from '../../scripts/build-feeds.mjs';
import { renderDigest, sendViaResend, sinceDate } from '../../scripts/send-digest.mjs';
import conflicts from '../data/conflicts.json';
import blocs from '../data/blocs.json';
import unrest from '../data/unrest.json';
import { countryName } from './countries';

describe('email digest', () => {
  const items = collectItems(conflicts, blocs, countryName, unrest);

  it('windows on the last eight days by default', () => {
    expect(sinceDate(new Date('2026-10-08T06:00:00Z'))).toBe('2026-09-30');
  });

  it('renders subject, text and html for changes after a date, and nothing when quiet', () => {
    const d = renderDigest(items, '2020-01-01', new Date('2026-10-08T00:00:00Z'))!;
    expect(d.count).toBe(items.length);
    expect(d.subject).toMatch(/^ATLAS digest 2026-10-08: \d+ conflict assessments?, \d+ unrest assessments?, \d+ membership changes?$/);
    expect(d.text).toContain('Conflict assessments');
    expect(d.text).toContain('Civil unrest');
    expect(d.html).toContain('Civil unrest');
    expect(d.html).toContain('<h2');
    expect(d.html).not.toContain('<script');
    expect(renderDigest(items, '2999-01-01')).toBeNull();
  });

  it('includes every unrest item and counts it in the subject', () => {
    const d = renderDigest(items, '2026-10-12', new Date('2026-10-20T00:00:00Z'))!;
    const fresh = items.filter((it) => it.date > '2026-10-12');
    const unrestCount = fresh.filter((it) => it.tags[0] === 'unrest').length;
    expect(unrestCount).toBeGreaterThan(0);
    expect(d.subject).toContain(`${unrestCount} unrest assessment`);
    for (const it of fresh) expect(d.text).toContain(it.url);
    expect(d.text).toMatch(/\d+ escalated|\d+ eased|\d+ new/);
    // Real signals lead the section; same-level re-assessments follow.
    const conflictSection = d.text.split('Civil unrest')[0]!;
    expect(conflictSection.indexOf('no change')).toBeGreaterThan(-1);
  });

  it('posts to Resend with a bearer token and surfaces errors', async () => {
    const ok = vi.fn(async () => ({ ok: true, text: async () => '{"id":"abc"}' }));
    const r = await sendViaResend({ apiKey: 'k', from: 'a@b.c', to: ['x@y.z'], subject: 's', text: 't', html: '<p>t</p>' }, ok as unknown as typeof fetch);
    expect(r).toEqual({ id: 'abc' });
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer k');
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ['x@y.z'], subject: 's' });
    const bad = vi.fn(async () => ({ ok: false, status: 422, text: async () => 'nope' }));
    await expect(sendViaResend({ apiKey: 'k', from: 'a@b.c', to: ['x@y.z'], subject: 's', text: 't', html: '' }, bad as unknown as typeof fetch)).rejects.toThrow(/Resend 422/);
  });
});
