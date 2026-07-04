# Observations: camera-cutscene-agent

Status: not run for full implementation yet; updated with weapon-pose and hold-fire aim handoff.

## What It Saw

- Initial scaffold pass only.
- No future FPS camera, viewmodel, or cutscene system exists yet.
- Camera decisions will affect weapon assets, HUD, controls, and playthrough QA.
- Current gameplay weapon feedback uses `weaponViewPose.ts` to derive camera-local muzzle, tracer, and impact positions from the first-person viewmodel pose.
- Current shot feedback uses `weaponShotMath.ts` to convert flat X/Z wall raycast distance into camera-space tracer distance so pitched gameplay camera shots still terminate at the reticle.
- No deterministic debug look poses exist yet for pitch-up or pitch-down firing screenshots.
- Holding the fire button now blends camera FOV from 70 to 62 degrees and blends each weapon from its hip pose toward a centered aim pose.
- `snapshot.weapon.aimBlend` and `snapshot.weapon.cameraFovDegrees` expose the current aim camera state.
- Fire-button drag can adjust yaw/pitch at reduced sensitivity while the same pointer is held for fire.

## Decisions

- Cutscenes must be skippable and restore input state.
- Gameplay camera must prioritize readability over spectacle.
- Future camera shake, FOV changes, or cutscene transitions must preserve or intentionally suspend the weapon effect pose.
- Future aim modes, FOV changes, recoil cameras, and shake must preserve the camera-space shot distance contract.
- Treat hold-fire as the current aim camera mode even though there is no separate camera state machine yet.
- Any future camera mode must restore the base FOV when held fire, reload, or cutscene state ends.

## Caught Issues

- No future debug camera poses exist yet.
- No debug camera pose exists yet for close-wall weapon retraction and shot-effect alignment.
- Pointer-drag screenshot QA can approximate pitch-up/down firing, but deterministic debug look poses are needed for reliable visual regression.
- Held-fire centering is currently debug-state tested, but not screenshot-regressed for each weapon silhouette.

## Next Handoff Notes

- First camera slice should define debug camera poses for screenshot QA.
- Include a first-person weapon firing pose and a close-wall retraction pose in the first debug camera set.
- Add pitch-up and pitch-down first-person firing poses that assert `snapshot.weapon.effectPose.tracerEnd` still points to the reticle.
- Add held-fire aim poses for SPARK, BORE, and VAULT so viewmodel centering can be screenshot-reviewed.
