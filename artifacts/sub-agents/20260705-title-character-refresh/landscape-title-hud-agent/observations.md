# Landscape Title HUD Agent Observations

Status: complete for the live-character title refresh decision.

## What It Saw

- The previous title screen was readable but felt like a static tactical poster and hid the new mascot character.
- The selected player character has strong amber fur, cobalt cloth, lime tech accents, and a playful silhouette that should drive the title palette.
- Four GPT Image 2 mocks were generated using the selected character preview as visual reference.

## Decision

- Use mock 03, `title-mock-03-sigil-observatory.png`, as the primary direction because it gives the cleanest left title zone and the strongest right-side character/aura read.
- Borrow mock 02's cobalt/lime/amber balance for the palette.
- Borrow mock 04 only for a short one-shot letter bounce/sweep transition, not for its fake UI panels.
- Keep real HTML for the title and buttons and render the character live in Three.js on the right.

## Caught Issues

- Generated mocks must not become runtime backgrounds for this pass because they would fight the live Three.js character.
- Endless title letter motion would feel cheap; the bounce should happen only as the title appears.
- Small phone landscape needs the title copy constrained to the left 40-52% so it does not overlap the live character.

## Handoff

- Runtime files: `src/game/titleHeroStage.ts`, `src/game/createGame.ts`, and `src/style.css`.
- Provenance: `docs/assets/openai-title-character-refresh.json`.
- Generated mock artifacts live in `generated-mocks/`.

## Final Runtime Notes

- The game title is now `Gadget Rift`.
- The title is intentionally split into two non-wrapping DOM lines, `GADGET` and `RIFT`, so the words fit on phone landscape viewports.
- The runtime background uses `public/assets/title/gadget-rift-title-bg.webp`, a GPT Image 2 edit of mock 03 with the mock character removed so the live Three.js character can occupy the portal space.
- The live character is rendered through `TitleHeroStage` using the shared Meshy character GLB and the `idle-alt` clip.
- `TitleHeroStage` disables renderer local clipping only during title rendering, then restores it, because the shared gameplay renderer keeps local clipping enabled for the first-person arm viewmodel.
- Smoke QA captured `title-gadget-rift-844x390.png`; the latest capture verifies the character, buttons, and two-line title fit together.
