# Observations: level-kit-curator

Status: in progress for foundation layout, entry-width, splitter, pinch QA, and steel foundation texture pass.

## What It Saw

- The foundation 45 x 45 symbol-map test level exists but still uses placeholder geometry.
- The prior lane validator did not explicitly catch one-tile diagonal corner cuts around offset wall joins.
- A diagonal squeeze was found at rows 29/30, columns 17/18 and the doorway alignment was widened.
- User-reported one-unit corner pinches near world `12.1 1.6 -2.1` and `12.2 1.6 7.6` mapped to cells that had long straight runs but bad corner clearance.
- Added a corner-pinch validator for cardinal-wall plus diagonal-corner patterns and closed six offending pinch tiles.
- The prior corner-pinch pass reported 1640 walkable tiles and kept spawn-to-exit reachability.
- The user-reported doorway snag was a separate entry-width problem, not just a 3-unit lane problem.
- Added `minEntryUnits: 5` for structural wall-band breaks while keeping ordinary lane validation at 3 units.
- Widened the top vertical divider entry at column 22 rows 4-8, row 20 entries at columns 5-9 and 28-32, and the row 30 right entry at columns 36-40.
- User-reported screenshot coordinates near world `-10.0 1.6 17.8`, `-9.4 1.6 17.2`, and `8.2 1.6 17.5` mapped to the bottom wall-band entries around row 39.
- Added `minEntrySplitSideUnits: 3` and `minEntrySplitAreaUnits: 6` to catch `.#.` wall posts that split a structural entry into two narrow branches.
- Widened row 30 columns 15-22 and row 39 entries at columns 8-14 and 26-32 so adjacent wall posts leave at least 3 units per side.
- The foundation level now reports 1653 walkable tiles and keeps spawn-to-exit reachability.
- The foundation level now uses steel-toned Kenney CC0 prototype textures for floor, wall, and roof surfaces instead of bright prototype colors.
- A full-level roof plane covers the 45 x 45 foundation arena at 3.92 units high.
- Gameplay-height screenshot QA confirmed the steel floor, wall, and roof readability after waiting for GPU texture upload.

## Decisions

- Every level kit needs unique identity plus reusable gameplay props.
- Powerup spawn anchors should be level-relative.
- Level QA should reject bounded row/column passages below 3 tiles and diagonal corner cuts.
- Level QA should also reject one-tile corner pinch points even when the straight row/column run is longer than 3 tiles.
- Level QA should reject structural wall-band entries below 5 tiles without treating every short cover-adjacent open run as a doorway.
- Level QA should reject structural entry splitter posts when either side has below 3 tiles or the combined side clearance is below 6 tiles.
- Keep the steel texture pass as a lightweight prototype kit, not a final level identity kit.

## Caught Issues

- No first level art brief exists yet.
- The map is still placeholder geometry, so visual readability depends heavily on the symbol-map QA.
- Straight-run validation alone can miss L-shaped corner notches; keep the corner-pinch scan in both script and tests.
- The previous corner-pinch validator could not catch a straight 2- or 3-tile doorway with no diagonal pinch pattern.
- A 5-tile structural entry can still feel like 2 usable units when an adjacent wall post splits it into two branches.
- Early texture screenshots could capture before GPU upload and look blank/white; smoke now waits for renderer texture count before validating the frame.

## Next Handoff Notes

- Future level-kit imports should keep the stricter `validate-levels` checks green before adding external buildings or props.
- New structural gates should be tested in rows and columns because divider entries can be vertical as well as horizontal.
- Splitter-post gates should remain scoped to structural wall-band entries so ordinary room dividers do not over-report.
- Future level kits should replace these prototype textures with level-specific external floor, wall, ceiling, prop, and lighting assets.
