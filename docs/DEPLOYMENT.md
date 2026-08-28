# Cloudflare deployment and release checks

AetherSketch deploys as **one Cloudflare Worker with static assets**. The React SPA and `GET /api/health` share the URL printed by Wrangler. There is no separate API host, Pages project, database, or runtime secret.

## Configuration

Verified against the current [React SPA + API tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/), [static assets reference](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/), and [Worker routing reference](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

- `vite.config.ts` uses React, Tailwind, and `@cloudflare/vite-plugin`.
- `wrangler.jsonc` names the Worker `aethersketch`, pins the tested compatibility date, and points to `worker/index.ts`.
- `assets.not_found_handling = "single-page-application"` handles direct SPA navigation and refresh.
- `assets.run_worker_first = ["/api", "/api/*"]` keeps health and API errors out of the HTML fallback, including browser navigation to an API URL.
- Vite generates `dist/aethersketch/wrangler.json`, referencing the built Worker and `dist/client` assets. The `.wrangler/deploy/config.json` redirect tells Wrangler which output to deploy. Do not add a source-config `assets.directory` for this Vite setup or hand-edit generated files.
- `public/_headers` applies MIME sniffing protection, referrer policy, explicit origin isolation/same-origin WebMCP policy, and immutable caching for hashed `/assets/*` files. These rules apply to asset responses; the Worker sets its own API headers.

The app has no custom client routes yet: nested page URLs load the same workspace and browser-origin storage. They do not select a different architecture. Unknown APIs remain JSON 404s. With selective Worker routing, unmatched non-API requests use the SPA fallback, even a missing asset path; HTML MIME type and `nosniff` prevent that fallback from executing as JavaScript. The smoke test separately checks every referenced built asset.

## Reproducible local checks

Use Node 24 and the checked-in npm lockfile (the tooling requires Node 22.12 or newer):

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run eval:webmcp
npm run test:production
npx wrangler deploy --dry-run
git diff --check
```

`test:production` runs the production build, opens a temporary local Workers preview on an available port, validates health, GET/HEAD/405 behavior, API JSON 404s, SPA navigation/refresh, entry/preload/icon assets, MIME types and cache headers, then closes the preview. It never contacts a Cloudflare account, publishes, or edits an open browser workspace.

For a visual production check:

```sh
npm run preview
```

Open the printed local URL. Verify the canvas, Reset Demo, imported JSON rejection, analysis, and any available WebMCP tools. The development diagnostics button must be absent from this build. Stop the server when done.

## Owner deployment

The product needs no OpenAI/AWS/database credentials or application environment variables. No `.env.example` is fabricated. Deployment still requires Cloudflare account authorization in Wrangler.

```sh
npx wrangler whoami
# If unauthenticated, complete the owner's browser authorization:
npx wrangler login
# Check the intended Cloudflare account and Worker name before publishing:
npm run deploy
```

`npm run deploy` runs `npm run build` and `wrangler deploy`. If the owner has multiple accounts, select the intended account using supported Wrangler configuration or CLI environment settings. Do not put deployment tokens in Vite variables, source files, architecture JSON, or public assets. `.env*` and `.dev.vars*` are ignored by git.

If credentials are absent, stop at build/preview/dry-run validation and report that no public deployment occurred. Do not substitute a temporary account, invent a public URL, or claim a dry run was a deployment.

## Public URL verification

Use the actual URL returned by Wrangler:

1. Open `/` and verify that the app and local SVG icons render.
2. Navigate directly to `/judge/review`, then refresh. The same SPA must load without a 404.
3. Request `/api/health`; expect HTTP 200, JSON `{"status":"ok","service":"aethersketch"}`, and `Cache-Control: no-store`.
4. Open `/api/missing`; expect JSON HTTP 404, not HTML. Unsupported health methods return 405 with `Allow: GET, HEAD`.
5. Use Reset Demo and verify 5 components, 4 connections, $675, resilience 57, security 76. Run the [canonical demo](DEMO.md) in a supported browser.
6. Confirm unsupported WebMCP does not disable the human editor and that production diagnostics are absent.

Public availability of WebMCP depends on the browser/channel or origin-trial setup described in the [official Chrome guide](https://developer.chrome.com/docs/ai/webmcp); static hosting cannot make an unsupported browser expose the API.

## Assets and performance

The build splits React/Zustand, XYFlow, and Lucide into reusable chunks. Icons are tree-shaken SVG components; the favicon is a local SVG. No cloud-provider SDK or remote font/icon service is bundled. Vite reports raw/gzip sizes during build. Keep screenshots and documentation assets outside `public/` unless they are actually required by the running app.

Review significant size changes before release. Production HTTP checks verify entry assets and preload dependencies; browser QA remains necessary for rendering and interaction. Costs, scores, and failover behavior remain planning models, not live cloud measurements.

## Failure recovery

| Failure                   | Expected behavior                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| localStorage blocked/full | Continue in session memory; persistent warning instructs JSON export before reload/close                             |
| Corrupt saved content     | Restore canonical model with a notice; preserve corrupt source during hydration                                      |
| WebMCP unavailable        | Human canvas, analysis, simulation, and import/export continue                                                       |
| Tool registration failure | Visible status; failed group's registrations revoked; retry by human action                                          |
| Invalid import            | Reject before domain load; current architecture remains unchanged                                                    |
| Analysis failure          | Keep the architecture, mark retained metrics stale, expose retry; do not misreport an already committed import/reset |
| Simulation failure        | Report the error and clear the previous overlay                                                                      |
| Domain/event exception    | Report a workspace notice; validate candidates before commit                                                         |
| Render exception          | Canvas/root boundary offers retry without resetting the architecture                                                 |

Neither a render fallback nor an in-memory commit proves durable storage. Export work when the storage warning is present.

## Submission checklist

- [ ] Complete the local checks above on the intended release commit.
- [ ] Preserve the existing AGPL license and make the submitted source available to judges.
- [ ] Deploy using the intended owner's Cloudflare account.
- [ ] Record and verify the actual public URL.
- [ ] Run the exact demo and confirm reset/metrics/critical-path behavior.
- [ ] State browser, model-evaluation, pricing, simulation, and desktop-layout limitations honestly.
