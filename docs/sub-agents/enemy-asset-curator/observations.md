# Observations: enemy-asset-curator

Status: needs visual review after first external enemy asset replacement.

## What It Saw

- Initial scaffold pass only.
- The first FPS enemy roster now has three primitive cube placeholders in the foundation level.
- Each cube uses the shared `Health` gameplay class and can be damaged by the weapon ray path.
- The first cube is placed down the spawn lane so local smoke can destroy it through normal hold-fire input.
- Replaced visible cube enemies with Quaternius CC0 monster GLBs: Mushnub, Pink Slime, and Goleling.
- Runtime keeps invisible box hit proxies for raycast damage; the GLBs are visual-only for this no-movement slice.
- Enemy asset IDs, byte sizes, hashes, source pages, and CC0 license records are in `src/game/enemies/enemyManifest.ts` and `docs/assets/source-ledger.json`.
- Enemy assets need both unique level identity and recurring readability.

## Decisions

- Enemy asset review must include animation and collision proxy needs.
- Recurring enemies should be visually consistent across levels.
- Primitive cubes are placeholders only; future external enemy assets should preserve authored hit proxies that match readable silhouettes.
- Keep separate collision/hit proxies rather than raycasting the render mesh.

## Caught Issues

- No external first-level enemy brief exists yet.
- The current cube enemies do not block player movement or play hit/death animation; they only validate health and damage plumbing.
- The new monsters are static right now; animation clips are not wired and movement is intentionally deferred.
- Goleling is larger/heavier than the other two and should get visual QA in the hallway before AI movement is added.

## Next Handoff Notes

- Use the current enemy system as the behavior contract: GLB visuals, health, ray hits, destruction, cache-busted loading, and debug snapshot reporting must remain intact.
