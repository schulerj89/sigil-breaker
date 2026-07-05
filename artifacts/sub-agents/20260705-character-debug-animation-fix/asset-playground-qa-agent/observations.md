# Asset Playground QA Agent: Character Animation Harness Fix

## What It Saw

- The staged Meshy character does not match the approved concept closely enough.
- The character was not generated from a single A-pose reference image, which is the required next pipeline.
- Existing animations are separate full GLBs per action, duplicating model payload.

## Decisions

- Treat the current character as a rejected placeholder for gameplay and title integration.
- Keep separate animation GLBs available for QA preview in the debug harness.
- Mark a single optimized multi-clip player GLB, or a lightweight animation-only clip bundle, as the runtime target.

## Caught Issues

- The prior pipeline let the model drift from the selected concept.
- The current animation asset shape is useful for inspection but inefficient for runtime.

## Next Handoff Notes

- Generate `selected-concept-a-pose.png` from the winning concept before any replacement Meshy model request.
- The approved replacement model should be rigged once, then all approved clips should share that skeleton.
