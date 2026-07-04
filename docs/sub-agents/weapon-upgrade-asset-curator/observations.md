# Observations: weapon-upgrade-asset-curator

Status: complete for first weapon intake.

## What It Saw

- Integrated three first-person test weapons from Kenney Blaster Kit 2.1.
- Current roles are fast sidearm, close scatter, and heavy pulse.
- Each weapon has a preview thumbnail, distinct magazine size, cadence, recoil value, and procedural gunshot profile.

## Decisions

- Use these three weapons for the initial selector and shoot-loop smoke tests.
- Delay upgrade visuals until powerups and weapon progression are implemented.
- Treat current model offsets as prototype framing values pending camera/game-feel review.

## Caught Issues

- The models are not authored specifically as hands/viewmodels, so first-person framing may need iteration.

## Next Handoff Notes

- Camera and game-feel agents should review recoil readability, muzzle flash placement, and button placement in landscape phone view.
