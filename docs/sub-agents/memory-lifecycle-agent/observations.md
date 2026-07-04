# Observations: memory-lifecycle-agent

Status: in progress after first weapon intake.

## What It Saw

- The repo now uses `GLTFLoader` for three first-person weapon models.
- `WeaponSystem.dispose()` removes event listeners, closes the audio context, removes the viewmodel root, and disposes loaded model meshes/materials/textures.
- Detached loaded weapon models are explicitly disposed during teardown rather than relying only on the currently attached scene graph.

## Decisions

- Keep loaded weapon ownership inside `WeaponSystem` for now.
- Run reset-loop QA before adding larger weapon sets, enemies, or level-kit GLBs.

## Caught Issues

- No automated reset-loop memory test exists yet.
- Shared GLB texture dependencies are present; future shared resource handling may need reference counting if assets are split across systems.

## Next Handoff Notes

- Next lifecycle pass should automate repeated create/dispose cycles and assert geometry/texture counts return to baseline.
