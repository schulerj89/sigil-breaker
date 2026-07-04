# Observations: smoke-qa-agent

Status: complete for first weapon intake.

## What It Saw

- Ran in-browser smoke at an 844 x 390 landscape viewport against the local dev server.
- Verified all three weapon asset IDs load, the weapon selector changes active state, and the fire button decrements ammo/increments shot count.
- Verified the shared Kenney texture URL returns 200 and the debug API reports no asset load errors.
- Captured a landscape screenshot with HUD, d-pad, weapon tray, VAULT viewmodel, and fire button visible.

## Decisions

- Keep this as manual browser smoke for now.
- Add automated browser smoke once the test harness is introduced.

## Caught Issues

- Initial smoke caught a missing `Textures/colormap.png` dependency from the GLBs; the texture is now committed and validated.
- Visible dev-browser FPS reported around 57 FPS during smoke, so production profiling should stay on the performance agent backlog.

## Next Handoff Notes

- Next smoke slice should automate nonblank canvas, no asset failures, and weapon state interactions.
