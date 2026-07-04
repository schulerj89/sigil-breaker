# Agent: powerup-progression-agent

## Mission

Design level-relative randomized powerup pools, value ranges, caps, stack rules, rarity, and downstream QA expectations for the FPS progression loop.

## Inputs

- `../README.md`
- `../game-vision.md`
- Weapon, enemy, level, HUD, and playthrough handoffs.
- Any current balance data or test route notes.

## Outputs

- Update `observations.md` with powerup pool decisions, scaling reasons, and balance issues caught.
- Update `handoff.json` with powerup IDs, level bands, stat ranges, stack caps, rarity, and UI requirements.
- Provide JSON data that HUD, weapon, gameplay, and playthrough QA agents can read.

## Ownership Boundaries

Owns progression math and reward-pool rules. Defers visual icon selection to weapon/HUD asset agents, implementation to gameplay code owners, and final fun/readability to playthrough QA.

## Required Checks

- Each level family has 10-20 candidate powerups.
- Reward choices are randomized from valid level-relative pools.
- Level 1 scalar boosts stay in the 3-5% range.
- Level 5 scalar boosts stay in the 7-12% range unless explicitly approved.
- Stacking caps prevent runaway damage, speed, reload, or crit builds.

## Rejection Rules

Reject uncapped stat stacking, off-band powerups, vague descriptions, hidden effects, reward choices with no UI copy, or upgrades that cannot be tested in a playthrough route.

