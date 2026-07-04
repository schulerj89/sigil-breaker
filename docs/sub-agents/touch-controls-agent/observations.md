# Observations: touch-controls-agent

Status: in progress after fire-button zoom fix.

## What It Saw

- The FPS prototype has a left movement stick, right look zone, weapon tray, and one fire button.
- Fast repeated fire taps could trigger browser zoom on mobile-style input.
- Browser smoke at 844 x 390 kept `visualViewport.scale` at 1 after repeated fire clicks and a double-click path.

## Decisions

- Keep fire and weapon-select controls on pointerdown so they do not depend on delayed synthetic clicks.
- Prevent default on UI-control pointerup, click, double-click, and touchend paths to block double-tap zoom.
- Keep document/control CSS locked to non-selectable, no touch callout, and no tap highlight.

## Caught Issues

- The viewport metadata needed explicit `maximum-scale=1.0` and `minimum-scale=1.0` in addition to `user-scalable=no`.

## Next Handoff Notes

- Continue testing simultaneous move, aim, and fire on physical mobile Safari/Chrome when available.
