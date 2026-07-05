# Observations: asset-playground-qa-agent

Status: needs review after browser smoke.

## What It Saw

- A dedicated asset playground still does not exist.
- The first three weapon assets are loaded in the live test level through `WeaponSystem`.
- Browser smoke should verify all three GLB models load, switch, and fire without asset errors.

## Decisions

- Accept live-level smoke as a temporary substitute for this first tiny CC0 weapon slice.
- Still require a proper playground before importing larger enemy, building, or animated weapon sets.

## Caught Issues

- This slice reverses the ideal order by integrating before a standalone playground exists.

## Next Handoff Notes

- Smoke QA should inspect `window.__SIGILBREAKER_DEBUG__` for loaded weapon asset IDs and errors.
- Main-character headed QA passed visually through `npm run qa:headed:player-character` and captured rigged, idle, gun-hold, dance, and out-of-HP screenshots under `artifacts/sub-agents/20260705-main-character-concepts/asset-playground-qa-agent/`.
- The Meshy mascot is not approved for gameplay integration yet because the source GLBs exceed byte/triangle targets and the gun-hold clip is not a clean blaster pose.

## 2026-07-05 Player Pose Harness Pass

### What It Saw

- The rigged Meshy character exposes the spine, shoulder, arm, forearm, hand, neck, and head bones needed for a manual gun-hold still pose pass.
- The game shell can host a dedicated debug page from the title screen while keeping gameplay controls disabled.
- GitHub Pages cannot write pose JSON into the repo, so the browser page must export by copy/download while a local harness script handles repo writes.

### Decisions

- Add a title-accessible `character-debug` phase with an isolated Three.js pose scene.
- Export rotations in degrees and radians relative to the imported bind pose.
- Keep `npm run pose:harness:player` as the local workflow when the pose should be written directly under `public/assets/characters/meshy-gadget-gremlin/poses/`.

### Caught Issues

- The harness is suitable for still pose authoring only; animation clip generation/retargeting remains future work.
- The model still needs GLB optimization before gameplay use.

### Next Handoff Notes

- Weapon and camera agents should use the exported hand world positions to create a stable weapon socket.
- The latest run artifacts live under `artifacts/sub-agents/20260705-player-pose-harness/asset-playground-qa-agent/`.

## 2026-07-05 Character Debug Animation Fix

### What It Saw

- The current Meshy character does not match the selected concept closely enough and was not generated from a single clean A-pose reference.
- Meshy animation outputs are currently staged as separate GLBs, which duplicates the character payload for each animation file.
- The title character debug page showed only a cramped scroll panel, so the arm sliders were effectively hidden on mobile landscape.

### Decisions

- Treat the current character as a rejected placeholder for gameplay/title integration.
- Require the next Meshy pass to use the winning concept to generate one front-facing A-pose image before Image-to-3D, rigging, and animation.
- Keep the debug page able to preview the current separate animation GLBs, but mark a single optimized multi-clip GLB as the runtime target.
- Change mobile pose editing to a selected-bone workflow with a bone dropdown and three large visible sliders.

### Caught Issues

- The previous handoff overstated visual acceptance; the character reads as a useful rig/debug placeholder only.
- Separate full animation GLBs are acceptable for QA preview but not for final runtime loading.

### Next Handoff Notes

- Future Meshy generation must produce and approve `selected-concept-a-pose.png` before requesting a new model.
- GLTF optimization should merge or repack approved clips into one player character asset, or produce a lightweight clip-only bundle if the skeleton names match.
