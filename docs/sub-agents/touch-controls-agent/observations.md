# Observations: touch-controls-agent

Status: complete after full-surface mobile zoom guard and hold-fire combat controls.

## What It Saw

- The FPS prototype has a left movement stick, right look zone, one fire button, and one right-thumb weapon cycle button.
- Fast repeated fire taps could trigger browser zoom on mobile-style input.
- Browser smoke at 844 x 390 kept `visualViewport.scale` at 1 after repeated fire clicks and a double-click path.
- The previous prevention was scoped mostly to UI controls, leaving full-canvas double taps, two-finger pinch movement, WebKit gesture events, and ctrl-wheel pinch emulation as possible page zoom paths.
- The fire button is now a reticle icon that acts on hold: immediate first shot, continued fire, camera zoom, and weapon-centering pose.
- The held fire button can also own a look pointer at reduced sensitivity so one right thumb can aim and fire.
- The smaller gun-icon weapon-cycle button sits beside the fire button; the bottom weapon tray remains removed.
- Browser smoke now asserts the reticle icon and weapon-cycle icon are visible, the bottom tray is absent, controls fit the viewport, and hold-fire state releases.

## Decisions

- Keep fire and weapon-select controls on pointerdown so they do not depend on delayed synthetic clicks.
- Prevent default on UI-control pointerup, click, double-click, and touchend paths to block double-tap zoom.
- Keep document/control CSS locked to non-selectable, no touch callout, and no tap highlight.
- Add a document/root zoom guard that prevents browser defaults for multi-touch starts/movement, double-tap endings, WebKit gesture events, and ctrl-wheel zoom without stopping propagation or taking over gameplay pointer IDs.
- Expose the zoom-guard counters and `visualViewport.scale` through the debug API for smoke QA.
- Keep active movement and look pointer IDs stable; later non-UI touches in those zones are ignored instead of overwriting the current pointer.
- Let the fire button participate in look only when no other look pointer is active.
- Keep fire-drag look sensitivity lower than the normal right-side look zone.
- Keep weapon switching on the dedicated cycle button beside fire so holding fire never changes weapons.

## Caught Issues

- The viewport metadata needed explicit `maximum-scale=1.0` and `minimum-scale=1.0` in addition to `user-scalable=no`.
- Full-surface look taps were not covered by the UI-control-only double-tap prevention path.
- Single-tap fire was too easy to spam and did not support the mobile FPS hold-to-aim pattern.

## Next Handoff Notes

- Continue testing simultaneous move, aim, and fire on physical mobile Safari/Chrome when available.
- Physical iOS Safari should specifically retry two-finger pinch while one finger is on the movement stick and another finger is in the look zone.
- Physical-device smoke should also hold the fire button, drag to track a target, release, and then switch weapons with the right-thumb cycle button.
