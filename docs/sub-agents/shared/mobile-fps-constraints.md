# Mobile FPS Constraints

The primary platform is phone landscape. Agents should evaluate decisions against these constraints before recommending implementation.

## Viewports

Test these CSS viewport sizes:

- `667x375`
- `740x360`
- `844x390`
- `932x430`
- Tablet landscape

## Controls

- Left thumb zone owns movement.
- Right thumb zone owns look/aim.
- Buttons should support fire, reload, jump or dodge, interact, weapon swap, ability, and pause when the active slice needs them.
- Move, aim, and fire must work simultaneously through stable pointer IDs.
- Controls must avoid notches, rounded corners, browser bars, and home indicators through safe-area handling.

## HUD

- Crosshair, health, shield, ammo, objective, powerup choice, and pause must not overlap thumb controls.
- Text must fit its container without relying on viewport-scaled font sizes.
- Reward choices need short labels, readable stat deltas, and a clear selected state.
- Portrait should show only a rotate prompt and essential loading/error state.

## Feel

- Touch input latency target is under 50 ms.
- Frame budget is 16.7 ms for visible 60 FPS.
- Camera shake, recoil, sprint bob, and hit effects must be readable without causing motion sickness.
- Combat feedback should use coordinated visual, audio, haptic-ready, and HUD signals.

