export const GAME_TITLE = 'Sigilbreaker';

export const DEBUG_SCENE_ID = 'fps-foundation';

export const MOBILE_VIEWPORTS = [
  { name: 'small-phone-landscape', width: 667, height: 375 },
  { name: 'wide-phone-landscape', width: 740, height: 360 },
  { name: 'modern-phone-landscape', width: 844, height: 390 },
  { name: 'large-phone-landscape', width: 932, height: 430 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
] as const;

export const PERFORMANCE_BUDGETS = {
  targetFps: 60,
  maxDevicePixelRatio: 2,
  drawCallsMax: 90,
  trianglesMax: 250_000,
  geometriesMax: 100,
  texturesMax: 64,
  initialScenePayloadMbMax: 40,
} as const;

export type CameraMode = 'title' | 'gameplay' | 'aim' | 'sprint' | 'hit' | 'death' | 'cinematic';

