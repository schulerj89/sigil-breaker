# Game Vision

Sigilbreaker will become a mobile-first landscape Three.js FPS built around short levels, readable combat, external asset kits, and end-of-level powerup choices.

## Core Loop

1. Start a level with a level-specific enemy mix, weapon context, visual kit, and objective.
2. Move, aim, shoot, reload, dodge, and interact through touch controls.
3. Finish the level and choose one powerup from a randomized set.
4. Carry the chosen powerup into the next level.
5. Escalate enemy behavior, arenas, weapon upgrades, music intensity, and powerup ranges by level.

## Powerups

Each level family should expose a collection of 10-20 candidate powerups. A completed level presents a smaller randomized choice set from that collection. Values must be level-relative and capped by tier so early upgrades do not break later balance.

Initial scalar bands:

- Level 1: 3-5% common stat improvements.
- Level 2: 4-7% common or conditional improvements.
- Level 3: 5-9% stronger conditional improvements.
- Level 4: 6-10% hybrid stat or weapon behavior improvements.
- Level 5: 7-12% stronger identity-defining improvements.
- Level 6 and later: 9-15% only with coordinator and playthrough QA approval.

Powerups can affect damage, reload, fire rate, ammo economy, movement, recoil, shield, pickup radius, crit chance, ability cooldowns, or level-specific mechanics. Each powerup must define stack policy, cap, affected weapons, affected enemies, UI copy, and QA checks.

## Levels

Every level needs a distinct external asset kit:

- Environment identity, buildings, props, hazards, landmarks, sky, and lighting references.
- Unique enemies plus a few recurring baseline enemies for recognition.
- Level-specific music, ambience, stingers, SFX, and optional voice barks.
- A readable start, combat route, encounter climax, end-of-level reward space, and transition.

## Weapons

Weapons should feel meaningfully different on mobile:

- Clear cadence, recoil, reload timing, impact feedback, ammo economy, and upgrade hooks.
- First-person presentation must be tested in landscape with touch controls visible.
- Muzzle flash, projectile/tracer, hit impact, pickup, and upgrade visuals are assets, not hardcoded Three.js art.

## Non-Negotiables

- Landscape mobile first.
- Visible-browser 60 FPS target.
- Asset playground validation before gameplay integration.
- Source/license ledger before an asset ships.
- Debug API for automated smoke, performance, memory, screenshot, and playthrough QA.
- No runtime ElevenLabs secret usage in the browser.

