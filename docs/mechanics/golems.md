# Sleepy Golems

Sleepy golems are deterministic puzzle objects. They are not random enemies and they do not act on timers.

Rules:

- `G` in a level map creates a sleepy golem.
- Golems move only after the player completes a successful turn.
- If the player bumps a wall, closed door, crate that cannot move, or golem, no turn is spent and golems do not move.
- Each golem tries to move one tile closer to the player by Manhattan distance.
- Tie-break order is always up, right, down, left.
- Golems cannot enter walls, closed doors, crates, other golems, exits, or outside the map.
- Golems can stand on pressure plates.
- A red door opens when at least one crate or golem stands on any red pressure plate.
- If a golem enters the player's tile, the level enters a caught state.

Caught state:

Sigilbreaker keeps caught state explicit instead of immediately restarting. This makes the consequence clear and lets undo remain useful. From caught state, the player can press `Z` or Backspace to undo, or `R` to restart.

Examples:

- A golem two tiles below the player will move up after the player takes a valid step.
- A golem beside a crate will not move through that crate even if the crate is between it and the player.
- A golem lured onto a red pressure plate can hold a door open while the player walks through.
- A trapped golem can become a stable part of the room layout, like a crate that moves only when lured.

Preview:

Press `Tab` in game to toggle golem preview markers. The preview shows each golem's next deterministic step from the current board state.
