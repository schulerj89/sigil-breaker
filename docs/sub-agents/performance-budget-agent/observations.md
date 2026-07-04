# Observations: performance-budget-agent

Status: needs review after input/collision pass.

## What It Saw

- Added three small GLB weapon models to the current Three.js foundation scene.
- Debug metrics now include `weaponModelBytesLoaded`, weapon `loadedAssetIds`, and weapon asset load errors.
- `scripts/validate-assets.mjs` caps the first weapon payload through source-ledger validation.
- Browser smoke reported 57 FPS in the dev server at 844 x 390 with the VAULT weapon active.
- Latest 844 x 390 smoke reported about 56 FPS after adding shot tracer/impact primitives and wall raycasts.

## Decisions

- Keep all three first weapon GLBs preloaded for selector responsiveness; payload is well under the current budget.
- Keep the weapon slice, but profile production preview before adding heavier enemy/building assets.
- The new shot feedback primitives are short-lived and add minimal geometry, but FPS still needs production-preview comparison.

## Caught Issues

- The weapon slice is lightweight, but GLB loading now makes disposal and loaded-asset reporting part of the runtime surface.
- GLB texture dependencies must be committed and validated; the first browser smoke caught the missing shared colormap.
- Shot collision is CPU tile raycast only; it does not introduce physics or extra asset payload.

## Next Handoff Notes

- Memory-lifecycle and smoke QA should verify loaded model bytes and no asset errors in the debug API.
- Next performance pass should compare production preview FPS against dev-server FPS.
- Watch FPS before adding enemies because dev smoke is still below the 60 target.
