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
- The prior foundation layout reported 1653 walkable tiles and kept spawn-to-exit reachability before the isolated-room access pass.
- The foundation level now uses steel-toned Kenney CC0 prototype textures for floor, wall, and roof surfaces instead of bright prototype colors.
- A full-level roof plane covers the 45 x 45 foundation arena at 3.92 units high.
- Gameplay-height screenshot QA confirmed the steel floor, wall, and roof readability after waiting for GPU texture upload.
- The isolated right-side room at rows 11-19, columns 34-43 was unreachable from spawn and contained an enemy marker plus cover.
- Opened a 5-tile entry through column 33, rows 12-16, so the isolated room is reachable while preserving the structural entry-width rule.
- Moved the `X` exit marker to row 43, column 43, the bottom-right interior corner opposite spawn at row 1, column 1.
- `validate-levels` now rejects any non-solid tile that is unreachable from spawn, not only an unreachable exit.
- The foundation level now reports 1658 walkable tiles and all 1658 are reachable from spawn.
- Added `src/game/bossLevelMap.json` as a separate `boss-forge-31x31` configuration with one `B` boss marker, six `E` minion markers, cover pylons, defeat-boss objective metadata, boss phases, and reward powerup range metadata.
- `validate-levels` now validates every `src/game/*LevelMap.json` file by default and enforces boss-specific config requirements when `levelType` is `boss`.
- Replaced the visible prototype grid feel with derivative metal-panel floor, wall, and roof textures generated from the existing CC0 Kenney texture source.
- Removed the extra floor `GridHelper` overlay so the floor no longer has a separate high-contrast black grid on top of the texture.
- Wall texture now uses broad steel panels with screw heads, brushed scratches, and softer seams instead of the old tiled grid-line look.
- Floor texture now uses darker gunmetal plates, subtle tread direction, screw heads, and warm caution stripe accents for color without the old black grid overlay.
- Focused screenshot QA stored `foundation-metal-wall-floor.png` and confirmed the wall screw detail, darker floor panels, roof texture, and removed floor grid overlay.
- Latest `npm run validate:browser` passed all five landscape viewport projects after the metal texture pass.

## Decisions

- Every level kit needs unique identity plus reusable gameplay props.
- Powerup spawn anchors should be level-relative.
- Level QA should reject bounded row/column passages below 3 tiles and diagonal corner cuts.
- Level QA should also reject one-tile corner pinch points even when the straight row/column run is longer than 3 tiles.
- Level QA should reject structural wall-band entries below 5 tiles without treating every short cover-adjacent open run as a doorway.
- Level QA should reject structural entry splitter posts when either side has below 3 tiles or the combined side clearance is below 6 tiles.
- Level QA should reject unreachable walkable rooms, enemies, and exit spaces.
- Keep the steel texture pass as a lightweight prototype kit, not a final level identity kit.
- Keep the derivative metal texture pass as the current foundation kit until a full level-specific external environment kit is selected.
- Keep the boss level data-only for this pass; runtime level selection and boss AI should be separate gameplay slices.
- Use `B` as the reserved boss marker symbol and keep `E` for minion spawns.
- Keep the foundation metal texture pass as the current visual direction until a full level-specific environment kit replaces it.

## Caught Issues

- No first level art brief exists yet.
- The map is still placeholder geometry, so visual readability depends heavily on the symbol-map QA.
- Straight-run validation alone can miss L-shaped corner notches; keep the corner-pinch scan in both script and tests.
- The previous corner-pinch validator could not catch a straight 2- or 3-tile doorway with no diagonal pinch pattern.
- A 5-tile structural entry can still feel like 2 usable units when an adjacent wall post splits it into two branches.
- Early texture screenshots could capture before GPU upload and look blank/white; smoke now waits for renderer texture count before validating the frame.
- Spawn-to-exit reachability did not catch an isolated room with an enemy and cover; all-walkable reachability now covers that defect class.
- The previous level validator default only checked the foundation map, so adding more level JSON files needed default multi-map validation.
- Derivative procedural texture generation should remain deterministic so asset hashes stay reproducible.
- Headless visual capture can log empty Three.js shader validation messages; use the Playwright gate result and filtered visual report for pass/fail.

## Next Handoff Notes

- Future level-kit imports should keep the stricter `validate-levels` checks green before adding external buildings or props.
- New structural gates should be tested in rows and columns because divider entries can be vertical as well as horizontal.
- Splitter-post gates should remain scoped to structural wall-band entries so ordinary room dividers do not over-report.
- Future level edits should preserve the opposite-corner route from `S` row 1, column 1 to `X` row 43, column 43 unless the level objective changes.
- Future level kits should replace these prototype textures with level-specific external floor, wall, ceiling, prop, and lighting assets.
- Future texture passes should prefer broad material panels over high-contrast square grids for mobile readability.
- Runtime level-loading work should consume `src/game/levelConfigs.ts` instead of importing only the foundation JSON.
