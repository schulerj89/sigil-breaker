# Smoke QA Agent: Character Debug Touch Regression

## What It Saw

- The focused mobile smoke now checks that character debug UI events are not default-prevented.
- The smoke also drags the character-debug scene and verifies camera yaw changes.
- A headed real-touch probe moved the RightHand X slider from 0 to 108 and camera yaw from 0 to 45.

## Decisions

- Keep smoke coverage on event default prevention because native mobile select/range controls are sensitive to global event handlers.
- Use headed touch QA when debugging mobile form controls; headless reachability alone is not enough.

## Caught Issues

- Previous smoke tests allowed a page where controls existed visually but were effectively blocked on phone.

## Next Handoff Notes

- Future title/debug overlays should add event default-prevention checks when they contain native form controls.
