import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDetailedFeatures, resetDetailedFeatures } from './geo';

const topo = { type: 'Topology', arcs: [], objects: { countries: { type: 'GeometryCollection', geometries: [] } } };
const ok = () => Promise.resolve(new Response(JSON.stringify(topo), { status: 200 }));
const down = () => Promise.reject(new TypeError('Failed to fetch'));

describe('1:50m geometry', () => {
  beforeEach(() => resetDetailedFeatures());

  it('retries after a failed fetch, but not more than once every 30 s', async () => {
    let t = 1_000_000;
    const now = () => t;
    const fetcher = vi.fn(down);
    await expect(loadDetailedFeatures(fetcher as unknown as typeof fetch, now)).rejects.toThrow();
    t += 5_000;
    await expect(loadDetailedFeatures(fetcher as unknown as typeof fetch, now)).rejects.toThrow(/waiting to retry/);
    expect(fetcher).toHaveBeenCalledTimes(1);
    t += 30_000;
    const recovered = vi.fn(ok);
    await expect(loadDetailedFeatures(recovered as unknown as typeof fetch, now)).resolves.toEqual([]);
    expect(recovered).toHaveBeenCalledTimes(1);
  });

  it('caches a successful load', async () => {
    const fetcher = vi.fn(ok);
    await loadDetailedFeatures(fetcher as unknown as typeof fetch);
    await loadDetailedFeatures(fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('treats HTTP errors as failures', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response('', { status: 500 })));
    await expect(loadDetailedFeatures(fetcher as unknown as typeof fetch)).rejects.toThrow(/HTTP 500/);
  });
});
