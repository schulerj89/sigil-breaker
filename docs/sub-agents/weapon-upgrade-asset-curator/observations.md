# Observations: weapon-upgrade-asset-curator

Status: in progress after first weapon orientation and collision pass.

## What It Saw

- Integrated three first-person test weapons from Kenney Blaster Kit 2.1.
- Current roles are fast sidearm, close scatter, and heavy pulse.
- Each weapon has a preview thumbnail, distinct magazine size, cadence, recoil value, and procedural gunshot profile.
- Rotated all three viewmodels to face forward down camera `-Z` instead of presenting sideways.
- Added per-weapon range metadata and wall hit detection through the level map.

## Decisions

- Use these three weapons for the initial selector and shoot-loop smoke tests.
- Delay upgrade visuals until powerups and weapon progression are implemented.
- Treat current model offsets as prototype framing values pending camera/game-feel review.
- Use temporary primitive tracer and impact feedback until external projectile/hit assets are sourced.

## Caught Issues

- The models are not authored specifically as hands/viewmodels, so first-person framing may need iteration.
- Wall collision is level-tile based, not a final projectile or enemy hit system.

## Next Handoff Notes

- Camera and game-feel agents should review forward-facing model placement, muzzle flash placement, and tracer readability in landscape phone view.
