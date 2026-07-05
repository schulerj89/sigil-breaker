# Observations: smoke-qa-agent

Status: complete for MVP-fast input/collision/layout plus coordinate/cache/effect-pose, pitch-corrected tracer math, entry-splitter, movement-route, browser zoom-guard, smoothed hold-fire smoke, foundation texture smoke, ElevenLabs audio smoke, weapon cycle button smoke, and phone-only animated portrait rotate prompt smoke.

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
- Latest `npm run validate:browser` passed all five landscape viewports after taller walls, larger guns, hold-fire aim zoom, and reticle fire icon changes.
- Browser smoke now holds the fire button long enough to verify multiple shots, ammo reduction, `weapon.isFireHeld`, positive `weapon.aimBlend`, and reduced `weapon.cameraFovDegrees`.
- Browser smoke now holds the fire button through Playwright pointer down/up and waits for debug shot count before releasing, instead of relying on a fixed short hold duration or CDP touch delivery.
- All viewports still prove the fire control produces a shot; multi-shot cadence, FOV/aim blend, and effect-pose details stay scoped to `chromium-modern-phone-landscape`.
- Browser smoke verifies hold release stops further shots and clears `weapon.isFireHeld`.
- Browser smoke checks the fire button has no `F` text, the reticle icon is visible, the removed gun-cycle selector is absent, touch controls fit the viewport, touch targets are at least 44 px, and fire/stick controls do not overlap.
- Browser smoke now expects three environment texture asset IDs, verifies the Kenney environment texture URLs are cache-busted, and includes level texture load errors in the top-level asset error check.
- Renderer budget assertions now include draw calls, triangles, geometries, and textures against the debug budget object.
- Browser smoke now waits for renderer texture count before validating the initial frame so the steel foundation textures are uploaded, not just downloaded.
- Screenshot QA confirmed the steel floor, wall, roof, and centered held-fire SPARK pose in a temporary 844 x 390 gameplay-height capture.
- The heavy `chromium-modern-phone-landscape` project now runs a five-iteration QA restart loop and rechecks loaded asset IDs plus renderer budgets after each restart.
- Browser smoke now expects four cache-busted ElevenLabs audio asset IDs in the debug loaded asset list.
- Browser smoke verifies the music mute icon is visible, toggles `snapshot.weapon.audio.musicMuted`, and checks MP3 resource URLs include `assetBuild`.
- Browser smoke now switches the heavy viewport to portrait, verifies the rotate prompt covers the viewport with a visible icon, then switches back to landscape.
- Browser smoke now verifies the bottom weapon tray and `[data-weapon-button]` elements are absent.
- Browser smoke verifies `[data-weapon-cycle-button]` is visible, then cycles SPARK to BORE to VAULT and back to SPARK while checking HUD label and `data-active-weapon-id`.
- Browser smoke expects zero runtime weapon preview resource URLs because the preview tray has been removed.
- Browser smoke checks the rotate prompt phone and arrow have active CSS animation names.
- Browser smoke now expects the rotate prompt arrow to be absent and the phone animation to be active.
- Browser smoke now checks `snapshot.weapon.effectStyle` while cycling weapons so SPARK, BORE, and VAULT keep distinct effect colors.
- The Playwright request-failed filter now narrowly ignores only Chromium `net::ERR_ABORTED` audio request shutdowns for the ElevenLabs audio path.
- CI smoke now uses a synthetic cancelable `WheelEvent` for the ctrl-wheel zoom guard because `page.mouse.wheel` was timing-sensitive under mobile emulation.
- The e2e per-test timeout is 240 seconds so the heavy modern-phone project has enough GitHub runner headroom.
- GitHub Pages deploy CI is intentionally lightweight now; local validation is the testing gate before commit/push.
- Phone-only rotate prompt screenshot is stored under `artifacts/sub-agents/20260704-weapon-effects-smoothing/smoke-qa-agent/`.
- Latest screenshot artifacts live under `artifacts/sub-agents/20260704-weapon-cycle-burst/smoke-qa-agent/`.

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
- Keep reticle/control-fit checks in all viewports because the right-side action pad remains a thumb-zone risk.
- Keep audio URL cache-busting in the smoke gate because stale Pages audio can otherwise survive deploys.
- Keep the portrait rotate prompt coverage scoped to the heavy viewport until portrait-specific regressions appear.
- Treat the single weapon cycle button as the MVP weapon switching contract; do not expect preview thumbnail buttons in browser smoke.
- Keep rotate-prompt animation checks lightweight by reading the phone's computed animation name rather than relying on pixel timing.
- Keep heavy browser smoke out of the Pages workflow unless the deploy gate strategy is intentionally revisited.
- Use deterministic synthetic DOM events for zoom-guard assertions when browser chrome or input emulation is not the thing being tested.
- Use Playwright `tap()` for mobile-only UI controls when click suppression is the bug class being tested.
- Keep enemy movement smoke state-based rather than frame-exact; positions are animated and should not be asserted to exact frame values after boot.
- Use the `qaCapture` debug pose hook for deterministic enemy screenshots instead of manual movement when checking model placement.

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
- HTMLMediaElement MP3 fetches can emit `net::ERR_ABORTED` when the page closes after cycling/mute tests; the smoke filter is intentionally scoped to that ElevenLabs audio path only.
- GitHub Actions caught that `page.mouse.wheel` plus Control could wait too long under mobile emulation; direct `WheelEvent` dispatch now tests the same zoom-guard handler without depending on that input path.
- The old rotate arrow made the portrait prompt look noisy; smoke should keep checking that only the phone animation remains.
- Timed flash screenshots are unreliable in headless capture, so per-weapon effect color is asserted through `snapshot.weapon.effectStyle`.
- For this pass, only the rotate-prompt screenshot was kept because held-fire headless frames did not capture readable weapon flashes.
- `Dbg` looked clickable under Playwright `click()`, but mobile touch could suppress the synthetic click; smoke now covers the real tap path.
- The first enemy marker was too close to spawn and made the opening read as enemy overlap or stuck behavior.
- Tight enemy ray proxies let visible hits feel like misses; unit smoke now checks the hit flash turns visible on a landed shot.
- Raw skinned-GLB cloning made bounds look valid while the visible model body was missing in headed screenshots.

