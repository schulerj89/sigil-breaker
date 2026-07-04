# Observations: asset-registry-agent

Status: complete for first weapon intake and runtime cache invalidation.

## What It Saw

- Added the first FPS external asset ledger at `docs/assets/source-ledger.json`.
- Added source-local metadata at `public/assets/weapons/kenney-blaster-kit/source.json`.
- Weapon runtime manifest lives in `src/game/weapons/weaponManifest.ts` for the three first-person test guns.
- Added an `assetBuild` query parameter helper for public asset URLs so GitHub Pages and dev browser caches do not keep stale weapon files.
- Wired the GLTF loading manager through the same helper so GLB-referenced texture URLs are cache-busted too.

## Decisions

- Use stable IDs: `weapon.blaster.spark`, `weapon.blaster.bore`, and `weapon.blaster.vault`.
- Assign all three to `level-01-weapons` for the first test-level preload.
- Keep path, byte size, and SHA-256 in source ledger until a fuller asset registry lands.
- Use the Vite-injected build id as the public asset cache key and keep hashed Vite bundle filenames for app code.

## Caught Issues

- This is a minimal runtime manifest, not the final generalized asset registry.
- Cache invalidation is runtime query-based for public assets; future CDN rules should preserve query strings.

## Next Handoff Notes

- Gltf optimization and future streaming agents should use `docs/assets/source-ledger.json` plus `src/game/weapons/weaponManifest.ts`, and preserve the `assetBuild` query on any public asset URL.
