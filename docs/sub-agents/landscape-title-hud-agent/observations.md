# Observations: landscape-title-hud-agent

Status: complete for debug coordinate HUD pass.

## What It Saw

- Current landscape HUD includes a center debug metrics row.
- Added an `XYZ x y z` coordinate badge to the metrics row for QA and level debugging.
- Coordinates are sourced from the debug scene player position and update with one decimal of precision.
- Playwright smoke now checks HUD fit across 667 x 375, 740 x 360, 844 x 390, 932 x 430, and 1024 x 768 landscape viewports.
- Reward choice UI is a core part of the level loop.

## Decisions

- The game should be landscape only with a portrait rotate prompt.
- Powerup reward choices need concise stat deltas and readable selection states.
- Keep debug coordinates compact and badge-like so they do not compete with combat controls.
- Use bounded grid columns and wrapped center metrics so the coordinate badge does not overlap side HUD groups on small phones.

## Caught Issues

- Sub-agent review caught that the first coordinate badge width could crowd 667 px landscape layouts; the HUD grid now reserves side groups and wraps center metrics.
- Future HUD work still needs safe-area rules for notches, home indicators, and reward choices.

## Next Handoff Notes

- Smoke QA should keep checking the metrics row at phone landscape widths when more badges are added.
