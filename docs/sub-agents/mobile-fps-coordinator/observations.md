# Observations: mobile-fps-coordinator

Status: not run for implementation yet.

## What It Saw

- Initial scaffold pass created the agent system before runtime FPS code existed.
- The repo is now a Vite, TypeScript, Three.js FPS foundation.
- Future Three.js FPS work needs bounded sub-agent ownership before code changes begin.
- 2026-07-04 setup pass removed the Phaser MVP source, puzzle docs, Sokoban assets, and old screenshots.
- 2026-07-04 setup pass installed Three.js and added a mobile landscape renderer foundation with debug metrics.
- 2026-07-04 first FPS slice added a 20 x 20 symbol-map level, first-person camera controls, camera-relative mobile movement, and Pages cache-busting workflow updates.
- 2026-07-04 spacing pass expanded the foundation level to 34 x 34 units with at least 3-unit traversal lanes.
- 2026-07-04 streaming pass expanded the foundation level to 45 x 45 units, moved map data into JSON, added level QA validation, chunked runtime loading, and visible FPS/memory/chunk HUD metrics.

## Decisions

- Keep the sub-agent system under `docs/sub-agents/`.
- Require each agent folder to maintain its own `observations.md` and `handoff.json`.
- Require spawned agents to be closed after their final output is captured.
- Treat the new Three.js arena as a debug placeholder only, not final authored game art.
- Keep `src/game/foundationLevelMap.json` as the level source of truth until an asset-backed level pipeline replaces it.
- Keep `npm run validate:levels` in CI so no future map edit introduces 1-unit or 2-unit traversal lanes.

## Caught Issues

- No implementation slice exists yet, so there are no gameplay defects to report.
- No external FPS assets exist yet, so asset agents must still run before real level art is integrated.
- Mobile movement and look controls exist, but action buttons are still visual placeholders.

## Next Handoff Notes

- Start future work with a coordinator slice plan before assigning asset or gameplay implementation.
- Next implementation slice should build the asset playground or first mobile input/combat vertical slice.
- Next implementation slice can add weapon interaction, collision debugging overlays, asset playground support, or asset-backed chunk streaming.

## 2026-07-05 - First Level Intro Planning

- Planning report added at `docs/cinematics/first-level-intro-cinematic-plan.md`.
- The first intro should be a planning-approved slice before implementation: commander image concept, commander VO, intro phase, captions, camera timeline, and smoke QA.
- Coordinator decision is to use a flat Commander Kade hologram for the MVP and defer a Meshy 3D commander until pacing and readability are proven.
- Required implementation owners for the eventual slice: camera-cutscene-agent, landscape-title-hud-agent, character-dialogue-agent, elevenlabs-audio-music-agent, asset-registry-agent, smoke-qa-agent, and playthrough-qa-agent.
- The slice must remain mobile landscape-first and must prove skip/input restoration before merge.
