export interface HealthSnapshot {
  current: number;
  max: number;
  ratio: number;
  isAlive: boolean;
}

export type HealthChangeReason = 'damage' | 'heal' | 'reset' | 'set-max';

export interface HealthChange {
  previous: HealthSnapshot;
  current: HealthSnapshot;
  reason: HealthChangeReason;
}

export type HealthChangeListener = (change: HealthChange) => void;

export class Health {
  private currentHealth: number;
  private maxHealth: number;
  private readonly listeners = new Set<HealthChangeListener>();

  constructor(maxHealth: number, currentHealth = maxHealth) {
    this.maxHealth = normalizeMaxHealth(maxHealth);
    this.currentHealth = clampHealth(currentHealth, this.maxHealth);
  }

  get current(): number {
    return this.currentHealth;
  }

  get max(): number {
    return this.maxHealth;
  }

  get ratio(): number {
    return this.maxHealth <= 0 ? 0 : this.currentHealth / this.maxHealth;
  }

  get isAlive(): boolean {
    return this.currentHealth > 0;
  }

  damage(amount: number): HealthSnapshot {
    if (!Number.isFinite(amount) || amount <= 0 || !this.isAlive) {
      return this.getSnapshot();
    }

    return this.updateCurrent(this.currentHealth - amount, 'damage');
  }

  heal(amount: number): HealthSnapshot {
    if (!Number.isFinite(amount) || amount <= 0 || !this.isAlive) {
      return this.getSnapshot();
    }

    return this.updateCurrent(this.currentHealth + amount, 'heal');
  }

  setMax(maxHealth: number, keepRatio = true): HealthSnapshot {
    const previousRatio = this.ratio;
    const previous = this.getSnapshot();
    this.maxHealth = normalizeMaxHealth(maxHealth);
    this.currentHealth = clampHealth(keepRatio ? this.maxHealth * previousRatio : this.currentHealth, this.maxHealth);
    return this.emitIfChanged(previous, 'set-max');
  }

  reset(currentHealth = this.maxHealth): HealthSnapshot {
    return this.updateCurrent(currentHealth, 'reset');
  }

  onChange(listener: HealthChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): HealthSnapshot {
    return {
      current: roundHealth(this.currentHealth),
      max: roundHealth(this.maxHealth),
      ratio: roundHealth(this.ratio),
      isAlive: this.isAlive,
    };
  }

  private updateCurrent(nextHealth: number, reason: HealthChangeReason): HealthSnapshot {
    const previous = this.getSnapshot();
    this.currentHealth = clampHealth(nextHealth, this.maxHealth);
    return this.emitIfChanged(previous, reason);
  }

  private emitIfChanged(previous: HealthSnapshot, reason: HealthChangeReason): HealthSnapshot {
    const current = this.getSnapshot();
    if (current.current === previous.current && current.max === previous.max && current.isAlive === previous.isAlive) {
      return current;
    }

    for (const listener of this.listeners) {
      listener({ previous, current, reason });
    }

    return current;
  }
}

function normalizeMaxHealth(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Health max must be a positive finite number.');
  }

  return value;
}

function clampHealth(value: number, maxHealth: number): number {
  if (!Number.isFinite(value)) {
    return maxHealth;
  }

  return Math.min(maxHealth, Math.max(0, value));
}

function roundHealth(value: number): number {
  return Math.round(value * 1000) / 1000;
}
