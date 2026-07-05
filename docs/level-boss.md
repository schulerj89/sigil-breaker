# Boss Level Configuration

The first boss-level source of truth is `src/game/bossLevelMap.json`. It is not wired into the playable runtime yet; it establishes the data contract for a separate boss arena, boss marker, minion markers, phase tuning, and post-fight reward metadata.

Symbols:

- `#`: solid arena boundary.
- `.`: walkable floor.
- `S`: player spawn.
- `B`: boss spawn.
- `E`: minion spawn.
- `C`: solid cover.
- `X`: exit marker, unlocked after boss defeat.

```text
###############################
#.............................#
#.S...........................#
#.............................#
#.............................#
#..............C..............#
#.....E.................E.....#
#.............................#
#.............................#
#.............................#
#.........C.........C.........#
#.............................#
#.............................#
#.............................#
#.............................#
#....E.........B.........E....#
#.............................#
#.............................#
#.............................#
#.............................#
#.........C.........C.........#
#.............................#
#.............................#
#.............................#
#.....E.................E.....#
#..............C..............#
#.............................#
#.............................#
#...........................X.#
#.............................#
###############################
```

Run `npm run validate:levels` before changing boss or foundation maps. The validator now checks every `src/game/*LevelMap.json` file by default and requires boss levels to include exactly one `B` marker plus a valid `boss` configuration.
