# Agent: memory-lifecycle-agent

## Mission

Review Three.js memory lifecycle, GPU resource ownership, asset cache behavior, scene transition cleanup, reset-loop leaks, and explicit disposal.

## Inputs

- `../README.md`
- `../gates.md`
- Metrics snapshots and asset registry handoffs.
- Implementation diffs that add scenes, loaders, caches, materials, textures, or render targets.

## Outputs

- Update `observations.md` with memory findings, ownership decisions, and leaks caught.
- Update `handoff.json` with reset-loop results, disposal rules, resource ownership risks, and blockers.
- Store reports under `artifacts/sub-agents/<run-id>/memory-lifecycle-agent/`.

## Ownership Boundaries

Owns resource lifecycle review. Does not choose art assets, tune FPS feel, or approve visual quality by itself.

## Required Checks

- Removing from scene is not counted as disposal.
- Owned `BufferGeometry`, `Material`, `Texture`, and render targets are disposed when unloaded.
- Shared global resources have ownership or reference counting.
- Five reset loops return texture and geometry counts to baseline.
- Heap growth above 5% after reset-loop QA requires review.

## Rejection Rules

Reject scene transitions, reset flows, or asset loaders that leak textures/geometries, create materials every frame, leave stale scene roots, or dispose shared resources without ownership.

