# Asset Credits

Sigilbreaker is intended to use the Kenney Sokoban asset pack for its initial visual style.

Kenney assets are available under the CC0 license. See Kenney's official asset pages for the source pack and current distribution details.

Place the downloaded Sokoban files under:

```text
public/assets/kenney/sokoban/
  Blocks/
    block_01.png
  Crates/
    crate_01.png
  Environment/
    environment_04.png
    environment_06.png
    environment_15.png
    environment_16.png
  Ground/
    ground_01.png
  Player/
    player_05.png
  Enemies/
    sleepy_golem.png
  License.txt
```

`Enemies/sleepy_golem.png` is an optional future custom sprite path. The Kenney Sokoban pack does not include a dedicated golem enemy, so the game generates a stone golem texture when this file is absent.

The current code maps expected filenames in `src/assets/assetManifest.ts`. If your Kenney download uses different folder names or file names, update the manifest paths rather than changing game logic.

Current mapping:

- `ground_01.png`: floor
- `block_01.png`: wall
- `crate_01.png`: crate
- `player_05.png`: player
- `Enemies/sleepy_golem.png`: optional custom sleepy golem sprite
- `environment_04.png`: red pressure plate
- `environment_15.png`: closed red door stand-in
- `environment_16.png`: open red door stand-in
- `environment_06.png`: exit stand-in

The game includes placeholder textures so missing local art assets do not prevent local development or tests from running.
