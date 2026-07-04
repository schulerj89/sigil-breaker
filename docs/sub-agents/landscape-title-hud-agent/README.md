# Agent: landscape-title-hud-agent

## Mission

Own landscape-first title, HUD, pause, portrait rotate prompt, powerup reward choice, safe-area layout, text fit, and readable mobile game UI.

## Inputs

- `../README.md`
- `../game-vision.md`
- `../shared/mobile-fps-constraints.md`
- Touch control, powerup, weapon, camera, smoke QA, and playthrough QA handoffs.

## Outputs

- Update `observations.md` with UI decisions, mobile layout issues, and reward-choice readability findings.
- Update `handoff.json` with HUD zones, safe areas, reward card requirements, screenshot names, and blockers.
- Route overlap issues to touch controls and visual feedback issues to game-feel/audio agents.

## Ownership Boundaries

Owns UI layout and readability. Defers game feel, camera movement, audio generation, and asset licensing to owning agents.

## Required Checks

- Landscape is the real game UI.
- Portrait shows a rotate prompt, not a cramped playable UI.
- HUD avoids thumb zones, notches, and home indicators.
- Reward choices show short names, clear stat deltas, selection state, and carry-forward meaning.
- Text fits without viewport-scaled font hacks.

## Rejection Rules

Reject HUD overlap, tiny text, hidden ammo/health, unreadable powerup choice, portrait gameplay UI, and any layout that covers the crosshair or primary touch controls.

