# Performance Budget Agent Observations

Status: complete for title character budget review.

## What It Saw

- The combined Meshy player GLB is 10,983,096 bytes with 81,375 observed triangles and ten embedded clips.
- The first-person viewmodel already needs the same character GLB for the masked arm.
- A naive title implementation could load or parse the character twice and could accidentally create a second WebGL context.

## Decision

- Use one renderer/canvas and a separate Three.js title scene rendered through the existing WebGL context.
- Centralize the player GLB path and load promise in `src/game/playerCharacterAsset.ts`.
- Clone the shared loaded scene for title, pose debug, and first-person arm use.
- Do not dispose the original shared GLB geometry while building the masked arm viewmodel.

## Caught Issues

- The title character is acceptable as one MVP title instance, not as a many-instance character budget.
- The title loop adds audio payload but stays below the foundation audio gate.
- The build chunk is larger after adding the live title stage; this remains an existing Three.js bundle warning, not a functional failure.

## Handoff

- Watch renderer calls, triangles, geometries, and texture counts in browser smoke.
- Keep `snapshot.ui.titleHero` fields available for QA.
- Avoid adding another full-character load path for cutscenes; reuse the shared character asset module.
