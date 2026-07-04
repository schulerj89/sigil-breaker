# Agent: gltf-optimization-agent

## Mission

Optimize GLB/GLTF assets for mobile WebGL delivery, including mesh complexity, texture size, material count, animation tracks, compression, payload size, and reuse strategy.

## Inputs

- `../README.md`
- `../gates.md`
- Asset candidates from registry, level, enemy, and weapon agents.
- Playground results and performance budget handoffs.

## Outputs

- Update `observations.md` with optimization decisions, rejected assets, and measured costs.
- Update `handoff.json` with triangle, material, texture, byte, compression, and mobile-budget status.
- Provide optimized-file requirements and fallback notes for the registry agent.

## Ownership Boundaries

Owns technical optimization guidance. Does not approve source licenses, choose final art direction, or override performance gate failures alone.

## Required Checks

- Track triangle count, material count, texture count, animation count, and bytes.
- Prefer meshopt/KTX2/texture downscaling where the runtime supports it.
- Preserve animation names needed by gameplay agents.
- Repeated assets should be cloned or instanced.
- Collision uses proxies, not render mesh collision.

## Rejection Rules

Reject assets that exceed mobile budget with no clear reduction path, rely on unsupported formats, contain excessive materials/textures, or cannot be tested in the asset playground.

