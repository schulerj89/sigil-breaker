# Observations: performance-budget-agent

Status: needs review after input/collision and browser-smoke pass.

## What It Saw

- Added three small GLB weapon models to the current Three.js foundation scene.
- Debug metrics now include `weaponModelBytesLoaded`, weapon `loadedAssetIds`, and weapon asset load errors.
- `scripts/validate-assets.mjs` caps the first weapon payload through source-ledger validation.
- Browser smoke reported 57 FPS in the dev server at 844 x 390 with the VAULT weapon active.
- Latest 844 x 390 smoke reported about 56 FPS after adding shot tracer/impact primitives and wall raycasts.
- Coordinate HUD text and URL query rewriting add no meaningful render geometry or asset payload.
- Playwright production-preview smoke now runs the five landscape viewport gates serially to avoid headless WebGL contention.
- `qaCapture=1` enables `preserveDrawingBuffer` only for QA readback/screenshots; normal production users keep it off.
- Weapon-aware collision adds one extra level-footprint probe for movement and one wall-avoidance ray/probe per weapon update.
- The level pinch fix removes six walkable cells and does not add render assets.

## Decisions

- Keep all three first weapon GLBs preloaded for selector responsiveness; payload is well under the current budget.
- Keep the weapon slice, but profile production preview before adding heavier enemy/building assets.
- The new shot feedback primitives are short-lived and add minimal geometry, but FPS still needs production-preview comparison.
- Query-based cache invalidation should not change GPU memory, but it can create duplicate browser-cache entries across builds.
- Do not use Playwright QA-capture FPS as the final gameplay performance number because preserveDrawingBuffer can reduce FPS.
- Keep the weapon wall-avoidance probes while the weapon set is small; revisit if weapon logic becomes per-projectile or per-mesh.

## Caught Issues

- The weapon slice is lightweight, but GLB loading now makes disposal and loaded-asset reporting part of the runtime surface.
- GLB texture dependencies must be committed and validated; the first browser smoke caught the missing shared colormap.
- Shot collision is CPU tile raycast only; it does not introduce physics or extra asset payload.
- Coordinate HUD is DOM text only and should remain in debug metrics rather than the final combat HUD.
- The build still emits Vite's large chunk warning around the Three.js bundle.
- The build JS chunk increased slightly after adding the shared weapon clearance module and wall-avoidance debug field.

## Next Handoff Notes

- Memory-lifecycle and smoke QA should verify loaded model bytes and no asset errors in the debug API.
- Next performance pass should compare production preview FPS against dev-server FPS.
- Watch FPS before adding enemies because dev smoke is still below the 60 target.
- Future asset streaming should account for cache-busted URLs when comparing network/cache behavior between builds.
- Future performance profiling should measure close-wall movement with weapon avoidance active.
