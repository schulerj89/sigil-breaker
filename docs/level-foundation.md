# Foundation Level

The first playable FPS foundation level is a 45 x 45 unit map. Each character is one square meter in gameplay space. Traversal lanes are authored and validated with at least three units of open space so mobile movement has room to breathe around walls and cover. Structural wall-band entries are validated separately at five units so the player and right-handed weapon footprint do not snag on door-like breaks.

The source of truth is `src/game/foundationLevelMap.json`. Runtime collision reads the same map, and the rendering path partitions it into 9 x 9 tile chunks so future external assets can load by area instead of as one monolithic level.

## Legend

- `#`: wall or boundary collision.
- `.`: walkable floor.
- `S`: player spawn.
- `C`: low cover collision.
- `E`: endpoint marker.

## Map

```text
#############################################
#S....................#....................E#
#.....................#.....................#
#.....................#.....................#
#...........................................#
#....C..............................C.......#
#...........................................#
#...........................................#
#...........................................#
#.....................#.....................#
################.....########################
#.........#......................#..........#
#.........#......................#..........#
#.........#......................#..........#
#.........#......................#..........#
#....C....#...........C..........#.....C....#
#.........#......................#..........#
#.........#......................#..........#
#.........#......................#..........#
#.........#......................#..........#
#####.....##################.....############
#.................#................#........#
#.................#................#........#
#.................#................#........#
#.................#................#........#
#.......C.........#........C.......#...C....#
#.................#................#........#
#.................#................#........#
#.................#................#........#
#.................#................#........#
################.......#############.....####
#..........#.................#..............#
#..........#.................#..............#
#..........#.................#..............#
#..........#.................#..............#
#..........#.......C.........#.......C......#
#..........#.................#..............#
#..........#.................#..............#
#..........#.................#..............#
#########.....#############.....#############
#...........................................#
#...........................................#
#...........................................#
#...........................................#
#############################################
```

Run `npm run validate:levels` before changing this map. The checker fails unsupported symbols, broken boundaries, multiple spawn or exit tiles, unreachable exits, any walkable tile that falls below the configured 3-unit lane width in either axis, structural wall-band entries below 5 units, diagonal corner cuts, and one-tile corner pinches.
