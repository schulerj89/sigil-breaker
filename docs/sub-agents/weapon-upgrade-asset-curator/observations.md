# Observations: weapon-upgrade-asset-curator

Status: in progress after weapon orientation, collision, and cache-busting pass.

## What It Saw

- Integrated three first-person test weapons from Kenney Blaster Kit 2.1.
- Current roles are fast sidearm, close scatter, and heavy pulse.
- Each weapon has a preview thumbnail, distinct magazine size, cadence, recoil value, and procedural gunshot profile.
- Reversed all three viewmodels back to yaw `0` after the user requested the guns face the other way.
- Added per-weapon range metadata and wall hit detection through the level map.
- Public weapon asset paths now flow through the asset registry cache-busting helper.

## Decisions

- Use these three weapons for the initial selector and shoot-loop smoke tests.
- Delay upgrade visuals until powerups and weapon progression are implemented.
- Treat current yaw `0` model offsets as prototype framing values pending camera/game-feel review.
- Use temporary primitive tracer and impact feedback until external projectile/hit assets are sourced.

## Caught Issues

- The models are not authored specifically as hands/viewmodels, so first-person orientation and framing may need iteration.
- Wall collision is level-tile based, not a final projectile or enemy hit system.

## Next Handoff Notes

- Camera and game-feel agents should review yaw `0` model placement, muzzle flash placement, and tracer readability in landscape phone view.
