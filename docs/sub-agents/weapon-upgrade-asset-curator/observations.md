# Observations: weapon-upgrade-asset-curator

Status: complete for two-gun starting roster and weapon switch icon pass.

## What It Saw

- Integrated three first-person test weapons from Kenney Blaster Kit 2.1.
- Current roles are fast sidearm, close scatter, and heavy pulse.
- Each weapon has a preview thumbnail, distinct magazine size, cadence, recoil value, and ElevenLabs-generated gunshot profile.
- Reversed all three viewmodels back to yaw `0` after the user requested the guns face the other way.
- Added per-weapon range metadata and wall hit detection through the level map.
- Public weapon asset paths now flow through the asset registry cache-busting helper.
- Shifted all three first-person view offsets farther right so the active gun sits less over the bottom-center weapon choices.
- Added manifest-derived weapon clearance for viewmodel wall avoidance and debug weapon-footprint checks.
- Shifted tracer origin to follow the right-offset weapon presentation.
- Added `weaponViewPose.ts` so muzzle flash, tracer start, tracer endpoint, and wall impact positions are derived from one camera-local weapon pose helper.
- The pose helper includes view offset, scale, view rotation, recoil, and wall-avoidance retraction/lowering.
- `WeaponSystemSnapshot.effectPose` now exposes rounded shot-effect positions for browser QA and future sub-agent checks.
- Added per-weapon `view.muzzleLocalOffset` anchors so SPARK, BORE, and VAULT no longer share one muzzle/tracer start point.
- Lowered BORE and VAULT first-person view positions to account for their larger/different silhouettes while keeping SPARK's existing framing.
- Shot feedback now converts flat X/Z wall raycast distance into camera-space distance so pitched shots still end at the reticle.
- Moved the muzzle flash under the camera-local shot feedback root so it uses the same `getWeaponShotEffectPositions` muzzle as the tracer and debug `effectPose`.
- Replaced procedural firing sounds with cache-busted ElevenLabs MP3 assets mapped by weapon sound profile.
- Retuned SPARK, BORE, and VAULT muzzle anchors closer to the visible GLB muzzle fronts.
- Replaced the asymmetric cone flash with a centered camera-facing disk so the burst reads as centered on the manifest muzzle anchor.
- BORE and VAULT muzzle anchors were moved up and left relative to their models after visual review.
- SPARK, BORE, and VAULT now carry per-weapon muzzle flash, tracer, and wall-impact colors plus scale/timing values in the manifest.
- `WeaponSystemSnapshot.effectStyle` exposes the active effect colors so smoke QA can validate them without timing a one-frame flash screenshot.
- The old bottom weapon preview tray is gone; switching now happens through `[data-weapon-cycle-button]`.
- Screenshot QA for this pass lives under `artifacts/sub-agents/20260704-weapon-cycle-burst/smoke-qa-agent/`.
- Added two more Kenney Blaster Kit weapons from the same CC0 source: RIFT (`blaster-q.glb`) and TORCH (`blaster-m.glb`).
- Current weapon roster is SPARK fast sidearm, BORE close scatter, VAULT heavy pulse, RIFT precision rail, and TORCH burst carbine.
- `WeaponSystemSnapshot.activeWeaponStats` now exposes damage, fire interval, reload, and range for the active gun.
- RIFT uses green shot effects and high damage with slow cadence; TORCH uses red-pink effects and low damage with very fast cadence.
- The runtime starting roster is now SPARK and BORE only; VAULT, RIFT, and TORCH remain defined assets for future unlock/progression work.
- Boot weapon model preloading now requests only SPARK and BORE, reducing starting weapon model payload while preserving the full manifest.
- `WeaponSystemSnapshot.weaponIds` now reports the currently available starting weapons, not every registered weapon definition.
- SPARK now uses a pooled cyan cylinder bolt projectile so it reads as a fast sidearm instead of a thin WebGL line.
- BORE now uses a pooled orange sphere projectile so its slower, heavier cadence reads differently from SPARK.
- `WeaponSystemSnapshot.effectStyle.projectile` exposes shape, radius, length, opacity, and travel ratio for deterministic smoke QA.

