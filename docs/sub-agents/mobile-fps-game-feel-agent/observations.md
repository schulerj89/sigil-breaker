# Observations: mobile-fps-game-feel-agent

Status: in progress after movement, wall-shot, entry-width, and weapon-effect tuning.

## What It Saw

- Added a first one-button shooting loop for the mobile landscape test level.
- Added three touch-selectable weapons with distinct cadence, magazine size, recoil kick, and procedural firing sound.
- The existing right-side look zone remains the primary aim surface; weapon buttons and fire button opt out of camera drag handling.
- Movement speed increased 25% from 3.25 to 4.0625 units per second.
- Shots now raycast against level walls and expose the last wall hit through debug state.
- Player movement collision now includes a right-handed weapon footprint derived from the weapon manifest.
- The weapon viewmodel retracts/lowers when close to walls so turning in place near a wall does not rely only on movement collision.
- The active gun was shifted farther right of the weapon tray and the tracer origin follows that offset.
- Structural wall-band entries now require 5 open tiles, which gives the player plus right-handed weapon footprint more room than the 3-unit lane minimum.
- Shot feedback now derives from the shared weapon view pose so tracer start follows the active gun offset, recoil, and wall retraction.

## Decisions

- Keep recoil small until hit reactions and enemy readability exist.
- Use a single large right-side fire button for this slice.
- Treat the procedural Web Audio sounds as placeholders until ElevenLabs sound effects/music are added.
- Keep wall collision feedback lightweight: short tracer and wall impact only.
- Use movement collision plus viewmodel avoidance as a two-layer wall clipping fix.
- Keep door-like structural entries wider than ordinary lanes while the weapon footprint is active.

## Caught Issues

- The shoot loop now has wall hit detection, but still has no enemy hit detection, reload button, damage model, or enemy feedback.
- Weapon wall avoidance is approximate and should be visually tested near side walls, dead-end walls, and the widened five-tile entries.
- Door-like entries below 5 tiles can feel like 2 usable units once the weapon footprint is included.

## Next Handoff Notes

- Playthrough QA should re-check the faster traversal speed, wall approach, turning near walls, and the widened 5-tile structural entries against the 45 x 45 layout.
