export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LevelProgress {
  unlocked: boolean;
  completed: boolean;
  bestTurns?: number;
}

export interface ProgressState {
  levels: Record<string, LevelProgress>;
}

export const PROGRESS_STORAGE_KEY = 'sigilbreaker.progress.v1';

export function loadProgress(storage: StorageLike | undefined, levelIds: string[]): ProgressState {
  const fallback = createDefaultProgress(levelIds);
  if (!storage) {
    return fallback;
  }

  const raw = storage.getItem(PROGRESS_STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as ProgressState;
    return normalizeProgress(parsed, levelIds);
  } catch {
    return fallback;
  }
}

export function saveProgress(storage: StorageLike | undefined, progress: ProgressState): void {
  storage?.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}

export function resetProgress(storage: StorageLike | undefined, levelIds: string[]): ProgressState {
  storage?.removeItem(PROGRESS_STORAGE_KEY);
  return createDefaultProgress(levelIds);
}

export function completeLevel(
  progress: ProgressState,
  levelIds: string[],
  completedLevelId: string,
  turnCount: number,
): ProgressState {
  const nextProgress = normalizeProgress(progress, levelIds);
  const levelIndex = levelIds.indexOf(completedLevelId);
  if (levelIndex === -1) {
    return nextProgress;
  }

  const current = nextProgress.levels[completedLevelId];
  nextProgress.levels[completedLevelId] = {
    unlocked: true,
    completed: true,
    bestTurns:
      current.bestTurns === undefined ? turnCount : Math.min(current.bestTurns, turnCount),
  };

  const nextLevelId = levelIds[levelIndex + 1];
  if (nextLevelId) {
    nextProgress.levels[nextLevelId] = {
      ...nextProgress.levels[nextLevelId],
      unlocked: true,
    };
  }

  return nextProgress;
}

export function getHighestUnlockedIndex(progress: ProgressState, levelIds: string[]): number {
  let highestIndex = 0;

  levelIds.forEach((levelId, index) => {
    if (progress.levels[levelId]?.unlocked) {
      highestIndex = index;
    }
  });

  return highestIndex;
}

export function getContinueLevelIndex(progress: ProgressState, levelIds: string[]): number {
  const firstIncomplete = levelIds.findIndex(
    (levelId) => progress.levels[levelId]?.unlocked && !progress.levels[levelId]?.completed,
  );

  return firstIncomplete === -1 ? getHighestUnlockedIndex(progress, levelIds) : firstIncomplete;
}

function createDefaultProgress(levelIds: string[]): ProgressState {
  return {
    levels: Object.fromEntries(
      levelIds.map((levelId, index) => [
        levelId,
        {
          unlocked: index === 0,
          completed: false,
        },
      ]),
    ),
  };
}

function normalizeProgress(progress: ProgressState | undefined, levelIds: string[]): ProgressState {
  const fallback = createDefaultProgress(levelIds);

  for (const levelId of levelIds) {
    const existing = progress?.levels?.[levelId];
    if (!existing) {
      continue;
    }

    fallback.levels[levelId] = {
      unlocked: Boolean(existing.unlocked),
      completed: Boolean(existing.completed),
      bestTurns:
        typeof existing.bestTurns === 'number' && Number.isFinite(existing.bestTurns)
          ? existing.bestTurns
          : undefined,
    };
  }

  fallback.levels[levelIds[0]] = {
    ...fallback.levels[levelIds[0]],
    unlocked: true,
  };

  return fallback;
}