## Decisions

- Use SPARK and BORE for the starting cycle button and shoot-loop smoke tests.
- Delay upgrade visuals until powerups and weapon progression are implemented.
- Treat current yaw `0` and right-shifted model offsets as prototype framing values pending camera/game-feel review.
- Use temporary primitive tracer and impact feedback until external projectile/hit assets are sourced.
- Derive viewmodel wall clearance from the current weapon manifest so later offset changes do not desync wall retraction.
- Derive visible muzzle flash, tracer start, tracer endpoint, and wall impact from `getWeaponShotEffectPositions` so later viewmodel movement cannot desync firing feedback.
- Keep `muzzleLocalOffset` in the weapon manifest next to each view pose; do not move shape-specific muzzle tuning back into a shared constant.
- Treat `weaponShotMath.ts` as the pitch correction boundary between flat level raycasts and camera-local tracer rendering.
- Use a centered flash primitive until an external muzzle-flash VFX asset is sourced.
- Keep the per-weapon effect style in `WeaponDefinition.effects` so later external VFX replacement has a clear style target per weapon.
- Keep weapon switching on the single mobile cycle button until a larger inventory UI exists.
- Keep the starting mobile cycle order SPARK, BORE until progression or pickups unlock later weapons.
- Keep VAULT, RIFT, and TORCH in `WEAPON_DEFINITIONS` so future progression can opt them into availability without recreating asset records.
- Use pooled mesh projectile primitives for MVP readability because mobile WebGL line width is unreliable across devices.

## Caught Issues

- The models are not authored specifically as hands/viewmodels, so first-person orientation and framing may need iteration.
- Wall collision is level-tile based, not a final projectile or enemy hit system.
- Wall avoidance is a retraction/probe layer, not full mesh-vs-level collision for every weapon triangle.
- The current muzzle flash, tracer, and wall impact are still procedural primitives; they should be replaced with external VFX assets once the source is chosen.
- The primitive tracer is brief in still screenshots, so debug `effectPose` remains the more reliable automated alignment signal.
- The colored flash is easier to center as a disk, but it is still a placeholder and should not become the final VFX asset.
- Procedural color/style variants make the registered guns easier to distinguish, but final muzzle/tracer/impact art still needs external assets.
- RIFT and TORCH share the same viewmodel assumptions as the first three weapons; their exact muzzle/framing should get screenshot QA before final tuning.
- Future unlock code needs an explicit available-weapon inventory rather than reading every `WEAPON_DEFINITIONS` entry as currently usable.
- Projectile meshes are still procedural placeholders; final projectile VFX should come from external assets or particle textures.

## Next Handoff Notes

- Camera and game-feel agents should review yaw `0`, right-offset model placement, wall retraction, muzzle flash placement, tracer readability, and SFX cadence in landscape phone view.
- Screenshot QA captures for this pass live under `artifacts/sub-agents/20260704-weapon-framing/smoke-qa-agent/`.
- Latest weapon-cycle and flash alignment screenshots live under `artifacts/sub-agents/20260704-weapon-cycle-burst/smoke-qa-agent/`.
- Future screenshot QA should capture SPARK cyan, BORE orange, and VAULT violet shot effects from deterministic fire frames.
- Future screenshot QA should also capture RIFT green and TORCH red-pink shot effects.
- Smoke QA should use `snapshot.weapon.effectStyle` as the deterministic gate until flash-frame captures are stable.
- Smoke QA should verify the starting cycle loops SPARK -> BORE -> SPARK and that locked weapon GLBs are not requested during boot.
- Smoke QA should assert SPARK `effectStyle.projectile.shape` is `bolt` and BORE is `orb`.
