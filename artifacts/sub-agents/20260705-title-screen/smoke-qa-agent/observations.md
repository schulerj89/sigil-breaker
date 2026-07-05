# Smoke QA: Title Screen

Status: complete for local browser smoke.

## Commands

- `npm run build`
- `npm run validate:browser`

## Results

- Playwright passed all five landscape projects.
- The title flow waits for 18 boot assets: 17 gameplay assets plus `ui.title.background.sigilbreaker.generated`.
- Browser smoke verifies `snapshot.scene.phase` reaches `title`, clicks `[data-title-start]`, and verifies `gameplay`.
- Browser smoke verifies the title WebP request is cache-busted with `assetBuild`.
- Captured screenshot: `title-screen-844x390.png`.

## Caught Issues

- The first screenshot caught the loading overlay fading under the title. The hidden full-screen overlays now use `display: none`.
- The left title zone was darkened so generated art details do not read as stray UI near the title.
