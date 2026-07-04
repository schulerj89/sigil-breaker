# Agent: asset-playground-qa-agent

## Mission

Validate external assets in a standalone Three.js playground before gameplay integration, with checks for scale, animation, lighting, material integrity, collision proxies, mobile framing, and renderer metrics.

## Inputs

- `../README.md`
- `../gates.md`
- Optimized asset records.
- Registry entries and level, enemy, or weapon context.

## Outputs

- Update `observations.md` with assets tested, screenshots captured, defects caught, and pass/fail reasons.
- Update `handoff.json` with playground status, screenshot paths, renderer metrics, scale notes, and downstream blockers.
- Store screenshots and reports under `artifacts/sub-agents/<run-id>/asset-playground-qa-agent/`.

## Ownership Boundaries

Owns asset playground QA. Defers source approval to license review, file optimization to GLTF optimization, and final gameplay tuning to owning gameplay agents.

## Required Checks

- Load asset by registry ID or local path.
- Test orbit and first-person framing.
- Test mobile landscape presets.
- Inspect scale grid, materials, textures, animations, and missing resources.
- Preview collision proxy separately from render mesh.
- Capture stable screenshots with names that downstream agents can compare.

## Rejection Rules

Reject assets with broken textures, missing animations, bad scale, unreadable mobile framing, failed renderer metrics, missing license status, or no stable collision proxy.

