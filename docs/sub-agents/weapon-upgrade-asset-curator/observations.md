# Observations: weapon-upgrade-asset-curator

Status: in progress after weapon placement, collision, cache-busting, and shot-effect alignment pass.

## What It Saw

- Integrated three first-person test weapons from Kenney Blaster Kit 2.1.
- Current roles are fast sidearm, close scatter, and heavy pulse.
- Each weapon has a preview thumbnail, distinct magazine size, cadence, recoil value, and procedural gunshot profile.
- Reversed all three viewmodels back to yaw `0` after the user requested the guns face the other way.
- Added per-weapon range metadata and wall hit detection through the level map.
- Public weapon asset paths now flow through the asset registry cache-busting helper.
- Shifted all three first-person view offsets farther right so the active gun sits less over the bottom-center weapon choices.
- Added manifest-derived weapon clearance for viewmodel wall avoidance and debug weapon-footprint checks.
- Shifted tracer origin to follow the right-offset weapon presentation.
- Added `weaponViewPose.ts` so muzzle flash, tracer start, tracer endpoint, and wall impact positions are derived from one camera-local weapon pose helper.
- The pose helper includes view offset, scale, view rotation, recoil, and wall-avoidance retraction/lowering.
- `WeaponSystemSnapshot.effectPose` now exposes rounded shot-effect positions for browser QA and future sub-agent checks.

## Decisions

- Use these three weapons for the initial selector and shoot-loop smoke tests.
- Delay upgrade visuals until powerups and weapon progression are implemented.
- Treat current yaw `0` and right-shifted model offsets as prototype framing values pending camera/game-feel review.
- Use temporary primitive tracer and impact feedback until external projectile/hit assets are sourced.
- Derive viewmodel wall clearance from the current weapon manifest so later offset changes do not desync wall retraction.
- Derive shot feedback from `getWeaponShotEffectPositions` so later viewmodel movement cannot desync muzzle flash and tracer placement.

## Caught Issues

- The models are not authored specifically as hands/viewmodels, so first-person orientation and framing may need iteration.
- Wall collision is level-tile based, not a final projectile or enemy hit system.
- Wall avoidance is a retraction/probe layer, not full mesh-vs-level collision for every weapon triangle.
- The current tracer and wall impact are still procedural primitives; they should be replaced with external assets once the weapon VFX source is chosen.

## Next Handoff Notes

- Camera and game-feel agents should review yaw `0`, right-offset model placement, wall retraction, muzzle flash placement, and tracer readability in landscape phone view.
