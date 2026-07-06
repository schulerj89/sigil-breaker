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
- Death cinematic pass added a dedicated `death-cinematic` game phase, hidden HUD/input, a third-person character stage, and a slow orbit camera.
- The player character asset already included the `out-of-hp` animation, so the first death slice reused the rigged GLB instead of introducing a new asset.
- The fail voice pack already included `Oof! Reboot me!`, which is short enough to work as the first death-caption sting.
- Browser QA now forces player death through a `qaCapture`-gated debug damage hook, waits for the death camera phase, and verifies Try Again resets health, enemies, projectiles, weapon state, and the active gun.
- Follow-up death pass moved the cinematic into the live level scene at the player death coordinates instead of rendering a separate standalone stage.
- The debug HUD now exposes a `KO` button that triggers the death cinematic quickly during gameplay.
- The player GLB needed a 0.01 skinned animation scale correction for death display; static mesh bounds and skinned animation authoring units differ by about 100x.
- Screenshot QA artifacts now show the early standing/read beat and later out-of-HP floor pose under `artifacts/sub-agents/20260705-death-cinematic/smoke-qa-agent/`.

## Decisions

- Cutscenes must be skippable and restore input state.
- Gameplay camera must prioritize readability over spectacle.
- Future camera shake, FOV changes, or cutscene transitions must preserve or intentionally suspend the weapon effect pose.
- Future aim modes, FOV changes, recoil cameras, and shake must preserve the camera-space shot distance contract.
- Treat hold-fire as the current aim camera mode even though there is no separate camera state machine yet.
- Any future camera mode must restore the base FOV when held fire, reload, or cutscene state ends.
- Death must be a separate state from gameplay, not a HUD overlay on top of the first-person weapon.
- The death cinematic should render in the live level scene so the character appears where HP reached zero.
- Try Again is the primary action and appears after the death read completes at about 3.2 seconds.
- Return to Title also clears combat state so the title screen never inherits dead enemies, projectiles, ammo, or zero HP.
- The death character clone can render above nearby level geometry during the cinematic; this protects readability in tight corners and halls.

## Caught Issues

- No future debug camera poses exist yet.
- No debug camera pose exists yet for close-wall weapon retraction and shot-effect alignment.
- Pointer-drag screenshot QA can approximate pitch-up/down firing, but deterministic debug look poses are needed for reliable visual regression.
- Held-fire centering is currently debug-state tested, but not screenshot-regressed for each weapon silhouette.
- The first standalone death stage did not show the exact level location where the player died.
- Initial live-level screenshots showed only walls because the camera rotated into a blocked angle before the character read.
- The out-of-HP animation uses skinned authoring units that made the character effectively huge until the death clone applied a 0.01 scale correction.

## Next Handoff Notes

- First camera slice should define debug camera poses for screenshot QA.
- Include a first-person weapon firing pose and a close-wall retraction pose in the first debug camera set.
- Add pitch-up and pitch-down first-person firing poses that assert `snapshot.weapon.effectPose.tracerEnd` still points to the reticle.
- Add held-fire aim poses for SPARK, BORE, and VAULT so viewmodel centering can be screenshot-reviewed.
- Future death camera work should preserve the current early-angle hold and wall-readable character render unless a better obstruction solver replaces it.
- If strict wall occlusion is restored later, add room-aware camera placement first so tight corners cannot hide the character.

## 2026-07-05 - First Level Intro Cinematic Plan

- Planning report added at `docs/cinematics/first-level-intro-cinematic-plan.md`.
- Recommendation is an `intro-cinematic` phase before Level 1 gameplay, not a title overlay.
- The MVP commander should be a flat hologram portrait with live captions and build-time ElevenLabs VO.
- Existing 3D Glyph should appear in short response shots using current idle or gun-hold animation, with no mouth sync requirement.
- Commander Kade is the working guide identity: calm, tactical, angular, gunmetal/cyan/amber palette, contrasting Glyph's playful silhouette.
- First level should become "Rift Deck 01", a guided tutorial wrapper teaching move, look, fire, ammo/reload, 25 HP fragility, contact damage, projectiles, and the exit beacon.
- Intro target runtime is 28-38 seconds, with skip available after 2 seconds and mandatory input restoration before gameplay.
- 3D Meshy commander is deferred until the flat portrait version proves pacing, script, and camera readability.

## 2026-07-05 - First Level Intro Cinematic Implementation

- `intro-cinematic` is now a formal phase between title and gameplay.
- `src/game/introCinematicStage.ts` runs five timed camera shots over the existing level scene and exposes a debug snapshot for cue, caption, portrait, skip, and streaming-anchor state.
- Title Play opens the intro, skip unlocks after 2 seconds, and skip/natural completion share the same handoff: stop voice, close intro, reset combat state, enter gameplay.
- The intro uses the flat Commander Kade hologram portrait for MVP instead of blocking on a 3D commander model.
- Level streaming follows the cinematic look target during intro shots so distant areas can appear without loading the whole level.
- A simple glowing 3D exit rift marker is now attached to the `X` tile as the first objective visual.

## 2026-07-05 - Intro Cinematic Camera Polish

- Intro camera placement now runs a level raycast from the look target toward the desired camera position before rendering each frame.
- If the desired camera would sit behind a wall, the camera is pulled in front of that wall and then passed through the normal level collision resolver.
- The deck, hostile, and weapons shots now use look targets inside walkable space, with the hostile shot moved to a more readable central room enemy.
- Screenshot QA recaptured 667x375 intro frames under `artifacts/sub-agents/20260705-intro-cinematic-polish/smoke-qa-agent/`.
- Future intro shots should avoid look targets on `#` or outside the map, because collision safety can prevent clipping but cannot make a bad composition readable.

## 2026-07-05 - Victory Cinematic

- Added `victory-cinematic` as a separate phase from death, title, and gameplay.
- `src/game/victoryCinematicStage.ts` reuses the full rigged Glyph GLB and plays the embedded `dance` animation in the live level scene.
- The victory camera orbits while always looking at Glyph; the model rotates toward the camera so the dance reads from the front.
- Victory uses existing Glyph level-complete voice lines and stores scoreboard state in `snapshot.ui.victoryScore`.
- The debug HUD now exposes a `WIN` button for fast QA of the end-of-level cinematic without walking the full level.
- The exit rift can trigger victory naturally when the player enters the rift radius.
- Screenshot QA captured the victory scoreboard at `artifacts/sub-agents/20260705-victory-cinematic/smoke-qa-agent/victory-scoreboard-667x375.png`.
