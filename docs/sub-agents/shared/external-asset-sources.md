# External Asset Sources

Sub-agents should prefer sources with simple redistribution terms, stable author metadata, and downloadable files that can be cached in the project with license evidence.

## Preferred Starting Points

- Kenney: 2D, 3D, UI, input prompts, and audio packs. Kenney support states asset-page game assets are CC0 and usable commercially.
- Quaternius: low-poly 3D packs. The FAQ states models are CC0 and attribution is not required.
- Poly Haven: HDRIs, textures, and 3D models. The license page states assets are CC0.
- ambientCG: PBR materials, HDRIs, and models. The license docs state assets are CC0.
- Game-icons.net: large icon library for upgrades and HUD concepts. It uses Creative Commons Attribution 3.0, so credits are required.

## Mixed-License Sources

- OpenGameArt: useful for 2D, 3D, music, and SFX, but each asset can have different license obligations.
- Freesound: useful for SFX, but sounds can be CC0, attribution, or attribution-noncommercial. Avoid noncommercial audio for shippable game builds.
- Pixabay: useful for music, images, and SFX, but prohibited-use rules still apply and recognizable brands/people need extra caution.
- Sketchfab: useful for downloadable 3D models, but licenses vary and editorial/standard restrictions can block commercial game use or redistribution.
- itch.io free asset packs: useful discovery source, but free price is not a license. Check each pack page and included license file.

## Rejection Rules

- Reject ripped assets from commercial games, films, stores, or fan packs.
- Reject noncommercial, editorial-only, unclear, missing, or contradictory licenses.
- Reject assets that cannot be redistributed in a web build or stored in the repo/artifact cache.
- Reject assets with brand, character, celebrity, weapon-manufacturer, or trademark risk unless the license-provenance curator explicitly approves them.
- Reject assets without an author/source URL unless they are generated internally and the generation metadata is recorded.

## Required Source Record

Each candidate must record:

- Source name and URL.
- Author or uploader.
- License name and license URL.
- Download date.
- Commercial-use status.
- Redistribution status.
- Attribution requirement.
- Modification permission.
- Source file hash.
- Optimized file hash after processing.
- Notes on brand, character, model-release, music, SFX, and AI-generation risk.

