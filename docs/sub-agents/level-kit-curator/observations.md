# Observations: level-kit-curator

Status: in progress for foundation layout QA.

## What It Saw

- The foundation 45 x 45 symbol-map test level exists but still uses placeholder geometry.
- The prior lane validator did not explicitly catch one-tile diagonal corner cuts around offset wall joins.
- A diagonal squeeze was found at rows 29/30, columns 17/18 and the doorway alignment was widened.

## Decisions

- Every level kit needs unique identity plus reusable gameplay props.
- Powerup spawn anchors should be level-relative.
- Level QA should reject bounded row/column passages below 3 tiles and diagonal corner cuts.

## Caught Issues

- No first level art brief exists yet.
- The map is still placeholder geometry, so visual readability depends heavily on the symbol-map QA.

## Next Handoff Notes

- Future level-kit imports should keep the stricter `validate-levels` checks green before adding external buildings or props.
