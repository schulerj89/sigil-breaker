# Meshy Asset Pipeline Agent Observations

- Reviewed the existing rejected `player.hero.gadget-gremlin` text-to-3D placeholder and confirmed it should be replaced by an image-driven A-pose pass.
- Generated the reference plate at `artifacts/sub-agents/20260705-main-character-apose/landscape-title-hud-agent/generated-reference/player.hero.gadget-gremlin.apose-reference.png`.
- Used Meshy image-to-3D with `pose_mode: a-pose`, then Meshy rigging and animation tasks.
- Added `scripts/combine-meshy-character-clips.mjs` to retarget animation channels onto the base rig by bone name and write one runtime GLB.
- Output runtime file: `public/assets/characters/meshy-gadget-gremlin/models/player.hero.gadget-gremlin.apose.animated.glb`.
- The Meshy API still returns separate full-character GLBs per animation; the single multi-clip GLB is produced by local post-processing.

