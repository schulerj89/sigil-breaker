# Observations: smoke-qa-agent

Status: complete for input/collision/layout fix.

## What It Saw

- Ran in-browser smoke at an 844 x 390 landscape viewport against the local dev server.
- Verified all three weapon asset IDs load, the weapon selector changes active state, and the fire button decrements ammo/increments shot count.
- Verified the shared Kenney texture URL returns 200 and the debug API reports no asset load errors.
- Captured a landscape screenshot with HUD, d-pad, weapon tray, VAULT viewmodel, and fire button visible.
- Re-ran smoke after the input/collision pass: repeated fire kept viewport scale at 1 and lastShot reported a wall hit at tile `[22, 1]`.
- Captured a new landscape screenshot showing the SPARK viewmodel facing forward with HUD and touch controls visible.
- Fresh reload CDP event check reported no new log or exception events.

## Decisions

- Keep this as manual browser smoke for now.
- Add automated browser smoke once the test harness is introduced.
- Keep using `visualViewport.scale` as the smoke signal for double-tap zoom regressions.

## Caught Issues

- Initial smoke caught a missing `Textures/colormap.png` dependency from the GLBs; the texture is now committed and validated.
- Visible dev-browser FPS reported around 57 FPS during smoke, so production profiling should stay on the performance agent backlog.
- Visible dev-browser FPS reported around 56 FPS during the latest 844 x 390 smoke.

## Next Handoff Notes

- Next smoke slice should automate nonblank canvas, no asset failures, and weapon state interactions.
- Add automated fast-fire/no-zoom and wall-hit assertions when browser smoke becomes scripted.
