# Observations: level-kit-curator

Status: in progress for foundation layout, entry-width, and pinch QA.

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
- The foundation level now reports 1648 walkable tiles and keeps spawn-to-exit reachability.

## Decisions

- Every level kit needs unique identity plus reusable gameplay props.
- Powerup spawn anchors should be level-relative.
- Level QA should reject bounded row/column passages below 3 tiles and diagonal corner cuts.
- Level QA should also reject one-tile corner pinch points even when the straight row/column run is longer than 3 tiles.
- Level QA should reject structural wall-band entries below 5 tiles without treating every short cover-adjacent open run as a doorway.

## Caught Issues

- No first level art brief exists yet.
- The map is still placeholder geometry, so visual readability depends heavily on the symbol-map QA.
- Straight-run validation alone can miss L-shaped corner notches; keep the corner-pinch scan in both script and tests.
- The previous corner-pinch validator could not catch a straight 2- or 3-tile doorway with no diagonal pinch pattern.

## Next Handoff Notes

- Future level-kit imports should keep the stricter `validate-levels` checks green before adding external buildings or props.
- New structural gates should be tested in rows and columns because divider entries can be vertical as well as horizontal.
