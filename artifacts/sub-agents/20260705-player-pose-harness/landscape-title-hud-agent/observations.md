# Landscape Title HUD Agent: Character Debug Entry

## What It Saw

- The title screen already owns the transition from loading to gameplay and uses the same landscape-only shell as combat.
- The rotate prompt is global to the shell, so a title-accessible debug page can inherit the same portrait blocking behavior.
- Small phone landscape heights leave little vertical space for a large pose editor.

## Decisions

- Add a secondary `CHARACTER DEBUG` title button below `START`.
- Introduce a `character-debug` game phase so normal HUD, crosshair, look zone, and touch combat controls stay disabled.
- Put the pose controls in a right-side scrollable panel with compact all-caps controls matching the title/HUD font direction.

## Caught Issues

- The title/loading CSS was phase-specific instead of generic; it now hides each full-screen overlay unless its phase is active.
- The look zone needed to be disabled outside gameplay so it would not consume debug-page touches.

## Next Handoff Notes

- Smoke QA should keep checking `[data-title-character-debug]`, `[data-character-debug]`, and `[data-character-debug-back]`.
- Future mobile debug tools should use the same phase pattern instead of stacking over gameplay.
