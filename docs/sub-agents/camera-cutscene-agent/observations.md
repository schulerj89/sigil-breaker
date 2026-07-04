# Observations: camera-cutscene-agent

Status: not run for full implementation yet; updated with weapon-pose handoff.

## What It Saw

- Initial scaffold pass only.
- No future FPS camera, viewmodel, or cutscene system exists yet.
- Camera decisions will affect weapon assets, HUD, controls, and playthrough QA.
- Current gameplay weapon feedback uses `weaponViewPose.ts` to derive camera-local muzzle, tracer, and impact positions from the first-person viewmodel pose.

## Decisions

- Cutscenes must be skippable and restore input state.
- Gameplay camera must prioritize readability over spectacle.
- Future camera shake, FOV changes, or cutscene transitions must preserve or intentionally suspend the weapon effect pose.

## Caught Issues

- No future debug camera poses exist yet.
- No debug camera pose exists yet for close-wall weapon retraction and shot-effect alignment.

## Next Handoff Notes

- First camera slice should define debug camera poses for screenshot QA.
- Include a first-person weapon firing pose and a close-wall retraction pose in the first debug camera set.
