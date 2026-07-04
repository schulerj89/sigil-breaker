# Observations: smoke-qa-agent

Status: not run for implementation yet.

## What It Saw

- Initial scaffold pass only.
- Current repo has Vitest tests but no future Playwright smoke route.
- Three.js FPS smoke testing needs debug hooks and mobile landscape screenshots.

## Decisions

- Smoke QA should be fast and block obvious broken builds.
- Full playthrough QA remains separate.

## Caught Issues

- No browser smoke tests exist for the future FPS rewrite.

## Next Handoff Notes

- Add smoke tests after the first Three.js boot canvas and debug API exist.

