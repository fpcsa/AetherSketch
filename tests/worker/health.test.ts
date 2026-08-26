import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from '../../src/utils/health';
import worker from '../../worker';

describe('health Worker endpoint', () => {
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
