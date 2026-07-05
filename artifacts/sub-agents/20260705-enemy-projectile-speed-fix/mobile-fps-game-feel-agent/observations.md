# Enemy Projectile And Speed Feel Notes

- Problem observed: spawn-staggered projectile cooldowns could make newly tracking enemies feel like they were not shooting.
- Fix: when an enemy first enters tracking, its projectile cooldown clamps to 0.08 seconds.
- Enemy movement speed increased by 25%:
  - Mushnub: 1.28 -> 1.6 units/second.
  - Pink slime: 1.42 -> 1.775 units/second.
  - Goleling: 1.02 -> 1.275 units/second.
- Projectile readability was improved by increasing the pooled orb radius from 0.13 to 0.2 and disabling depth testing for the temporary additive projectile visual.

