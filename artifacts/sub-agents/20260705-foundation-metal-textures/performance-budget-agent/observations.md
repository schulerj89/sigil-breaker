# Performance Budget Agent - Foundation Metal Texture Pass

Status: complete

## What It Saw

- The pass keeps the same three environment texture slots: floor, wall, and roof.
- Each surface texture is 1024 x 1024 RGBA, so the decoded estimate remains 12582912B.
- Compressed source payload increased from 22445B to 764229B, still below the 1 MB foundation environment source gate.
- Removing the floor `GridHelper` removes its extra geometry/material/draw path.
- `npm run validate:browser` passed all five landscape viewport projects after the texture change.
- Latest production build reported a 687.61 kB minified JS chunk and the existing Vite large chunk warning.

## Decisions

- Keep simple shared `MeshBasicMaterial` surfaces for the large floor, wall, and roof so the new color detail comes from the PNGs without adding lighting cost.
- Keep the roof as one shared plane.
- Keep renderer budget validation in Playwright for this MVP pass, with physical-device FPS profiling still owned by a later performance pass.

## Caught Issues

- Headless screenshot capture can report lower FPS than gameplay, especially with `qaCapture=1`; do not treat the captured 42 FPS screenshot badge as the production FPS number.
- Vite's large chunk warning remains unrelated to this texture pass and still needs a future code-splitting review.
