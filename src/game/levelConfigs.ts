import bossLevelData from './bossLevelMap.json';
import foundationLevelData from './foundationLevelMap.json';

export const LEVEL_CONFIGS = [foundationLevelData, bossLevelData] as const;
export const FOUNDATION_LEVEL_CONFIG = foundationLevelData;
export const BOSS_LEVEL_CONFIG = bossLevelData;
