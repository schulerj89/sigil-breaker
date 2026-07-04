# Observations: mobile-fps-game-feel-agent

Status: in progress after movement, wall-shot, and weapon-clearance tuning.

## What It Saw

- Added a first one-button shooting loop for the mobile landscape test level.
- Added three touch-selectable weapons with distinct cadence, magazine size, recoil kick, and procedural firing sound.
- The existing right-side look zone remains the primary aim surface; weapon buttons and fire button opt out of camera drag handling.
- Movement speed increased 25% from 3.25 to 4.0625 units per second.
- Shots now raycast against level walls and expose the last wall hit through debug state.
- Player movement collision now includes a right-handed weapon footprint derived from the weapon manifest.
- The weapon viewmodel retracts/lowers when close to walls so turning in place near a wall does not rely only on movement collision.
- The active gun was shifted farther right of the weapon tray and the tracer origin follows that offset.

## Decisions

- Keep recoil small until hit reactions and enemy readability exist.
- Use a single large right-side fire button for this slice.
- Treat the procedural Web Audio sounds as placeholders until ElevenLabs sound effects/music are added.
- Keep wall collision feedback lightweight: short tracer and wall impact only.
- Use movement collision plus viewmodel avoidance as a two-layer wall clipping fix.

## Caught Issues

- The shoot loop now has wall hit detection, but still has no enemy hit detection, reload button, damage model, or enemy feedback.
- Weapon wall avoidance is approximate and should be visually tested near side walls, dead-end walls, and the new three-tile doorways.

## Next Handoff Notes

- Playthrough QA should re-check the faster traversal speed, wall approach, turning near walls, and doorway traversal against the 45 x 45 layout.
