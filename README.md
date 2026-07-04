# Sigilbreaker

Sigilbreaker is being rebuilt as a mobile-first landscape Three.js FPS. The current codebase is a clean Three.js/Vite foundation with a debug arena, mobile HUD shell, touch-control shell, and renderer metrics hooks for the upcoming asset and gameplay pipeline.

## FPS Rewrite Planning

The sub-agent system is scaffolded under `docs/sub-agents/`. That folder defines the asset pipeline, review, QA, mobile controls, audio, camera, and coordination agents to use while building the FPS.

## Foundation Level

The first playable foundation is a bare 45 x 45 unit FPS level built from a structured symbol map in `src/game/foundationLevelMap.json`. A readable copy with the `#`, `.`, `S`, `C`, and `E` legend is in `docs/level-foundation.md`. The level is partitioned into 9 x 9 tile chunks so runtime loading can grow toward asset-backed streaming.

## Local Development

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` type-checks and builds the production bundle.
- `npm test` runs unit tests with Vitest.
- `npm run test:e2e` runs Playwright browser smoke tests against the production Pages preview.
- `npm run validate:browser` builds and then runs the Playwright browser smoke tests.
- `npm run validate:levels` runs the standalone level QA checker for map dimensions, boundaries, reachability, and minimum traversal width.
- `npm run validate:assets` verifies external asset paths, hashes, sizes, and source-ledger entries.
- `npm run lint` runs ESLint.

## Runtime Debug Hook

The app exposes `window.__SIGILBREAKER_DEBUG__.getSnapshot()` for QA and future Playwright smoke tests. The snapshot reports scene state, viewport, renderer metrics, memory counters, loaded asset IDs, and asset load errors.

## GitHub Pages

This repository is configured as a normal GitHub Pages project repository, so the production Vite base path is `/sigil-breaker/`.

Deployment steps:

1. Push to `main`.
2. In GitHub, open repository Settings.
3. Under Pages, set Source to GitHub Actions.
4. The `Deploy GitHub Pages` workflow will run `npm ci`, `npm test`, and `npm run build`, then publish `dist/`.

If this project is ever moved to a user or organization site repository named `USERNAME.github.io`, change the production Vite base path in `vite.config.ts` from `/sigil-breaker/` to `/`.

The workflow also prepares `.nojekyll`, `404.html`, `version.json`, hashed Vite assets, and a build-id meta tag. Runtime cache checking fetches `version.json` with a cache-busting query and reloads with a build query when a newer deployed build is detected.
