# Asset Credits

Sigilbreaker is intended to use the Kenney Sokoban asset pack for its initial visual style.

Kenney assets are available under the CC0 license. See Kenney's official asset pages for the source pack and current distribution details.

Place the downloaded Sokoban files under:

```text
public/assets/kenney/sokoban/
  Blocks/
  Crates/
  Environment/
  Enemies/
  Ground/
  Player/
```

The current code maps expected filenames in `src/assets/assetManifest.ts`. If your Kenney download uses different folder names or file names, update the manifest paths rather than changing game logic.

The game includes placeholder textures so missing local art assets do not prevent local development or tests from running.
