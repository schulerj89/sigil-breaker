# Meshy Asset Pipeline Agent - Main Character

Status: complete

## What It Saw

- Official Meshy docs support text-to-3D preview/refine, rigging, and animation tasks for humanoid GLBs.
- The runner used the local `agent-secret` broker with `MESHY_API_KEY`; no secret values were printed or stored.
- Meshy generated one preview GLB, one refined textured GLB, one rigged GLB, walking/running GLBs, and eight requested action animation GLBs.
- Sanitized task metadata is stored under `tools/meshy/generated/meshy-gadget-gremlin/`.

## Decisions

- Use `meshy-6`, `a-pose`, remesh enabled, 45000 target polycount, PBR textures, no HD texture, and 1.45 meter height.
- Store generated GLBs under `public/assets/characters/meshy-gadget-gremlin/` for future runtime staging, but do not wire them into gameplay yet.
- Treat this as a high-detail source candidate because the output exceeds runtime byte and triangle targets.

## Caught Issues

- Meshy animation exports duplicate the full mesh in each animation GLB, making the source animation pack too large for direct gameplay loading.
- The generated model landed at 81627 rendered triangles, above the 45000 target.
