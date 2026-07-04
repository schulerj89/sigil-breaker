# Observations: touch-controls-agent

Status: complete after full-surface mobile zoom guard.

## What It Saw

- The FPS prototype has a left movement stick, right look zone, weapon tray, and one fire button.
- Fast repeated fire taps could trigger browser zoom on mobile-style input.
- Browser smoke at 844 x 390 kept `visualViewport.scale` at 1 after repeated fire clicks and a double-click path.
- The previous prevention was scoped mostly to UI controls, leaving full-canvas double taps, two-finger pinch movement, WebKit gesture events, and ctrl-wheel pinch emulation as possible page zoom paths.

## Decisions

- Keep fire and weapon-select controls on pointerdown so they do not depend on delayed synthetic clicks.
- Prevent default on UI-control pointerup, click, double-click, and touchend paths to block double-tap zoom.
- Keep document/control CSS locked to non-selectable, no touch callout, and no tap highlight.
- Add a document/root zoom guard that prevents browser defaults for multi-touch starts/movement, double-tap endings, WebKit gesture events, and ctrl-wheel zoom without stopping propagation or taking over gameplay pointer IDs.
- Expose the zoom-guard counters and `visualViewport.scale` through the debug API for smoke QA.
- Keep active movement and look pointer IDs stable; later non-UI touches in those zones are ignored instead of overwriting the current pointer.

## Caught Issues

- The viewport metadata needed explicit `maximum-scale=1.0` and `minimum-scale=1.0` in addition to `user-scalable=no`.
- Full-surface look taps were not covered by the UI-control-only double-tap prevention path.

## Next Handoff Notes

- Continue testing simultaneous move, aim, and fire on physical mobile Safari/Chrome when available.
- Physical iOS Safari should specifically retry two-finger pinch while one finger is on the movement stick and another finger is in the look zone.
