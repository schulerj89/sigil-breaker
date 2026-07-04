# Observations: performance-budget-agent

Status: needs review after input/collision/effect-pose/entry-splitter, body-collision resolver, pitch shot math, zoom guard, hold-fire aim, foundation textures, and MVP browser-smoke pass.

## What It Saw

- Added three small GLB weapon models to the current Three.js foundation scene.
- Debug metrics now include `weaponModelBytesLoaded`, weapon `loadedAssetIds`, and weapon asset load errors.
- `scripts/validate-assets.mjs` caps the first weapon payload through source-ledger validation.
- Browser smoke reported 57 FPS in the dev server at 844 x 390 with the VAULT weapon active.
- Latest 844 x 390 smoke reported about 56 FPS after adding shot tracer/impact primitives and wall raycasts.
- Coordinate HUD text and URL query rewriting add no meaningful render geometry or asset payload.
- Playwright production-preview smoke now runs the five landscape viewport gates serially to avoid headless WebGL contention.
- `qaCapture=1` enables `preserveDrawingBuffer` only for QA readback/screenshots; normal production users keep it off.
- Player movement now uses a nearby-tile body collision resolver only while movement input is active; weapon wall avoidance still adds one ray/probe per weapon update.
- The level pinch fix removes six walkable cells and does not add render assets.
- The entry-width fix opens eight walkable cells and does not add render assets.
- `weaponViewPose.ts` adds small shot-time/effect-visible camera-local math so tracer placement follows the same pose as the viewmodel.
- Latest production-preview Playwright smoke passed all five landscape viewports after the entry-width and effect-pose changes.
- The entry-splitter fix opens five additional walkable cells and does not add render assets.
- Latest production-preview Playwright smoke passed all five landscape viewports after the splitter validator and map widening changes.
- Latest production-preview Playwright smoke passed all five landscape viewports after adding the body collision resolver and keyboard wall-push route.
- Per-weapon muzzle offsets are manifest-only data and do not add render assets.
- Pitch-corrected shot math adds CPU-only scalar conversion between flat X/Z wall raycast distance and camera-space tracer distance.
- Latest production-preview Playwright smoke passed all five landscape viewports after per-weapon muzzle and pitch-distance changes.
- The mobile zoom guard adds non-passive event listeners and debug counters only; it adds no scene objects, textures, geometries, or per-frame render work.
- Browser smoke now uses two Playwright workers and limits full movement/gesture interaction coverage to `chromium-modern-phone-landscape`; all five viewports still run boot, HUD, asset, canvas, cache, viewport-scale, and hold-fire checks.
- Local `npm run test:e2e` measured about 19 seconds after the MVP split.
- Taller foundation walls reuse the existing instanced wall geometry path and add no new draw calls or textures.
- Larger gun scale and per-weapon aim poses are manifest/math changes; they add no new model payload.
- Hold-fire aim adds one camera FOV blend, one viewmodel pose blend, and cadence-gated shooting while held.
- The reticle icon is a CSS-only DOM control and adds no WebGL resources; the extra gun-cycle icon button was removed.
- Latest production JS chunk is about 651.34 kB minified and still triggers the known Vite large chunk warning.
- Latest `npm run validate:browser` passed all five landscape viewports in 41.2 seconds with two workers and the QA restart loop.
- Browser smoke now asserts render calls, triangles, geometries, and textures against the debug budget object.
- The foundation texture pass adds three 1024 x 1024 PNG textures totaling 16588B source payload and about 12MB decoded RGBA estimate.
- The full-level roof adds one PlaneGeometry, one MeshBasicMaterial, and one draw call.
- The foundation floor, wall, and roof use unlit textured materials so the prototype colors stay visible without extra lighting work.
- The heavy browser smoke project now restarts the app five times through the QA restart hook and rechecks loaded assets plus renderer budgets each time.

## Decisions

- Keep all three first weapon GLBs preloaded for selector responsiveness; payload is well under the current budget.
- Keep the weapon slice, but profile production preview before adding heavier enemy/building assets.
- The new shot feedback primitives are short-lived and add minimal geometry, but FPS still needs production-preview comparison.
- Query-based cache invalidation should not change GPU memory, but it can create duplicate browser-cache entries across builds.
- Do not use Playwright QA-capture FPS as the final gameplay performance number because preserveDrawingBuffer can reduce FPS.
- Keep the tile-based body resolver and weapon wall-avoidance probes while the level is grid-backed; revisit if collision becomes per-mesh.
- Keep the shared shot-effect pose helper; it avoids extra scene objects and keeps placement math unit-testable.
- Keep zoom prevention out of the animation loop; smoke should verify counters through the existing debug snapshot.
- Keep MVP smoke focused on one full interaction route plus all-viewport layout/boot checks until the game grows beyond prototype scope.
- Keep hold-fire pose/FOV math in scalar helpers and existing objects instead of adding extra scene graph probes.
- Use the existing renderer budget counters as the MVP gate until visible-device FPS profiling is repeated.
- Keep the roof as one shared plane and keep floor/wall/roof textures shared by material to avoid per-chunk texture duplication.

## Caught Issues

- The weapon slice is lightweight, but GLB loading now makes disposal and loaded-asset reporting part of the runtime surface.
- GLB texture dependencies must be committed and validated; the first browser smoke caught the missing shared colormap.
- Shot collision is CPU tile raycast only; it does not introduce physics or extra asset payload.
- Coordinate HUD is DOM text only and should remain in debug metrics rather than the final combat HUD.
- The build still emits Vite's large chunk warning around the Three.js bundle.
- The build JS chunk increased slightly after adding the shared weapon clearance module and wall-avoidance debug field.
- The production JS chunk is now about 644.59 kB minified after adding the pitch-distance helper.
- The earlier all-viewport full interaction smoke repeated the same route and gesture work five times, which was disproportionate for MVP CI.
- Continuous fire increases audio/effect churn by cadence, but the current visible primitives are reused and not recreated per shot.

## Next Handoff Notes

- Memory-lifecycle and smoke QA should verify loaded model bytes and no asset errors in the debug API.
- Next performance pass should compare production preview FPS against dev-server FPS.
- Watch FPS before adding enemies because dev smoke is still below the 60 target.
- Future asset streaming should account for cache-busted URLs when comparing network/cache behavior between builds.
- Future performance profiling should measure close-wall movement with body collision resolution and weapon avoidance active.
- Future performance profiling should measure repeated firing with effect-pose updates visible, although the current helper is lightweight.
- Entry-splitter validation is build/test-time only and should not affect runtime frame budget.
- Future mobile profiling should check that pinch/double-tap guard listeners do not interfere with simultaneous move/look/fire pointer throughput.
- Restore broader per-viewport interaction routes before beta/release gates or when a viewport-specific gameplay issue is suspected.
- Future profiling should measure sustained held fire on physical mobile hardware, not just one-shot smoke.
- Future profiling should compare visible FPS with the roof on/off if enclosure or texture fill-rate becomes a concern.
- Memory-lifecycle QA should still add a deeper heap/GPU leak pass; the current restart smoke only watches debug renderer counters.
