# Landscape Title HUD Agent: Character Debug Usability Fix

## What It Saw

- Rendering all controlled bones at once made the sliders hard to find on mobile landscape.
- The user needs an obvious way to pick an animation and one editable bone.

## Decisions

- Add an animation dropdown to the title-accessible character debug page.
- Add a bone dropdown and show only the selected bone's X/Y/Z sliders.
- Keep the same landscape-only rotate prompt and debug page phase.

## Caught Issues

- The previous smoke only checked that the page opened, not that pose controls were usable.

## Next Handoff Notes

- Smoke QA should assert animation dropdown, bone dropdown, selected-bone panel, and three visible range sliders.
