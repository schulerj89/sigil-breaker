# Observations: smoke-qa-agent

Status: complete for input/collision/layout plus coordinate/cache/effect-pose browser smoke.

## What It Saw

- Ran in-browser smoke at an 844 x 390 landscape viewport against the local dev server.
- Verified all three weapon asset IDs load, the weapon selector changes active state, and the fire button decrements ammo/increments shot count.
- Verified the shared Kenney texture URL returns 200 and the debug API reports no asset load errors.
- Captured a landscape screenshot with HUD, d-pad, weapon tray, VAULT viewmodel, and fire button visible.
- Re-ran smoke after the input/collision pass: repeated fire kept viewport scale at 1 and lastShot reported a wall hit at tile `[22, 1]`.
- Captured a new landscape screenshot showing the SPARK viewmodel facing forward with HUD and touch controls visible.
- Fresh reload CDP event check reported no new log or exception events.
- Added Playwright browser smoke that runs against a production Pages preview under `/sigil-breaker/`.
- Latest Playwright smoke passed at 667 x 375, 740 x 360, 844 x 390, 932 x 430, and 1024 x 768.
- The browser smoke checks the coordinate HUD, nonblank WebGL canvas, debug API state, asset load errors, HUD fit, and cache-busted weapon resources.
- Weapon previews, GLB models, and the GLB shared texture are asserted to carry the current `assetBuild` query.
- Latest Playwright smoke after level pinch and weapon-clearance fixes passed all five landscape viewports.
- Unit tests now pin the reported pinch coordinates and the weapon footprint collision case.
- Latest Playwright smoke after entry-width and shot-effect alignment fixes passed all five landscape viewports.
- Browser smoke now fires once, verifies ammo and shot count changed, and checks `snapshot.weapon.effectPose` for a right-offset muzzle plus aligned tracer/impact positions.

## Decisions

- Keep manual browser smoke for exploratory checks that are not scripted yet.
- Use Playwright browser smoke for production-preview boot, HUD, debug API, canvas, and asset-cache gates.
- Use Playwright browser smoke for one-shot ammo/shot-count and effect-pose regressions.
- Keep using `visualViewport.scale` as the smoke signal for double-tap zoom regressions.
- Use Playwright as the automated browser smoke harness for production preview and Pages path validation.
- Use the `qaCapture=1` query only for capture/readback reliability; normal production users keep `preserveDrawingBuffer` off.

## Caught Issues

- Initial smoke caught a missing `Textures/colormap.png` dependency from the GLBs; the texture is now committed and validated.
- Visible dev-browser FPS reported around 57 FPS during smoke, so production profiling should stay on the performance agent backlog.
- Visible dev-browser FPS reported around 56 FPS during the latest 844 x 390 smoke.
- Playwright initially caught that plain `vite preview` did not serve the production `/sigil-breaker/` base path like GitHub Pages; a Pages preview server now covers that path.
- Playwright/HUD review caught the coordinate badge crowding risk on 667 px landscape; HUD fit assertions and CSS wrapping now cover it.
- Level QA caught no remaining corner pinches after the six tile closures.
- Weapon wall avoidance is exposed as `snapshot.weapon.wallAvoidance`, but a browser interaction assertion for close-wall turning is still future work.

## Next Handoff Notes

- Next smoke slice should add weapon switching and fast-fire/no-zoom coverage.
- Add automated wall-hit route assertions when deterministic debug poses exist.
- Add automated close-wall turn/retract coverage once debug pose controls or deterministic input routes exist.
