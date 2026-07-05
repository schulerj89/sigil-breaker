# Enemy Projectile Budget Notes

- Projectile rendering uses one shared sphere geometry and one shared additive material.
- Runtime meshes are pooled after hit, wall impact, or lifetime expiry.
- Collision remains tile and flat-segment based; no physics engine, mesh collision, or per-projectile material allocation was added.
- Debug fields added: `snapshot.enemies.projectiles.active`, `pooled`, `fired`, `hitPlayer`, `hitWall`, `shotsBlockedByWall`, and `list`.

