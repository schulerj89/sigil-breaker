# Observations: smoke-qa-agent

Status: complete for MVP-fast input/collision/layout plus coordinate/cache/effect-pose, pitch-corrected tracer math, entry-splitter, movement-route, browser zoom-guard, and hold-fire smoke.

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
- Unit tests now pin the reported pinch coordinates and the weapon-only footprint overlap case.
- Latest Playwright smoke after entry-width and shot-effect alignment fixes passed all five landscape viewports.
- Browser smoke now holds fire, verifies ammo and shot count changed by cadence, and checks `snapshot.weapon.effectPose` for a muzzle moving toward center plus aligned tracer/impact positions.
- Latest Playwright smoke after structural entry splitter validation passed all five landscape viewports.
- Unit coverage now pins the user-reported world coordinates near row 39/40 and the widened row 30/39 entry slices.
- Latest Playwright smoke now drives a near-spawn keyboard route into the top wall, verifies the body footprint stays clear while pushing against the wall, then escapes and moves east across all five landscape viewports.
- Unit coverage now verifies body-only player collision, weapon-only overlap as a non-blocking visual condition, wall depenetration, and tangential slide while pressed into a wall.
- Latest unit coverage verifies per-weapon muzzle offsets and pitch-corrected conversion from flat X/Z wall raycast distance to camera-space tracer distance.
- Captured SPARK, BORE, and VAULT level/fire screenshots plus SPARK pitch-up/pitch-down firing frames under `artifacts/sub-agents/20260704-weapon-framing/smoke-qa-agent/`.
- Latest `npm run validate:browser` passed all five landscape viewports after per-weapon muzzle and pitch-distance changes.
- Browser smoke now checks `visualViewport.scale`, simulates a full-canvas double tap, simulates a two-finger pinch with CDP touch events, dispatches WebKit-style gesture events, and sends a ctrl-wheel zoom gesture.
- The smoke gate asserts the debug zoom-guard counters move while viewport scale remains locked at 1, then holds move/look touches while firing to check pointer stability.
- MVP browser smoke still boots all five required landscape viewports, but only `chromium-modern-phone-landscape` runs the heavier movement route and active zoom/multitouch gesture checks.
- Local `npm run test:e2e` measured about 19 seconds after the MVP split and two-worker Playwright config.
- Latest `npm run validate:browser` passed all five landscape viewports after taller walls, larger guns, hold-fire aim zoom, reticle fire icon, and gun-cycle button changes.
- Browser smoke now holds the fire button long enough to verify multiple shots, ammo reduction, `weapon.isFireHeld`, positive `weapon.aimBlend`, and reduced `weapon.cameraFovDegrees`.
- Browser smoke verifies hold release stops further shots and clears `weapon.isFireHeld`.
- Browser smoke checks the fire button has no `F` text, the reticle and gun icons are visible, touch controls fit the viewport, touch targets are at least 44 px, and fire/cycle/stick controls do not overlap.
- Browser smoke cycles from SPARK to BORE through the gun-icon button and checks the updated aria label.
- Renderer budget assertions now include draw calls, triangles, geometries, and textures against the debug budget object.

## Decisions

- Keep manual browser smoke for exploratory checks that are not scripted yet.
- Use Playwright browser smoke for production-preview boot, HUD, debug API, canvas, and asset-cache gates.
- Use Playwright browser smoke for hold-fire ammo/shot-count, release cleanup, FOV, aim-blend, and effect-pose regressions.
- Keep using `visualViewport.scale` as the smoke signal for double-tap zoom regressions.
- Keep an initial viewport-scale assertion before the movement route, then run active gesture smoke after deterministic movement so look-zone drags cannot rotate the route setup.
- Use Playwright as the automated browser smoke harness for production preview and Pages path validation.
- Use the `qaCapture=1` query only for capture/readback reliability; normal production users keep `preserveDrawingBuffer` off.
- Use `snapshot.weapon.effectPose` as the automated source for tracer alignment because the primitive tracer can disappear between screenshots.
- Use two Playwright workers for MVP browser smoke while keeping the heavier route on one viewport to avoid repeating the same WebGL interaction path five times.
- Treat hold-fire as the canonical automated firing path; single tap can be manually checked but should not be the primary smoke signal.
- Keep icon/control-fit checks in all viewports because the new weapon-cycle button shares the right-side action pad.

## Caught Issues

- Initial smoke caught a missing `Textures/colormap.png` dependency from the GLBs; the texture is now committed and validated.
- Visible dev-browser FPS reported around 57 FPS during smoke, so production profiling should stay on the performance agent backlog.
- Visible dev-browser FPS reported around 56 FPS during the latest 844 x 390 smoke.
- Playwright initially caught that plain `vite preview` did not serve the production `/sigil-breaker/` base path like GitHub Pages; a Pages preview server now covers that path.
- Playwright/HUD review caught the coordinate badge crowding risk on 667 px landscape; HUD fit assertions and CSS wrapping now cover it.
- Level QA caught no remaining corner pinches after the six tile closures.
- Weapon wall avoidance is exposed as `snapshot.weapon.wallAvoidance`; the browser route now covers movement near a wall, while close-wall look rotation remains future work.
- Still screenshots confirmed BORE and VAULT sit lower in the landscape frame, but visual tuning remains approximate until final first-person weapon assets exist.
- Existing UI-control-only no-zoom coverage missed the full look/canvas surface and pinch paths.
- Repeating full movement/gesture smoke across all five viewports made the Pages workflow slow for MVP-level coverage.
- Earlier fire smoke only proved one shot; it did not catch hold cadence, release cleanup, FOV zoom, or weapon-centering state.

## Next Handoff Notes

- Next smoke slice should add weapon switching and fast-fire/no-zoom coverage.
- Add automated close-wall turn/retract coverage once debug pose controls or deterministic input routes exist.
- Future screenshot QA should use deterministic debug look poses for pitch-up and pitch-down firing rather than pointer-drag approximation.
- Physical-device smoke should retry two-finger pinch and double tap on mobile Safari because headless Chromium cannot fully represent every browser chrome behavior.
- Re-expand full-route coverage per viewport when viewport-specific gameplay bugs appear or before a larger release gate.
- Next screenshot QA should capture the held-fire centered pose for SPARK, BORE, and VAULT, because current automation checks debug pose rather than visual framing.
