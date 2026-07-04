# Observations: mobile-fps-game-feel-agent

Status: complete after body-only movement collision, wall-shot, entry-width, splitter, and weapon-effect tuning.

## What It Saw

- Added a first one-button shooting loop for the mobile landscape test level.
- Added three touch-selectable weapons with distinct cadence, magazine size, recoil kick, and procedural firing sound.
- The existing right-side look zone remains the primary aim surface; weapon buttons and fire button opt out of camera drag handling.
- Movement speed increased 25% from 3.25 to 4.0625 units per second.
- Shots now raycast against level walls and expose the last wall hit through debug state.
- Player movement now uses a body-only circular collider resolved out of nearby wall tiles by `resolveLevelCollision`.
- The weapon viewmodel still retracts/lowers when close to walls, but weapon-only wall overlap no longer blocks player translation.
- The active gun was shifted farther right of the weapon tray and the tracer origin follows that offset.
- Structural wall-band entries now require 5 open tiles, which gives the player body and weapon presentation more room than the 3-unit lane minimum.
- Structural entries also reject continuing wall posts that split the entry into branches below 3 units per side or 6 units combined.
- The bottom wall-band entries near the reported `x -10` and `x 8.2` coordinates were widened to leave 3-unit branches around the adjacent divider posts.
- Shot feedback now derives from the shared weapon view pose so tracer start follows the active gun offset, recoil, and wall retraction.

## Decisions

- Keep recoil small until hit reactions and enemy readability exist.
- Use a single large right-side fire button for this slice.
- Treat the procedural Web Audio sounds as placeholders until ElevenLabs sound effects/music are added.
- Keep wall collision feedback lightweight: short tracer and wall impact only.
- Use body collision plus visual viewmodel avoidance as the wall clipping fix.
- Keep door-like structural entries wider than ordinary lanes so right-shifted weapon presentation stays readable.
- Keep wall posts out of the center of structural entries unless both resulting branches satisfy the splitter clearance rule.

## Caught Issues

- The shoot loop now has wall hit detection, but still has no enemy hit detection, reload button, damage model, or enemy feedback.
- Weapon wall avoidance is approximate and should be visually tested near side walls, dead-end walls, and the widened five-tile entries.
- Weapon-only overlap used to hard-block movement and could trap the player after turning near an entry; future changes must keep weapon collision recoverable.
- A 5-tile entry can still feel like two 2-tile branches when a continuing divider post sits just inside the opening.

## Next Handoff Notes

- Playthrough QA should re-check the faster traversal speed, wall approach, turning near walls, widened 5-tile structural entries, and splitter-post branches against the 45 x 45 layout.
- Do not reintroduce the weapon footprint as a hard movement collider unless escape movement and yaw recovery are explicitly handled.
