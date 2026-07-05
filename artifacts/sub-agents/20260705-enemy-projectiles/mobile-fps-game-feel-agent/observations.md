# Enemy Projectile Feel Notes

- Tracking enemies fire energy-orb projectiles only when the player is inside range and line of sight.
- First-pass damage is intentionally low: Mushnub 7, Slime 6, Goleling 10.
- Cooldowns are staggered by map position so enemies in the same room do not all fire on the same frame.
- Hits route through the existing player `Health` class so the HP bar remains the single player-health source of truth.

