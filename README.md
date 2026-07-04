# Sigilbreaker

Sigilbreaker is a browser-based turn-based grid puzzle strategy game built with TypeScript, Vite, and Phaser.

## Future FPS Rewrite Planning

The planned mobile-first landscape Three.js FPS rewrite is scaffolded under `docs/sub-agents/`. That folder defines the asset pipeline, review, QA, mobile controls, audio, camera, and coordination sub-agents to use before replacing the MVP game code.

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

## GitHub Pages

This repository is configured as a normal GitHub Pages project repository, so the production Vite base path is `/sigil-breaker/`.

Deployment steps:

1. Push to `main`.
2. In GitHub, open repository Settings.
3. Under Pages, set Source to GitHub Actions.
4. The `Deploy GitHub Pages` workflow will run `npm ci`, `npm test`, and `npm run build`, then publish `dist/`.

If this project is ever moved to a user or organization site repository named `USERNAME.github.io`, change the production Vite base path in `vite.config.ts` from `/sigil-breaker/` to `/`.

No Kenney asset binaries are included in this repository. Place CC0 assets manually under `public/assets/kenney/sokoban/` when ready.
