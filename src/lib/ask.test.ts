import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { buildContext } from '../../api/_lib/context';
import { AnswerSchema, ask, estimateCost, memoryLimiter, memorySpend } from '../../api/_lib/ask';

describe('ask atlas', () => {
  it('builds a deterministic, id-tagged context under a sane size', () => {
    const ctx = buildContext();
    expect(ctx).toBe(buildContext());
    expect(ctx).toContain('[conflict:sudan]');
    expect(ctx).toContain('[bloc:nato]');
    expect(ctx).toContain('[sanctions:IRN]');
    expect(ctx).toContain('[chokepoint:hormuz]');
    expect(ctx.length).toBeGreaterThan(50_000);
    expect(ctx.length).toBeLessThan(400_000);
  });

  it('rate-limits per visitor and meters daily spend', () => {
    const lim = memoryLimiter(2, 1000);
    expect(lim.take('a', 0)).toBe(true);
    expect(lim.take('a', 10)).toBe(true);
    expect(lim.take('a', 20)).toBe(false);
    expect(lim.take('b', 20)).toBe(true);
    expect(lim.take('a', 1001)).toBe(true);
    const spend = memorySpend();
    spend.add(0.5, Date.parse('2026-10-08T10:00:00Z'));
    expect(spend.spentUsd(Date.parse('2026-10-08T23:00:00Z'))).toBe(0.5);
    expect(spend.spentUsd(Date.parse('2026-10-09T00:01:00Z'))).toBe(0);
    expect(estimateCost({ input_tokens: 1000, output_tokens: 1000, cache_read_input_tokens: 30000 })).toBeCloseTo(0.004 + 0.02 + 0.006, 5);
  });

  it('answers through the client with cached context, and refuses over the cap', async () => {
    const calls: unknown[] = [];
    const client = {
      messages: {
        parse: async (params: unknown) => {
          calls.push(params);
          return { stop_reason: 'end_turn', usage: { input_tokens: 50, output_tokens: 200, cache_read_input_tokens: 30000 }, parsed_output: { answer: 'Sudan is at war.', citations: [{ id: 'conflict:sudan', title: 'CFR', url: 'https://www.cfr.org/global-conflict-tracker' }], covered: true } };
        },
      },
    } as unknown as Anthropic;
    const deps = { client, context: 'CTX', limiter: memoryLimiter(5), spend: memorySpend(), dailyCapUsd: 1 };
    const r = await ask('What is happening in Sudan?', 'v1', deps);
    expect(r.status).toBe(200);
    expect(AnswerSchema.safeParse({ answer: r.body.answer, citations: r.body.citations, covered: r.body.covered }).success).toBe(true);
    const params = calls[0] as { system: Array<{ text: string; cache_control?: unknown }>; model: string; output_config: { effort: string } };
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.system[1]!.text).toBe('CTX');
    expect(params.system[1]!.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(params.output_config.effort).toBe('low');
    expect(deps.spend.spentUsd()).toBeGreaterThan(0);
    deps.spend.add(5);
    expect((await ask('Again?', 'v1', deps)).status).toBe(503);
    expect((await ask('x', 'v1', deps)).status).toBe(400);
  });

  it('rate limits a chatty visitor', async () => {
    const client = { messages: { parse: async () => ({ stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, parsed_output: { answer: 'ok', citations: [], covered: true } }) } } as unknown as Anthropic;
    const deps = { client, context: 'CTX', limiter: memoryLimiter(1), spend: memorySpend(), dailyCapUsd: 1 };
    expect((await ask('first question', 'v', deps)).status).toBe(200);
    expect((await ask('second question', 'v', deps)).status).toBe(429);
  });
});
