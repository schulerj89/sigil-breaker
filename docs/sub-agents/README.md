# Sub-Agent System

This scaffold defines the short-lived Codex sub-agents for the Sigilbreaker mobile-first landscape Three.js FPS rewrite.

The repo now has a clean Three.js/Vite foundation. These sub-agents are the planning, asset, review, and QA structure that must be used as gameplay, external assets, audio, and level systems are added.

## Operating Rules

- Use sub-agents for bounded work with a clear owner, input, output, and stop condition.
- Keep write ownership disjoint. Agents are not alone in the repo and must never revert user work or another agent's edits.
- Every run must read this file, `game-vision.md`, `gates.md`, the agent's own `README.md`, and any handoff JSON listed in that agent folder.
- Every run must update its own `observations.md` with what it saw, why it made decisions, and anything it caught.
- Every run must update its own `handoff.json` with machine-readable notes for downstream agents.
- Store bulky run artifacts under `artifacts/sub-agents/<run-id>/<agent-id>/`.
- Close spawned Codex agents after their final answer has been captured and their artifacts have been reviewed.

## Product Constraints

- Mobile landscape is the primary target. Desktop support is secondary until explicitly promoted.
- The game must expose visible-browser QA hooks for FPS, renderer metrics, loaded assets, scene state, and player/camera state.
- External assets are the normal path. Three.js primitives are allowed only for debug, placeholders, collision proxies, and asset-playground measurement, not as final authored art.
- ElevenLabs output must be generated server-side or build-time, cached as assets, and documented with prompt/settings metadata. Browser code must never contain API keys.
- Asset integration must start in the asset playground before gameplay scenes consume the asset.

## Recommended Flow

1. `mobile-fps-coordinator` scopes the slice and assigns owners.
2. Asset agents source, license-check, register, optimize, and playground-test external assets.
3. Gameplay-facing agents validate mobile FPS feel, touch controls, HUD/title, audio/music, camera, guns, enemies, and powerups.
4. Reviewer agents run performance, memory, smoke QA, and playthrough QA gates.
5. The coordinator resolves cross-agent conflicts and records merge blockers.

## Agent Groups

- Coordination: `mobile-fps-coordinator`
- Asset pipeline: `asset-pipeline-lead`, `external-asset-scout`, `license-provenance-curator`, `asset-registry-agent`, `level-kit-curator`, `enemy-asset-curator`, `weapon-upgrade-asset-curator`, `gltf-optimization-agent`, `asset-playground-qa-agent`
- Game systems: `powerup-progression-agent`, `mobile-fps-game-feel-agent`, `touch-controls-agent`, `landscape-title-hud-agent`, `elevenlabs-audio-music-agent`, `character-dialogue-agent`, `camera-cutscene-agent`
- Review and QA: `performance-budget-agent`, `memory-lifecycle-agent`, `smoke-qa-agent`, `playthrough-qa-agent`

See `registry.json` for the machine-readable registry.

## Folder Contract

Each sub-agent owns:

- `README.md`: mission, ownership, inputs, outputs, checks, and rejection rules.
- `observations.md`: run journal for what the agent saw, why it made decisions, and defects it caught.
- `handoff.json`: machine-readable facts for other agents.

Shared schemas live in `shared/`. Example handoffs live in `examples/`.
