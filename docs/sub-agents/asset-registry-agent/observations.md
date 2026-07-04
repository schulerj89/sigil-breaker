# Observations: asset-registry-agent

Status: complete for first weapon intake, environment texture intake, and runtime cache invalidation.

## What It Saw

- Added the first FPS external asset ledger at `docs/assets/source-ledger.json`.
- Added source-local metadata at `public/assets/weapons/kenney-blaster-kit/source.json`.
- Weapon runtime manifest lives in `src/game/weapons/weaponManifest.ts` for the three first-person test guns.
- Added an `assetBuild` query parameter helper for public asset URLs so GitHub Pages and dev browser caches do not keep stale weapon files.
- Wired the GLTF loading manager through the same helper so GLB-referenced texture URLs are cache-busted too.
- Added Kenney Prototype Textures as the first foundation environment texture source.
- Registered three environment texture assets for floor, wall, and roof surfaces.
- Moved the generic `publicAssetUrl`/`withAssetVersion` helper to `src/game/assetUrls.ts` so weapons and environment textures share cache invalidation.

## Decisions

- Use stable IDs: `weapon.blaster.spark`, `weapon.blaster.bore`, and `weapon.blaster.vault`.
- Assign all three to `level-01-weapons` for the first test-level preload.
- Keep path, byte size, and SHA-256 in source ledger until a fuller asset registry lands.
- Use the Vite-injected build id as the public asset cache key and keep hashed Vite bundle filenames for app code.
- Keep foundation environment textures in the `foundation-environment` load group until level-specific kits replace them.

## Caught Issues

- This is a minimal runtime manifest, not the final generalized asset registry.
- Cache invalidation is runtime query-based for public assets; future CDN rules should preserve query strings.
- `validate-assets` now supports texture assets without requiring weapon-style previews.
- `validate-assets` now checks `git ls-files --error-unmatch` so ledger files must be tracked, not just present on disk.
- Foundation texture records include matching `sourceSha256`, `optimizedSha256`, and `sha256` because the committed PNGs are unmodified source copies.

## Next Handoff Notes

- Gltf optimization and future streaming agents should use `docs/assets/source-ledger.json`, `src/game/assetUrls.ts`, plus relevant runtime manifests, and preserve the `assetBuild` query on any public asset URL.
