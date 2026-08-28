import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from '../../src/utils/health';
import worker from '../../worker';

describe('health Worker endpoint', () => {
  it('supports HEAD health checks and rejects unsupported methods', async () => {
    const head = worker.fetch(
      new Request('https://aethersketch.test/api/health', { method: 'HEAD' }),
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    const post = worker.fetch(
      new Request('https://aethersketch.test/api/health', { method: 'POST' }),
    );
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toBe('GET, HEAD');
    expect(post.headers.get('Cache-Control')).toBe('no-store');
    expect(await post.json()).toMatchObject({
      error: { code: 'METHOD_NOT_ALLOWED' },
    });
  });

  it('keeps the API root out of SPA fallback', async () => {
    const response = worker.fetch(new Request('https://aethersketch.test/api'));
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await response.json()).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });
  it('returns the expected service health response', async () => {
    const response = worker.fetch(
      new Request('https://aethersketch.test/api/health'),
    );
    const payload: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(healthResponseSchema.parse(payload)).toEqual({
      status: 'ok',
      service: 'aethersketch',
    });
  });

  it('returns a structured 404 for unknown API routes', async () => {
    const response = worker.fetch(
      new Request('https://aethersketch.test/api/unknown'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'API route not found.',
      },
    });
  });
});
