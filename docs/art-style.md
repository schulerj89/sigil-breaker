# Art Style

Sigilbreaker currently uses first-class placeholder art: flat colored tiles with strong contrast for walls, floors, crates, red plates, red doors, exits, and the player. The placeholder set is intentionally readable and should remain playable even when no external assets are installed.

The intended near-term art direction is Kenney Sokoban: clean, CC0 tile art that matches the grid puzzle rules. Place the pack manually under `public/assets/kenney/sokoban/` and update `src/assets/assetManifest.ts` if the downloaded filenames differ from the expected paths.

Future art should preserve readability before detail. Doors need distinct open and closed states, pressure plates must remain visible under adjacent motion, crates need to stand out from walls, and the exit should be recognizable at a glance on mobile screens.
