import assert from 'node:assert/strict';
import http from 'node:http';
import { preview } from 'vite';

// Exercise the generated Worker + assets configuration, not the Vite dev server.
const server = await preview({
  preview: { host: '127.0.0.1', port: 0, strictPort: true },
});
try {
  const address = server.httpServer.address();
  assert(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const request = (path, method = 'GET', navigation = false) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        new URL(path, origin),
        {
          method,
          headers: {
            Accept: navigation ? 'text/html' : '*/*',
            'Sec-Fetch-Mode': navigation ? 'navigate' : 'cors',
          },
        },
        (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            }),
          );
          response.on('error', reject);
        },
      );
      req.on('error', reject);
      req.setTimeout(10_000, () =>
        req.destroy(new Error(`Timed out: ${path}`)),
      );
      req.end();
    });

  const health = await request('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(health.body), {
    status: 'ok',
    service: 'aethersketch',
  });
  assert.equal(health.headers['cache-control'], 'no-store');
  const head = await request('/api/health', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  const wrongMethod = await request('/api/health', 'POST');
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.allow, 'GET, HEAD');
  for (const path of ['/api', '/api/missing']) {
    for (const navigation of [false, true]) {
      const response = await request(path, 'GET', navigation);
      assert.equal(response.status, 404, path);
      assert.equal(JSON.parse(response.body).error.code, 'NOT_FOUND');
    }
  }
  console.log(
    'PASS Worker health, methods, and API 404s (including browser navigation)',
  );

  const root = await request('/', 'GET', true);
  assert.equal(root.status, 200);
  assert.match(root.body, /AetherSketch — Architecture Copilot/);
  assert.match(root.body, /id="root"/);
  assert.doesNotMatch(root.body, /\/src\/main|@vite\/client/);
  assert.equal(root.headers['origin-agent-cluster'], '?1');
  assert.equal(root.headers['permissions-policy'], 'tools=(self)');
  for (const path of ['/judge/review', '/judge/review/']) {
    for (let refresh = 0; refresh < 2; refresh += 1) {
      const page = await request(path, 'GET', true);
      assert.equal(page.status, 200, path);
      assert.equal(page.body, root.body, path);
    }
  }
  console.log('PASS direct SPA navigation and repeated refresh');

  const assets = [
    ...new Set(
      [...root.body.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  assert(assets.includes('/favicon.svg'));
  assert(assets.some((path) => path.endsWith('.js')));
  assert(assets.some((path) => path.endsWith('.css')));
  for (const path of assets) {
    const asset = await request(path);
    assert.equal(asset.status, 200, path);
    assert(asset.body.length > 0, path);
    assert.equal(asset.headers['x-content-type-options'], 'nosniff');
    const contentType = asset.headers['content-type'] ?? '';
    if (path.endsWith('.js')) assert.match(contentType, /javascript/);
    if (path.endsWith('.css')) assert.match(contentType, /text\/css/);
    if (path.endsWith('.svg')) assert.match(contentType, /image\/svg\+xml/);
    if (path.startsWith('/assets/'))
      assert.match(asset.headers['cache-control'] ?? '', /immutable/);
  }
  // Selective Worker routing intentionally sends unmatched non-API paths to the SPA.
  const missingAsset = await request('/assets/missing.js');
  assert.equal(missingAsset.status, 200);
  assert.equal(missingAsset.body, root.body);
  assert.match(missingAsset.headers['content-type'] ?? '', /text\/html/);
  assert.equal(missingAsset.headers['x-content-type-options'], 'nosniff');
  console.log(
    `PASS ${assets.length} built entry/preload/icon assets, MIME types, and cache headers`,
  );
} finally {
  await server.close();
}
