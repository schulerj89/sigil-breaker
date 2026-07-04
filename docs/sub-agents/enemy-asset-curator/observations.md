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
- The foundation map now uses `E` as enemy spawn markers and `X` as the endpoint marker.
- The enemy runtime now derives 12 enemy placements from map markers, cycles the three current monster GLBs, and clones shared loaded templates instead of fetching each repeated visual separately.
- Enemy motion is kinematic and transform-only: mushroom hop-square, slime side-sway, and golem heavy-square patrols with detect/lose tracking radii and return-home behavior.
- Debug mode now draws each living enemy's detection radius and front cone in the scene; tracking enemies show red debug lines and non-tracking enemies show green lines.

## Decisions

- Enemy asset review must include animation and collision proxy needs.
- Recurring enemies should be visually consistent across levels.
- Primitive cubes are placeholders only; future external enemy assets should preserve authored hit proxies that match readable silhouettes.
- Keep separate collision/hit proxies rather than raycasting the render mesh.
- Keep enemy behavior data in the runtime for now and keep asset metadata in `enemyManifest.ts`.
- Keep map-authored enemy markers as the source of truth for exact spawn coordinates.

## Caught Issues

- No external first-level enemy brief exists yet.
- The current cube enemies do not block player movement or play hit/death animation; they only validate health and damage plumbing.
- The new monsters are static right now; animation clips are not wired and movement is intentionally deferred.
- Goleling is larger/heavier than the other two and should get visual QA in the hallway before AI movement is added.
- These are still procedural transform animations, not authored GLB animation clips; attack, hit, and death animation assets remain open.

## Next Handoff Notes

- Use the current enemy system as the behavior contract: GLB visuals, health, ray hits, destruction, cache-busted loading, and debug snapshot reporting must remain intact.
- Future enemy assets should provide authored idle/move/attack/hit/death clips, but they must keep the current separate hit-proxy contract and map-marker spawn contract.
