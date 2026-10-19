// Ask ATLAS: answers questions strictly from the dataset context, with
// citations, under a per-visitor rate limit and a daily spend cap. The
// handler is split from the Vercel entry so it can be unit-tested with a
// fake client.
import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

export const MODEL = 'claude-opus-5-5';
/** USD per token, input / cache write / cache read / output, for the spend estimate. */
const PRICE = { input: 4 / 1e6, cacheWrite: 5 / 1e6, cacheRead: 0.2 / 1e6, output: 20 / 1e6 };

export const AnswerSchema = z.object({
  answer: z.string().describe('The answer in plain prose, at most 180 words, or an explanation that the dataset does not cover the question'),
  citations: z.array(z.object({ id: z.string().describe('An id from the dataset, e.g. conflict:sudan'), title: z.string(), url: z.string().describe('A source URL from the dataset') })).max(6),
  covered: z.boolean().describe('false when the question falls outside the dataset and was declined'),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const SYSTEM = `You are Ask ATLAS, the question-answering layer of a geopolitics map. Answer only from the dataset below. It is a dated snapshot: say when a fact was verified and never add knowledge from outside it. If the question is not answered by the dataset (other topics, forecasts, anything after the newest date in the data), set covered=false and say so in one sentence. Cite every entity you rely on by its bracketed id and the source URL given beside it. Be concise and neutral.`;

export interface RateLimiter {
  /** Returns false when the visitor is over the limit. */
  take(key: string, now?: number): boolean;
}

/** Fixed-window counter per visitor, held in memory: good enough per function instance; a shared store would be needed for strict global limits. */
export function memoryLimiter(limit = 10, windowMs = 3_600_000): RateLimiter {
  const hits = new Map<string, { start: number; n: number }>();
  return {
    take(key, now = Date.now()) {
      const cur = hits.get(key);
      if (!cur || now - cur.start >= windowMs) {
        hits.set(key, { start: now, n: 1 });
        return true;
      }
      if (cur.n >= limit) return false;
      cur.n += 1;
      return true;
    },
  };
}

export interface SpendMeter {
  spentUsd(now?: number): number;
  add(usd: number, now?: number): void;
}

/** Daily spend, in memory per instance; resets at UTC midnight. */
export function memorySpend(): SpendMeter {
  let day = '';
  let spent = 0;
  const key = (now: number) => new Date(now).toISOString().slice(0, 10);
  return {
    spentUsd(now = Date.now()) {
      if (key(now) !== day) {
        day = key(now);
        spent = 0;
      }
      return spent;
    },
    add(usd, now = Date.now()) {
      this.spentUsd(now);
      spent += usd;
    },
  };
}

export function estimateCost(usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }): number {
  return usage.input_tokens * PRICE.input + (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite + (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead + usage.output_tokens * PRICE.output;
}

export interface AskDeps {
  client: Pick<Anthropic, 'messages'>;
  context: string;
  limiter: RateLimiter;
  spend: SpendMeter;
  dailyCapUsd: number;
}

export type AskResult = { status: number; body: Record<string, unknown> };

export async function ask(question: string, visitor: string, deps: AskDeps): Promise<AskResult> {
  const q = question.trim();
  if (q.length < 3 || q.length > 500) return { status: 400, body: { error: 'Ask a question between 3 and 500 characters.' } };
  if (!deps.limiter.take(visitor)) return { status: 429, body: { error: 'Too many questions from this address; try again in an hour.' } };
  if (deps.spend.spentUsd() >= deps.dailyCapUsd) return { status: 503, body: { error: 'Ask ATLAS has reached its daily budget; try again tomorrow.' } };

  const response = await deps.client.messages.parse({
    model: MODEL,
    max_tokens: 1500,
    output_config: { effort: 'low', format: zodOutputFormat(AnswerSchema) },
    system: [
      { type: 'text', text: SYSTEM },
      { type: 'text', text: deps.context, cache_control: { type: 'ephemeral', ttl: '1h' } },
    ],
    messages: [{ role: 'user', content: q }],
  });
  const cost = estimateCost(response.usage);
  deps.spend.add(cost);
  if (response.stop_reason === 'refusal') return { status: 200, body: { answer: 'That question was declined by the model.', citations: [], covered: false, cost } };
  const parsed = response.parsed_output;
  if (!parsed) return { status: 502, body: { error: 'The model returned no parseable answer.' } };
  return { status: 200, body: { ...parsed, model: MODEL, cost } };
}
