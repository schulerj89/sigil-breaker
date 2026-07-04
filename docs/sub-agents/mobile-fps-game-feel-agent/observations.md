# Observations: mobile-fps-game-feel-agent

Status: complete after body-only movement collision, wall-shot, entry-width, splitter, weapon-effect tuning, touch zoom-guard, hold-fire aim, speed, and steel foundation pass.

## What It Saw

- Added a first one-button shooting loop for the mobile landscape test level.
- Added three touch-selectable weapons with distinct cadence, magazine size, recoil kick, and procedural firing sound.
- The existing right-side look zone remains the primary aim surface; weapon buttons and fire button opt out of camera drag handling.
- Movement speed increased another 25% from 4.0625 to 5.078125 units per second.
- Shots now raycast against level walls and expose the last wall hit through debug state.
- Player movement now uses a body-only circular collider resolved out of nearby wall tiles by `resolveLevelCollision`.
- The weapon viewmodel still retracts/lowers when close to walls, but weapon-only wall overlap no longer blocks player translation.
- The active gun was shifted farther right of the weapon tray and the tracer origin follows that offset.
- Structural wall-band entries now require 5 open tiles, which gives the player body and weapon presentation more room than the 3-unit lane minimum.
- Structural entries also reject continuing wall posts that split the entry into branches below 3 units per side or 6 units combined.
- The bottom wall-band entries near the reported `x -10` and `x 8.2` coordinates were widened to leave 3-unit branches around the adjacent divider posts.
- Shot feedback now derives from the shared weapon view pose so tracer start follows the active gun offset, recoil, and wall retraction.
- Accidental double-tap, pinch, WebKit gesture, and ctrl-wheel zoom paths are guarded without moving the work into the frame loop.
- Move/look pointer ownership now ignores later non-UI touches in already-owned zones, preserving stable simultaneous input.
- Foundation walls now render at 3.84 units tall with the roof raised to 3.92 units so the first-person space reads more enclosed on mobile.
- First-person gun view scales were increased again by about 22%, and each weapon now has a right-handed hip pose plus a scope-like centered hold-fire aim pose.
- Holding the fire button immediately fires, continues firing by weapon cadence, zooms the camera from 70 to 62 degrees, and blends the gun toward a centered aim pose.
- The fire button can also drive right-thumb look at reduced sensitivity while held, with a small dead zone to prevent accidental camera jumps.
- The fire button is now a reticle icon; the smaller gun-icon cycle button was removed, and weapon switching remains in the bottom tray.
- The foundation level now uses steel-toned Kenney CC0 prototype textures for floor, walls, and roof, with a full-level roof plane above the wall height.
- Debug state now exposes `weapon.isFireHeld`, `weapon.aimBlend`, and `weapon.cameraFovDegrees` for QA and tuning.

## Decisions

- Keep recoil small until hit reactions and enemy readability exist.
- Use a single large right-side fire button for this slice.
- Treat the procedural Web Audio sounds as placeholders until ElevenLabs sound effects/music are added.
- Keep wall collision feedback lightweight: short tracer and wall impact only.
- Use body collision plus visual viewmodel avoidance as the wall clipping fix.
- Keep door-like structural entries wider than ordinary lanes so right-shifted weapon presentation stays readable.
- Keep wall posts out of the center of structural entries unless both resulting branches satisfy the splitter clearance rule.
- Treat the fire button as the current mobile ADS-plus-trigger hold for MVP, not a single-tap fire action.
- Keep fire-button drag aiming slower than the main right-side look zone for controllability.
- Keep per-weapon aim poses in the manifest because the three starter guns have different silhouettes.

## Caught Issues

- The shoot loop now has wall hit detection, but still has no enemy hit detection, reload button, damage model, or enemy feedback.
- Weapon wall avoidance is approximate and should be visually tested near side walls, dead-end walls, and the widened five-tile entries.
- Weapon-only overlap used to hard-block movement and could trap the player after turning near an entry; future changes must keep weapon collision recoverable.
- A 5-tile entry can still feel like two 2-tile branches when a continuing divider post sits just inside the opening.
- Tap-only fire did not give enough FPS feel; the hold action needed aim zoom, continuous cadence, and centered weapon framing.

## Next Handoff Notes

- Playthrough QA should re-check the faster 5.078125 units-per-second traversal speed, wall approach, turning near walls, widened 5-tile structural entries, and splitter-post branches against the 45 x 45 layout.
- Do not reintroduce the weapon footprint as a hard movement collider unless escape movement and yaw recovery are explicitly handled.
- Do not let future gesture recognizers replace active move/look pointer IDs; multi-touch combat depends on stable pointer ownership.
- Playthrough QA should re-check hold-fire while turning and moving because fire now owns aim, cadence, FOV, and pose state.
