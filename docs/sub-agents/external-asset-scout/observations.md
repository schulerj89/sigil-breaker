# Observations: external-asset-scout

Status: complete for first weapon intake.

## What It Saw

- Reviewed first free weapon candidates for a mobile-first Three.js FPS test level.
- Selected Kenney Blaster Kit 2.1 as the first intake because the official source lists Creative Commons CC0 and provides GLB files plus previews.
- Deferred Quaternius/Poly Pizza Ultimate Guns Pack as a future larger gun library candidate.

## Decisions

- Use Kenney Blaster Kit 2.1 for the first three test-level guns.
- Import only three selected GLB files and previews to keep the initial payload small.
- Keep additional gun packs out of the repo until the level theme and weapon roster need them.

## Caught Issues

- The selected kit is stylized sci-fi, so future ballistic or grounded weapons may need a separate asset source.

## Next Handoff Notes

- Read `docs/assets/source-ledger.json` before adding more weapon sources.
- Next source scout pass should look for level-specific enemies and buildings, not more generic guns.
- Main-character scout found KayKit and Quaternius as the best CC0 animation/fallback sources, but no free asset matched the requested distinctive playful mascot well enough to ship unchanged.
- Meshy/custom generation is justified for the lead mascot identity; free sources should remain fallback animation/retargeting references.
