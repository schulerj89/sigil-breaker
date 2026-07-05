# Observations: enemy-asset-curator

Status: needs visual review after first external enemy asset replacement.

## What It Saw

- Initial scaffold pass only.
- The first FPS enemy roster briefly used primitive cube placeholders in the foundation level.
- Each external enemy uses the shared `Health` gameplay class and can be damaged by the weapon ray path.
- The first GLB smoke target is placed down the spawn lane so local smoke can destroy it through normal hold-fire input.
- Replaced visible cube enemies with Quaternius CC0 monster GLBs: Mushnub, Pink Slime, and Goleling.
- Runtime keeps invisible box hit proxies for raycast damage; the GLBs are visual-only for this no-movement slice.
- Enemy asset IDs, byte sizes, hashes, source pages, and CC0 license records are in `src/game/enemies/enemyManifest.ts` and `docs/assets/source-ledger.json`.
- Enemy assets need both unique level identity and recurring readability.
- The foundation map now uses `E` as enemy spawn markers and `X` as the endpoint marker.
- The enemy runtime now derives 12 enemy placements from map markers, cycles the three current monster GLBs, and clones shared loaded templates instead of fetching each repeated visual separately.
- Enemy motion is kinematic and transform-only: mushroom hop-square, slime side-sway, and golem heavy-square patrols with detect/lose tracking radii and return-home behavior.
- Debug mode now draws each living enemy's detection radius and front cone in the scene; tracking enemies show red debug lines and non-tracking enemies show green lines.
- The first smoke target moved from the immediate spawn lane to marker row 1, column 12 so it patrols at range instead of instantly clustering beside the player.
- Weapon rays now hit a larger invisible enemy silhouette proxy, and successful hits briefly show an additive flash before destruction.
- Runtime enemy separation now pushes living enemies apart so multiple trackers do not stack on the same player-adjacent spot.
- Quaternius enemy GLBs are skinned meshes; repeated runtime instances now use `SkeletonUtils.clone` so the visible body renders with the moving enemy.
- The hit flash now lives under the same animated visual slot as the GLB, so it follows model bob/scale instead of only the root transform.
- Enemy debug snapshots now include attachment anchors and model bounds, which makes visual/proxy/debug/flash detachment testable.
- Repeatable headed enemy QA now confirms the skinned bodies are visibly present, moving, and attached to their hit/debug proxies.

## Decisions

- Enemy asset review must include animation and collision proxy needs.
- Recurring enemies should be visually consistent across levels.
- Primitive cubes are placeholders only; future external enemy assets should preserve authored hit proxies that match readable silhouettes.
- Keep separate collision/hit proxies rather than raycasting the render mesh.
- Keep enemy behavior data in the runtime for now and keep asset metadata in `enemyManifest.ts`.
- Keep map-authored enemy markers as the source of truth for exact spawn coordinates.
- Keep enemy-to-enemy overlap handling as a lightweight runtime separation pass until authored navigation or avoidance is needed.
- Keep `SkeletonUtils.clone` for skinned enemy GLB reuse; do not return to raw `Object3D.clone(true)` for these assets.

## Caught Issues

- No external first-level enemy brief exists yet.
- The current external enemies do not block player movement or play authored hit/death animation; they validate health and damage plumbing.
- The new monsters are static right now; animation clips are not wired and movement is intentionally deferred.
- Goleling is larger/heavier than the other two and should get visual QA in the hallway before AI movement is added.
- These are still procedural transform animations, not authored GLB animation clips; attack, hit, and death animation assets remain open.
- The earlier first marker was too close to spawn, so the enemy read as stuck/stacked instead of patrolling.
- The first hit proxy was too narrow for the external silhouettes, making player-visible shots feel like misses.
- Raw `Object3D.clone(true)` produced valid-looking bounds while the skinned enemy body did not render reliably in headed QA.
- Single-frame movement assertions can false-fail on looping patrols; use the headed QA runner's sampled movement window.

## Next Handoff Notes

- Use the current enemy system as the behavior contract: GLB visuals, health, ray hits, destruction, cache-busted loading, and debug snapshot reporting must remain intact.
- Future enemy assets should provide authored idle/move/attack/hit/death clips, but they must keep the current separate hit-proxy contract and map-marker spawn contract.
- Future enemy replacements should be checked against the current 2.15 x 2.35 unit hit proxy before shrinking combat collision.
- Future enemy assets should record whether they are skinned; skinned models need the skeleton-safe clone path and a headed visual capture.
