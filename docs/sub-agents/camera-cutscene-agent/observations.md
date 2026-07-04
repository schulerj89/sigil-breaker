# Observations: camera-cutscene-agent

Status: not run for full implementation yet; updated with weapon-pose handoff.

## What It Saw

- Initial scaffold pass only.
- No future FPS camera, viewmodel, or cutscene system exists yet.
- Camera decisions will affect weapon assets, HUD, controls, and playthrough QA.
- Current gameplay weapon feedback uses `weaponViewPose.ts` to derive camera-local muzzle, tracer, and impact positions from the first-person viewmodel pose.
- Current shot feedback uses `weaponShotMath.ts` to convert flat X/Z wall raycast distance into camera-space tracer distance so pitched gameplay camera shots still terminate at the reticle.
- No deterministic debug look poses exist yet for pitch-up or pitch-down firing screenshots.

## Decisions

- Cutscenes must be skippable and restore input state.
- Gameplay camera must prioritize readability over spectacle.
- Future camera shake, FOV changes, or cutscene transitions must preserve or intentionally suspend the weapon effect pose.
- Future aim modes, FOV changes, recoil cameras, and shake must preserve the camera-space shot distance contract.

## Caught Issues

- No future debug camera poses exist yet.
- No debug camera pose exists yet for close-wall weapon retraction and shot-effect alignment.
- Pointer-drag screenshot QA can approximate pitch-up/down firing, but deterministic debug look poses are needed for reliable visual regression.

## Next Handoff Notes

- First camera slice should define debug camera poses for screenshot QA.
- Include a first-person weapon firing pose and a close-wall retraction pose in the first debug camera set.
- Add pitch-up and pitch-down first-person firing poses that assert `snapshot.weapon.effectPose.tracerEnd` still points to the reticle.
