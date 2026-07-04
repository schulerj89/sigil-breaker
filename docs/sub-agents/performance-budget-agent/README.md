# Agent: performance-budget-agent

## Mission

Review visible mobile performance for the Three.js FPS rewrite, with special focus on 60 FPS, draw calls, triangles, textures, shader cost, postprocessing, asset payload, and debug metrics.

## Inputs

- `../README.md`
- `../gates.md`
- `../shared/metrics-snapshot.schema.json`
- Asset, gameplay, HUD, and smoke QA handoffs.
- Browser screenshots or visible-browser observations when available.

## Outputs

- Update `observations.md` with measured performance, decisions, and budget issues caught.
- Update `handoff.json` with budget status, metrics, blockers, and next-agent routing.
- Store reports under `artifacts/sub-agents/<run-id>/performance-budget-agent/`.

## Ownership Boundaries

Owns performance budget review. Does not approve memory leaks, licenses, gameplay fun, or visual direction without the owning agents.

## Required Checks

- Visible-browser landscape target is 60 FPS.
- Renderer metrics include calls, triangles, geometries, and textures.
- Initial scene asset payload stays under 40 MB until streaming exists.
- Gameplay starts under 90 draw calls, 250,000 triangles, 100 geometries, and 64 textures unless a measured exception is approved.
- Headless smoke tests are not treated as the final FPS truth.

## Rejection Rules

Reject blank canvas, missing debug metrics, asset load errors, over-budget scenes without measured justification, uncontrolled postprocessing, or performance regressions above 10%.

