# Gates

These gates apply to future Three.js FPS work. A sub-agent may recommend a change, but the coordinator should block integration when a relevant gate fails.

## Repository Gates

- `npm test`
- `npm run lint`
- `npm run build`

## Asset Gates

- Source URL, author, license, and redistribution status are recorded.
- License text or source snapshot is stored with the asset record.
- Asset has a stable ID, source hash, optimized hash, and load group.
- GLB/GLTF assets pass asset-playground scale, animation, material, and mobile framing checks.
- Collision proxy is separate from render mesh.
- Repeated props are cloned or instanced from one loaded asset.

## Performance Gates

- Visible browser targets 60 FPS in landscape mobile QA.
- Initial level payload stays under 40 MB until streaming exists.
- Gameplay scene starts under 90 draw calls, 250,000 triangles, 100 geometries, and 64 textures unless the performance-budget agent approves a measured exception.
- Headless tests assert debug metrics and budget regressions, not final visible FPS.
- Blank canvas, asset load errors, and renderer metric failures block the slice.

## Memory Gates

- Removing an object from the scene is not considered disposal.
- Scene transitions dispose owned `BufferGeometry`, `Material`, and `Texture` resources.
- Shared resources have an owner or reference counting.
- Five reset loops must not grow texture or geometry counts.
- Heap growth above 5% after reset-loop QA requires review.

## Mobile Gates

- Landscape-only experience with a portrait rotate prompt.
- Test viewports include `667x375`, `740x360`, `844x390`, `932x430`, and tablet landscape.
- No HUD, title, or controls under notches, home indicators, or thumb zones.
- Touch controls support simultaneous move, aim, and fire with stable pointer IDs.
- No hover-only interaction.

## QA Gates

- Smoke QA verifies boot, nonblank canvas, debug API, scene state, no console errors, no network asset failures, and HUD fit.
- Screenshot QA captures stable named poses with renderer/FPS overlay visible when possible.
- Playthrough QA covers start, movement, aiming, shooting, reload, damage, pause/resume, objective completion, powerup choice, and transition.
- Any unrecoverable input lock, broken death/retry state, cutscene input loss, offscreen control, or unreadable reward choice blocks the slice.

