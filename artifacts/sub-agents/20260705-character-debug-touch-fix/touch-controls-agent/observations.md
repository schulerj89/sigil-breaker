# Touch Controls Agent: Character Debug Touch Fix

## What It Saw

- Gameplay `FpsControls` and `WeaponSystem` were still listening while the app was in `character-debug`.
- `WeaponSystem` prevented `click` and `touchend` for any `[data-ui-control]`, which can block native form controls on mobile.
- `FpsControls` could take root pointer capture when the user touched the right side of the character debug page outside an exact input target.

## Decisions

- Add input-enabled gates to `FpsControls` and `WeaponSystem`.
- Enable those gameplay input systems only during the `gameplay` phase.
- Add character-debug scene dragging so the camera can rotate/zoom from the open preview area.

## Caught Issues

- Existing smoke verified the debug page opened but did not prove touch input reached form controls.
- View/camera movement did not have a dedicated character-debug handler after the view slider was hidden for mobile space.

## Next Handoff Notes

- Keep gameplay input handlers phase-gated when future debug/title/reward screens are added.
- Do not prevent default for all `[data-ui-control]` outside gameplay.
