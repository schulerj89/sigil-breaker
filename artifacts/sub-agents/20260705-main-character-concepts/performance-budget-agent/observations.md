# Performance Budget Agent - Main Character

Status: needs-review-before-gameplay

## What It Saw

- Rigged Meshy model file is 10229184B.
- Largest tested animation GLB is 10371892B.
- Standalone headed QA reported 81627 triangles, 2 draw calls, 2 geometries, and up to 7 textures while cycling tested clips.
- The full staged Meshy source pack is over 110 MB because every animation GLB carries a full copy of the character mesh.

## Decisions

- Do not add the Meshy character to initial gameplay loading, title boot loading, or foundation browser smoke expected asset counts yet.
- Require optimization, animation merge/retargeting, or a lower-poly regeneration before gameplay integration.
- Keep the current asset as source/provenance and visual direction.

## Caught Issues

- The visual pass is not a runtime approval; the model exceeds the current 6 MB per reusable character target and 45k triangle target.
- The gun-hold animation is not a clean two-hand blaster-ready pose and needs replacement or retargeting.
