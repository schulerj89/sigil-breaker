# Observations: playthrough-qa-agent

Status: not run for full implementation yet; updated with traversal targets.

## What It Saw

- Initial scaffold pass only.
- No FPS playable route exists yet.
- Full playthrough QA should start after smoke, controls, HUD, camera, and first combat loop exist.
- The foundation map now has structural five-tile entries that should be included in route traversal once deterministic route tooling exists.
- The foundation map now also has splitter-post clearance targets around row 30 and row 39 entries.
- Future routes should include held fire while moving and turning because the fire button now owns shot cadence, zoom, weapon centering, and reduced-sensitivity look.
- Future routes should switch weapons through the bottom weapon tray.

## Decisions

- Playthrough QA must cover reward choice and level transition, not only combat.
- Findings should lead with player-facing breakage.

## Caught Issues

- No route or debug shortcuts exist yet.
- No route assertion exists yet for moving through the widened entries with the weapon footprint active.
- No route assertion exists yet for branch traversal around continuing divider posts near structural entries.
- No route assertion exists yet for sustained hold-fire while moving through entries or turning near walls.

## Next Handoff Notes

- Future implementation should add deterministic test routes and debug shortcuts for playthrough QA.
- First route should include the top vertical divider entry, both row 20 entries, both row 30 entries, and both row 39 entries.
- Include hold-fire aim, release cleanup, and weapon-tray switching in the first combat route.
