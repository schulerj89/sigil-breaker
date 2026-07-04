# Observations: level-kit-curator

Status: in progress for foundation layout and pinch QA.

## What It Saw

- The foundation 45 x 45 symbol-map test level exists but still uses placeholder geometry.
- The prior lane validator did not explicitly catch one-tile diagonal corner cuts around offset wall joins.
- A diagonal squeeze was found at rows 29/30, columns 17/18 and the doorway alignment was widened.
- User-reported one-unit corner pinches near world `12.1 1.6 -2.1` and `12.2 1.6 7.6` mapped to cells that had long straight runs but bad corner clearance.
- Added a corner-pinch validator for cardinal-wall plus diagonal-corner patterns and closed six offending pinch tiles.
- The foundation level now reports 1640 walkable tiles and keeps spawn-to-exit reachability.

## Decisions

- Every level kit needs unique identity plus reusable gameplay props.
- Powerup spawn anchors should be level-relative.
- Level QA should reject bounded row/column passages below 3 tiles and diagonal corner cuts.
- Level QA should also reject one-tile corner pinch points even when the straight row/column run is longer than 3 tiles.

## Caught Issues

- No first level art brief exists yet.
- The map is still placeholder geometry, so visual readability depends heavily on the symbol-map QA.
- Straight-run validation alone can miss L-shaped corner notches; keep the corner-pinch scan in both script and tests.

## Next Handoff Notes

- Future level-kit imports should keep the stricter `validate-levels` checks green before adding external buildings or props.
