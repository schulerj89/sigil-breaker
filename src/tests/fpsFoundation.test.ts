import { describe, expect, it } from 'vitest';
import { DEBUG_SCENE_ID, MOBILE_VIEWPORTS, PERFORMANCE_BUDGETS } from '../game/config';

describe('FPS foundation config', () => {
  it('keeps the bootstrap scene aligned with the mobile landscape gates', () => {
    expect(DEBUG_SCENE_ID).toBe('fps-foundation');
    expect(PERFORMANCE_BUDGETS.targetFps).toBe(60);
    expect(PERFORMANCE_BUDGETS.drawCallsMax).toBeLessThanOrEqual(90);
    expect(PERFORMANCE_BUDGETS.trianglesMax).toBeLessThanOrEqual(250_000);
    expect(PERFORMANCE_BUDGETS.initialScenePayloadMbMax).toBeLessThanOrEqual(40);
  });

  it('tracks the required mobile landscape viewport set', () => {
    const viewportNames = MOBILE_VIEWPORTS.map((viewport) => viewport.name);

    expect(viewportNames).toEqual([
      'small-phone-landscape',
      'wide-phone-landscape',
      'modern-phone-landscape',
      'large-phone-landscape',
      'tablet-landscape',
    ]);
  });
});

