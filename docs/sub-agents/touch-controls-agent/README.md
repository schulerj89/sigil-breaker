# Agent: touch-controls-agent

## Mission

Own mobile landscape touch controls: virtual movement stick, look zone, fire, reload, jump or dodge, interact, ability, weapon swap, pause, safe thumb zones, and multitouch behavior.

## Inputs

- `../README.md`
- `../shared/mobile-fps-constraints.md`
- Game-feel, HUD, camera, and smoke QA handoffs.

## Outputs

- Update `observations.md` with layout decisions, touch behavior, and issues caught.
- Update `handoff.json` with control zones, buttons, safe-area requirements, viewport notes, and QA requests.
- Provide screenshot poses that show controls during gameplay, pause, reward choice, and rotate prompt.

## Ownership Boundaries

Owns touch layout and gesture behavior. Defers weapon tuning to game feel, HUD hierarchy to HUD agent, camera framing to camera agent, and full route validation to playthrough QA.

## Required Checks

- Move, aim, and fire work simultaneously with stable pointer IDs.
- Controls fit `667x375`, `740x360`, `844x390`, `932x430`, and tablet landscape.
- Buttons avoid notches, rounded corners, browser bars, and home indicators.
- No hover-only controls.
- Controls do not hide crosshair, ammo, health, objective, or reward choices.

## Rejection Rules

Reject offscreen controls, overlapping thumb zones, single-pointer assumptions, hover-only commands, tiny buttons, or layouts that fail portrait rotate prompt handling.

