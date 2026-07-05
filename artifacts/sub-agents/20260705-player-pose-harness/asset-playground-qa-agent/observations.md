# Asset Playground QA Agent: Player Pose Harness

## What It Saw

- The Meshy gadget-gremlin rig has named spine, shoulder, arm, forearm, hand, neck, and head bones that are suitable for a manual gun-hold pose pass.
- The existing headed player-character QA proves the model can load in visible Chromium, but it does not let a designer adjust bone rotations.
- A GitHub Pages runtime cannot write JSON directly into the repo, so the title-accessible harness must copy or download pose data.

## Decisions

- Add an in-app character debug page that reuses the game renderer, mobile landscape rotate prompt, and title flow.
- Keep the local `pose:harness:player` script because it can POST pose JSON back into `public/assets/characters/meshy-gadget-gremlin/poses/` during local authoring.
- Export rotations both as degrees and radians relative to the imported bind pose, plus left/right hand world positions for later weapon socket alignment.

## Caught Issues

- The current source character is still too heavy for gameplay integration without the GLTF optimization pass.
- The harness is for still-pose authoring only; it does not yet generate animation clips or retarget existing clips.

## Next Handoff Notes

- Downstream weapon/camera work should consume the saved pose JSON as a draft and then create a stable weapon socket on or near `RightHand`.
- Performance QA should treat the character debug page as a tool surface, not a shipped gameplay scene.
