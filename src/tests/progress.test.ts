import { describe, expect, it } from 'vitest';
import { levelCatalog } from '../content/levelCatalog';
import {
  completeLevel,
  getContinueLevelIndex,
  loadProgress,
  PROGRESS_STORAGE_KEY,
  resetProgress,
  saveProgress,
  type StorageLike,
} from '../systems/progress';

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const levelIds = levelCatalog.map((entry) => entry.id);

describe('progress persistence', () => {
  it('loads default progress with only the first level unlocked', () => {
    const progress = loadProgress(new MemoryStorage(), levelIds);

    expect(progress.levels[levelIds[0]].unlocked).toBe(true);
    expect(progress.levels[levelIds[1]].unlocked).toBe(false);
  });

  it('saves and loads completed levels from storage', () => {
    const storage = new MemoryStorage();
    const progress = completeLevel(loadProgress(storage, levelIds), levelIds, levelIds[0], 5);

    saveProgress(storage, progress);
    const loaded = loadProgress(storage, levelIds);

    expect(storage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull();
    expect(loaded.levels[levelIds[0]].completed).toBe(true);
    expect(loaded.levels[levelIds[1]].unlocked).toBe(true);
  });

  it('keeps the best lower turn count for a level', () => {
    let progress = loadProgress(new MemoryStorage(), levelIds);

    progress = completeLevel(progress, levelIds, levelIds[0], 8);
    progress = completeLevel(progress, levelIds, levelIds[0], 11);
    progress = completeLevel(progress, levelIds, levelIds[0], 6);

    expect(progress.levels[levelIds[0]].bestTurns).toBe(6);
  });

  it('chooses the first unlocked incomplete level for continue', () => {
    let progress = loadProgress(new MemoryStorage(), levelIds);

    progress = completeLevel(progress, levelIds, levelIds[0], 4);

    expect(getContinueLevelIndex(progress, levelIds)).toBe(1);
  });

  it('resets progress and clears storage', () => {
    const storage = new MemoryStorage();
    let progress = completeLevel(loadProgress(storage, levelIds), levelIds, levelIds[0], 4);
    saveProgress(storage, progress);

    progress = resetProgress(storage, levelIds);

    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
    expect(progress.levels[levelIds[0]].unlocked).toBe(true);
    expect(progress.levels[levelIds[0]].completed).toBe(false);
    expect(progress.levels[levelIds[1]].unlocked).toBe(false);
  });
});
