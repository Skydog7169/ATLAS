// Vercel serverless entry for Ask ATLAS. Off unless ASK_ATLAS_ENABLED=1 and
// ANTHROPIC_API_KEY are set in the project's environment.
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { buildContext } from './_lib/context.js';
import { ask, memoryLimiter, memorySpend } from './_lib/ask.js';

const ENABLED = process.env.ASK_ATLAS_ENABLED === '1' && Boolean(process.env.ANTHROPIC_API_KEY);
const DAILY_CAP = Number(process.env.ASK_DAILY_CAP_USD ?? '2');
const context = ENABLED ? buildContext() : '';
const limiter = memoryLimiter(Number(process.env.ASK_PER_VISITOR_PER_HOUR ?? '10'));
const spend = memorySpend();
const client = ENABLED ? new Anthropic() : null;

interface Req {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ enabled: ENABLED });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST a JSON body with a question.' });
  if (!ENABLED || !client) return res.status(503).json({ enabled: false, error: 'Ask ATLAS is not enabled on this deployment.' });
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const question = typeof (body as { question?: unknown })?.question === 'string' ? (body as { question: string }).question : '';
  const ipHeader = req.headers['x-forwarded-for'];
  const ip = ((Array.isArray(ipHeader) ? ipHeader[0] : ipHeader) ?? 'unknown').split(',')[0]!.trim();
  const visitor = createHash('sha256').update(ip).digest('hex').slice(0, 16);
  try {
    const result = await ask(question, visitor, { client, context, limiter, spend, dailyCapUsd: DAILY_CAP });
    return res.status(result.status).json(result.body);
  } catch (err) {
    const status = err instanceof Anthropic.RateLimitError ? 429 : err instanceof Anthropic.APIError ? 502 : 500;
    return res.status(status).json({ error: status === 429 ? 'The model is busy; try again shortly.' : 'Ask ATLAS failed to answer.' });
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
