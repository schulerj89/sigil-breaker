# Asset Loading

Sigilbreaker expects optional Kenney Sokoban art under:

```text
public/assets/kenney/sokoban/
```

Runtime loading is manifest-driven in `src/assets/assetManifest.ts`. Each manifest entry maps one game texture key, such as `tile.wall` or `entity.crate`, to one expected local file path and one placeholder color.

`BootScene` probes each manifest path before loading it. Files that exist are loaded as Phaser textures. Files that are missing are replaced with generated placeholder textures, so the game remains playable, testable, and deployable with no binary art assets committed.

When manually adding the Kenney pack, keep the folder structure documented in `docs/asset-credits.md`. If the downloaded pack uses different filenames, update only `assetManifest.ts`.
