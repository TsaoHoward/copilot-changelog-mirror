# Render verification

The former issue #13 v1 verification procedure is retired. Use the [v2 cutover runbook](v2-cutover.md) and [acceptance matrix](v2-acceptance.md) for production verification.

Offline editorial behavior remains protected by `tests/v2/production-render.test.ts` and `tests/v2/site-production.test.ts`, using the unchanged six saved source articles and 123 independently reviewed editorial blocks in `tests/fixtures/production/`. Real Node commands verify metadata/body ownership, links, sections, media, deterministic identities and source-acquisition blocking. `npm run test:browser` checks the finished Astro/Pagefind artifact in Chromium.

Local tests do not prove hosted persistence, workflow chaining, deployment, public search or scheduled events. Record those independently on #24.
