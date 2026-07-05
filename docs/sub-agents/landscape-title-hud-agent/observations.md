# Observations: landscape-title-hud-agent

Status: complete for debug coordinate, music mute, weapon cycle, and rotate prompt phone-only motion pass.

## What It Saw

- Current landscape HUD includes a center debug metrics row.
- Added an `XYZ x y z` coordinate badge to the metrics row for QA and level debugging.
- Coordinates are sourced from the debug scene player position and update with one decimal of precision.
- Playwright smoke now checks HUD fit across 667 x 375, 740 x 360, 844 x 390, 932 x 430, and 1024 x 768 landscape viewports.
- Added a compact top-right music mute icon button using `[data-music-toggle]`.
- Replaced the plain portrait text prompt with a phone-and-rotation icon plus concise landscape copy.
- Replaced the bottom weapon preview tray with a single right-thumb weapon cycle button at `[data-weapon-cycle-button]`.
- The cycle button carries `data-active-weapon-id` and updates its ARIA label with the current weapon.
- The portrait prompt now uses only the CSS-animated phone; the arrow was removed because it made the prompt look busy.
- Screenshot QA for this pass lives under `artifacts/sub-agents/20260704-weapon-cycle-burst/smoke-qa-agent/`.
- Reward choice UI is a core part of the level loop.

## Decisions

- The game should be landscape only with a portrait rotate prompt.
- Powerup reward choices need concise stat deltas and readable selection states.
- Keep debug coordinates compact and badge-like so they do not compete with combat controls.
- Use bounded grid columns and wrapped center metrics so the coordinate badge does not overlap side HUD groups on small phones.
- Use a compact icon button for music mute instead of another text badge so the top HUD still fits small landscape phones.
- Keep the portrait prompt full-screen and above touch controls because portrait is not a playable orientation.
- Keep weapon switching in the right thumb zone beside held-fire so the bottom center stays clear for the viewmodel.
- Use CSS-only motion for the rotate prompt and honor `prefers-reduced-motion` by showing the final landscape phone pose.
- Keep the rotate prompt icon phone-only unless a future screenshot review proves additional direction is needed.

## Caught Issues

- Sub-agent review caught that the first coordinate badge width could crowd 667 px landscape layouts; the HUD grid now reserves side groups and wraps center metrics.
- Future HUD work still needs safe-area rules for notches, home indicators, and reward choices.
- Portrait prompt icon and mute button now need screenshot QA when visual style changes.
- Smoke QA now checks the rotate arrow remains absent and the phone animation stays active.
- Phone-only rotate prompt screenshot is stored under `artifacts/sub-agents/20260704-weapon-effects-smoothing/smoke-qa-agent/`.
- The bottom weapon tray was competing with viewmodel framing and touch layout; future HUD work should not bring preview buttons back without a new layout review.

## Next Handoff Notes

- Smoke QA should keep checking the metrics row at phone landscape widths when more badges or controls are added.
- Future HUD changes should keep `[data-music-toggle]` reachable and avoid placing it under `aria-hidden`.
- Future touch-control work should keep `[data-weapon-cycle-button]` near `[data-fire-button]` and preserve the no-bottom-tray contract.

## 2026-07-05 Title Screen Pass

### What It Saw

- GPT Image 2 generated three no-text landscape title concepts under `artifacts/sub-agents/20260705-title-screen/landscape-title-hud-agent/generated-designs/`.
- Concept 002 has the cleanest left-side title/start zone and the best metallic FPS match.
- Concept 001 was the runner-up because the sigil read is strong, but it competes more with the title zone.
- The selected runtime title background is `public/assets/title/sigilbreaker-title-bg.webp`.
- `snapshot.scene.phase` and `snapshot.ui.loading` now expose `loading`, `title`, and `gameplay` state for QA.

### Decisions

- Use live DOM text and buttons over generated art instead of baking words into the image.
- Use a wide condensed sci-fi sans style with all-caps title treatment; do not use decorative rune fonts for primary UI.
- Use gunmetal, charcoal, cyan-teal, restrained green, and small amber accents as the title/loading palette.
- Keep title/start left anchored and avoid the center-right portal detail.
- Compress the runtime image to WebP; keep the full generated PNG concepts only as sub-agent artifacts.

### Caught Issues

- The first title screenshot caught the loading overlay ghosting beneath the title during a fade transition; hidden full-screen overlays now use `display: none`.
- The left edge of the selected concept needed a stronger dark title-safe gradient so generated background details do not read as stray UI.

### Next Handoff Notes

- Future title/HUD work should keep `[data-title-screen]`, `[data-title-start]`, and `[data-loading-screen]` stable for smoke QA.
- Future powerup/reward screens should follow the same condensed font direction and cyan/green/charcoal palette unless the game direction agent intentionally revisits the visual identity.
- Browser smoke should continue checking title background cache busting through `assetBuild`.
