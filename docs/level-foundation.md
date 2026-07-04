# Foundation Level

The first playable FPS foundation level is a 20 x 20 unit map. Each character is one square meter in gameplay space.

## Legend

- `#`: wall or boundary collision.
- `.`: walkable floor.
- `S`: player spawn.
- `C`: low cover collision.
- `E`: endpoint marker.

## Map

```text
####################
#S....#...........E#
#.##..#..####..##..#
#......C.#..#......#
####.#####..#.####.#
#....#......#......#
#.##.#.######.####.#
#.#..#......#....#.#
#.#.######..####.#.#
#.#..............#.#
#.####.####C####.#.#
#......#......#..#.#
#.######.####.#.##.#
#........#....#....#
#.####...#.######..#
#....#...#......#..#
####.#.######...#.##
#....#........C....#
#........####......#
####################
```

The runtime builds the bare placeholder level from this map in `src/game/levelMap.ts`. Collision also reads from the same map so visual walls, boundaries, and cover stay aligned with movement.

