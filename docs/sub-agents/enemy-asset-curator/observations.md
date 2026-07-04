# Observations: enemy-asset-curator

Status: not run for implementation yet.

## What It Saw

- Initial scaffold pass only.
- The first FPS enemy roster now has three primitive cube placeholders in the foundation level.
- Each cube uses the shared `Health` gameplay class and can be damaged by the weapon ray path.
- The first cube is placed down the spawn lane so local smoke can destroy it through normal hold-fire input.
- Enemy assets need both unique level identity and recurring readability.

## Decisions

- Enemy asset review must include animation and collision proxy needs.
- Recurring enemies should be visually consistent across levels.
- Primitive cubes are placeholders only; future external enemy assets should preserve authored hit proxies that match readable silhouettes.

## Caught Issues

- No external first-level enemy brief exists yet.
- The current cube enemies do not block player movement or play hit/death animation; they only validate health and damage plumbing.

## Next Handoff Notes

- Use the cube system as the behavior contract for the first external enemy pass: health, ray hits, destruction, and debug snapshot reporting must remain intact.
