// Emails a digest of what changed in the datasets, via Resend. Runs from
// .github/workflows/digest.yml after a merged weekly refresh. Without a key or
// recipients it prints the digest and exits 0, so the workflow never fails on
// configuration alone.
//
//   node scripts/send-digest.mjs [--since YYYY-MM-DD] [--dry-run]
//
// Env: RESEND_API_KEY (secret), DIGEST_RECIPIENTS (comma-separated, repo variable),
//      DIGEST_FROM (optional; defaults to Resend's onboarding sender, which only delivers to the account owner).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, collectItems } from './build-feeds.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const DEFAULT_FROM = 'ATLAS <onboarding@resend.dev>';
const WINDOW_DAYS = 8; // a weekly pass plus a day of slack

export function sinceDate(now = new Date(), days = WINDOW_DAYS) {
  return new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Subject, plain text and HTML for the items dated after `since`. Returns null when nothing changed. */
export function renderDigest(items, since, now = new Date()) {
  const fresh = items.filter((it) => it.date > since);
  if (!fresh.length) return null;
  const conflicts = fresh.filter((it) => it.tags[0] === 'conflict');
  const blocs = fresh.filter((it) => it.tags[0] === 'bloc');
  const day = now.toISOString().slice(0, 10);
  const subject = `ATLAS digest ${day}: ${conflicts.length} assessment${conflicts.length === 1 ? '' : 's'}, ${blocs.length} membership change${blocs.length === 1 ? '' : 's'}`;
  const text = [
    `ATLAS: what changed since ${since}`,
    '',
    ...(conflicts.length ? ['Conflict assessments', ...conflicts.map((it) => `- ${it.date} ${it.title}\n  ${it.summary}\n  ${it.url}`), ''] : []),
    ...(blocs.length ? ['Bloc memberships', ...blocs.map((it) => `- ${it.date} ${it.title}\n  ${it.summary}\n  ${it.url}`), ''] : []),
    `Map: ${SITE}/  ·  Feed: ${SITE}/feed.xml`,
    'You receive this because your address is in the ATLAS repository\'s DIGEST_RECIPIENTS variable.',
  ].join('\n');
  const section = (title, list) =>
    list.length
      ? `<h2 style="font:600 15px system-ui;margin:20px 0 8px">${title}</h2>` +
        list
          .map(
            (it) =>
              `<p style="margin:0 0 12px;font:14px/1.45 system-ui"><a href="${esc(it.url)}" style="color:#0a7ea4;font-weight:600">${esc(it.title)}</a> <span style="color:#666">${esc(it.date)}</span><br>${esc(it.summary)}${
                it.sources.length ? `<br><span style="color:#666">Sources: ${it.sources.map((s) => `<a href="${esc(s.url)}" style="color:#666">${esc(s.name)}</a>`).join(' · ')}</span>` : ''
              }</p>`,
          )
          .join('')
      : '';
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f7fa;color:#0b1a26"><div style="max-width:640px;margin:0 auto"><h1 style="font:700 20px system-ui;letter-spacing:.08em;margin:0 0 4px">ATLAS</h1><p style="font:13px system-ui;color:#666;margin:0 0 16px">What changed since ${esc(since)}</p>${section('Conflict assessments', conflicts)}${section('Bloc memberships', blocs)}<p style="font:12px system-ui;color:#666;margin-top:24px"><a href="${SITE}/" style="color:#0a7ea4">Open the map</a> · <a href="${SITE}/feed.xml" style="color:#0a7ea4">RSS</a> · You receive this because your address is in the ATLAS repository's DIGEST_RECIPIENTS variable.</p></div></body></html>`;
  return { subject, text, html, count: fresh.length };
}

export async function sendViaResend({ apiKey, from, to, subject, text, html }, fetchImpl = fetch) {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text, html }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const since = argv.includes('--since') ? argv[argv.indexOf('--since') + 1] : sinceDate();
  const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
  const countries = new Map(read('src/data/countries.generated.json').map((c) => [c.cca3, c.name]));
  const items = collectItems(read('src/data/conflicts.json'), read('src/data/blocs.json'), (iso) => countries.get(iso) ?? iso);
  const digest = renderDigest(items, since);
  if (!digest) {
    console.log(`No changes since ${since}; nothing to send.`);
    return;
  }
  console.log(digest.subject);
  console.log(digest.text);
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.DIGEST_RECIPIENTS ?? '').split(/[,\s]+/).filter(Boolean);
  if (dryRun) return;
  if (!apiKey || !to.length) {
    console.log(`Not sending: ${!apiKey ? 'RESEND_API_KEY secret is not set' : 'DIGEST_RECIPIENTS variable is empty'}.`);
    return;
  }
  const result = await sendViaResend({ apiKey, from: process.env.DIGEST_FROM || DEFAULT_FROM, to, subject: digest.subject, text: digest.text, html: digest.html });
  console.log(`Sent to ${to.length} recipient${to.length === 1 ? '' : 's'} (id ${result.id ?? '?'}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
