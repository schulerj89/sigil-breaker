# Sigilbreaker

Sigilbreaker is being rebuilt as a mobile-first landscape Three.js FPS. The current codebase is a clean Three.js/Vite foundation with a debug arena, mobile HUD shell, touch-control shell, and renderer metrics hooks for the upcoming asset and gameplay pipeline.

## FPS Rewrite Planning

The sub-agent system is scaffolded under `docs/sub-agents/`. That folder defines the asset pipeline, review, QA, mobile controls, audio, camera, and coordination agents to use while building the FPS.

## Local Development

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` type-checks and builds the production bundle.
- `npm test` runs unit tests with Vitest.
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