## Next Handoff Notes

- Next smoke slice should keep weapon cycle and fast-fire/no-zoom coverage.
- Add automated close-wall turn/retract coverage once debug pose controls or deterministic input routes exist.
- Future screenshot QA should use deterministic debug look poses for pitch-up and pitch-down firing rather than pointer-drag approximation.
- Physical-device smoke should retry two-finger pinch and double tap on mobile Safari because headless Chromium cannot fully represent every browser chrome behavior.
- Re-expand full-route coverage per viewport when viewport-specific gameplay bugs appear or before a larger release gate.
- Next screenshot QA should capture the held-fire centered pose for SPARK, BORE, and VAULT, because current automation checks debug pose rather than visual framing.
- Future screenshot QA should use deterministic debug look poses if the steel floor, wall, or roof art direction changes.
- Reset-loop smoke now covers renderer debug counts, but full GPU/heap leak confidence still belongs to memory-lifecycle QA.
- Future screenshot QA should capture the portrait rotate prompt and the held-fire muzzle flash for all three weapons once deterministic flash capture exists.
- Future screenshot QA should capture the centered flash for SPARK, BORE, and VAULT once deterministic debug fire-frame controls exist.
- Browser smoke now verifies player health is reported at 100/100, the health bar remains visible after hiding debug HUD badges, and `snapshot.ui.debugVisible` toggles.
- Browser smoke now verifies 12 external GLB enemies exist at boot and the full interaction project destroys the first GLB target through the normal hold-fire path.
- `npm run validate:browser` passed all five landscape viewports after adding health, debug toggle, and enemy destruction checks.
- Browser smoke now waits for 17 loaded asset IDs: 3 environment textures, 5 weapon models, 6 ElevenLabs audio assets, and 3 enemy GLBs.
- Browser smoke now checks RIFT and TORCH in the weapon cycle, including effect colors and active weapon stat fields.
- Browser smoke now confirms enemy GLB URLs are cache-busted and that hiding debug also hides weapon/ammo/debug badges while health, mute, controls, and d-pad remain visible.
- Latest `npm run validate:browser` passed all five landscape viewports after the enemy GLB, five-gun, longer music, and debug-hide updates.
- Future screenshot QA should capture debug-on and debug-off enemy radius/front-cone views from deterministic camera poses.
- Browser smoke now verifies 12 `E` enemy markers in the map, one `X` endpoint marker, and 12 runtime enemies spawned from marker coordinates.
- Browser smoke now uses mobile `tap()` for the debug toggle, verifies the debug UI snapshot changes, and checks scene enemy debug radius/front-cone visuals hide and show with the toggle.
- Browser smoke verifies each enemy reports marker, origin, behavior, detect radius, lose radius, facing yaw, and debug visibility fields.
- Latest `npm run validate:browser` passed all five landscape viewports after adding map-authored enemies, movement/tracking, return-home patrol behavior, and touch-safe debug toggling.
- Future screenshot QA should use deterministic camera poses for enemy hit/death frames; the latest focused pass used debug snapshots for placement and destruction confidence.
- Browser smoke now expects the first enemy marker at row 1, column 12 with state `patrolling` from spawn, so enemy placement does not immediately cluster beside the player.
- Latest `npm run validate:browser` passed all five landscape viewports after the enemy spacing, larger hit proxy, hit flash, and enemy separation fixes.
- Focused Pages-preview QA at 844 x 390 reported the first two enemies 18.09 units apart and confirmed hold-fire destroyed `enemy.monster.mushnub.vanguard` through the normal fire button path.
- Browser smoke now checks every enemy's visual/proxy/debug/flash attachment anchors and GLB model bounds against the runtime enemy position.
- Headed Chromium QA (`headless: false`) confirmed all 12 enemies moved over 1200 ms, no attachment/model bounds detached, and the posed screenshot shows the Mushnub body on its debug radius.
- The headed QA report is stored under `artifacts/sub-agents/20260704-enemy-headed/smoke-qa-agent/`.
- Added `npm run qa:headed:enemies` as a repeatable local visible-Chromium enemy QA runner.
- Latest headed enemy QA passed with no console errors, no failed requests, all 12 enemies moving within a sampled 1200 ms window, and no detached attachment/model bounds.
- The headed enemy movement check uses maximum displacement across intermediate samples because looping patrols can return near their start on the final frame.
- Latest headed enemy facing/audio run stored under `artifacts/sub-agents/20260705-enemy-facing-audio/smoke-qa-agent/` includes `headed-first-enemy-facing-close.png`, which shows the Mushnub eyes facing the player and aligned with the red debug cone.
- Latest `npm run validate:browser` passed all five landscape viewports after adding SFX pool/debug counters; browser smoke checks SFX pool profiles, play request growth, audio unlock, and zero missed SFX play requests during hold-fire.
- Latest `npm run validate:browser` passed all five landscape viewports after adding the generated title screen, asset-loading gate, and start button flow.
- Browser smoke now waits for `snapshot.scene.phase === "title"`, verifies 18 boot assets including `ui.title.background.sigilbreaker.generated`, clicks `[data-title-start]`, and verifies `snapshot.scene.phase === "gameplay"`.
- Browser smoke verifies the title background WebP URL is cache-busted with `assetBuild`.
- Focused title screenshot is stored under `artifacts/sub-agents/20260705-title-screen/smoke-qa-agent/title-screen-844x390.png`.
