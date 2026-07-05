import type { WeaponDefinition } from './weaponManifest';

type CharacterGrip = WeaponDefinition['view']['characterGrip'];

interface SliderBinding {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  read: (grip: CharacterGrip) => number;
  write: (grip: CharacterGrip, value: number) => void;
}

export interface WeaponViewModelTunerSnapshot {
  enabled: boolean;
  panelVisible: boolean;
  activeWeaponId: string | null;
  activeGrip: CharacterGrip | null;
}

export class WeaponViewModelTuner {
  private readonly panel: HTMLElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly output: HTMLTextAreaElement;
  private readonly values = new Map<string, CharacterGrip>();
  private readonly inputs = new Map<string, HTMLInputElement>();
  private readonly cleanup: Array<() => void> = [];
  private activeWeaponId: string | null = null;
  private panelVisible = true;

  constructor(
    private readonly root: HTMLElement,
    private readonly getActiveWeapon: () => WeaponDefinition,
  ) {
    this.panel = document.createElement('aside');
    this.panel.className = 'viewmodel-tuner';
    this.panel.dataset.viewmodelTuner = '';
    this.panel.dataset.uiControl = '';
    this.toggleButton = document.createElement('button');
    this.toggleButton.type = 'button';
    this.toggleButton.className = 'viewmodel-tuner-toggle';
    this.toggleButton.textContent = 'VM';
    this.toggleButton.dataset.uiControl = '';
    this.toggleButton.setAttribute('aria-label', 'Hide viewmodel tuner');
    this.toggleButton.setAttribute('aria-pressed', 'true');
    this.output = document.createElement('textarea');
    this.output.className = 'viewmodel-tuner__output';
    this.output.readOnly = true;
    this.output.spellcheck = false;
    this.output.dataset.uiControl = '';
    this.panel.append(...this.createContent());
    const host = this.root.querySelector<HTMLElement>('.game-shell') ?? this.root;
    host.append(this.toggleButton, this.panel);
    const onTogglePointerDown = (event: PointerEvent): void => {
      event.preventDefault();
      this.setPanelVisible(!this.panelVisible);
    };
    this.toggleButton.addEventListener('pointerdown', onTogglePointerDown);
    this.cleanup.push(() => this.toggleButton.removeEventListener('pointerdown', onTogglePointerDown));
    this.syncToActiveWeapon();
  }

  getActiveGrip(): CharacterGrip {
    const weapon = this.getActiveWeapon();
    return cloneGrip(this.values.get(weapon.id) ?? weapon.view.characterGrip);
  }

  update(): void {
    if (this.activeWeaponId !== this.getActiveWeapon().id) {
      this.syncToActiveWeapon();
    }
  }

  getSnapshot(): WeaponViewModelTunerSnapshot {
    return {
      enabled: true,
      panelVisible: this.panelVisible,
      activeWeaponId: this.activeWeaponId,
      activeGrip: this.activeWeaponId ? this.getActiveGrip() : null,
    };
  }

  dispose(): void {
    for (const release of this.cleanup) {
      release();
    }
    this.panel.remove();
    this.toggleButton.remove();
    this.cleanup.length = 0;
  }

  private createContent(): HTMLElement[] {
    const title = document.createElement('div');
    title.className = 'viewmodel-tuner__title';
    title.textContent = 'VIEWMODEL';

    const weaponLabel = document.createElement('div');
    weaponLabel.className = 'viewmodel-tuner__weapon';
    weaponLabel.dataset.viewmodelTunerWeapon = '';

    const controls = document.createElement('div');
    controls.className = 'viewmodel-tuner__controls';

    for (const binding of SLIDER_BINDINGS) {
      controls.appendChild(this.createSlider(binding));
    }

    const actions = document.createElement('div');
    actions.className = 'viewmodel-tuner__actions';
    actions.append(
      this.createButton('RESET', () => {
        this.values.delete(this.getActiveWeapon().id);
        this.syncToActiveWeapon();
      }),
      this.createButton('COPY', () => {
        void navigator.clipboard?.writeText(this.output.value);
      }),
    );

    return [title, weaponLabel, controls, actions, this.output];
  }

  private createSlider(binding: SliderBinding): HTMLElement {
    const label = document.createElement('label');
    label.className = 'viewmodel-tuner__row';
    const text = document.createElement('span');
    text.textContent = binding.label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(binding.min);
    input.max = String(binding.max);
    input.step = String(binding.step);
    input.dataset.uiControl = '';
    input.dataset.viewmodelTunerInput = binding.key;
    const output = document.createElement('output');
    output.textContent = '0';

    const onInput = (): void => {
      const weapon = this.getActiveWeapon();
      const grip = cloneGrip(this.values.get(weapon.id) ?? weapon.view.characterGrip);
      binding.write(grip, Number(input.value));
      this.values.set(weapon.id, grip);
      output.textContent = formatNumber(Number(input.value));
      this.refreshOutput();
    };

    input.addEventListener('input', onInput);
    this.cleanup.push(() => input.removeEventListener('input', onInput));
    this.inputs.set(binding.key, input);
    label.append(text, input, output);
    return label;
  }

  private createButton(label: string, onPointerDown: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'viewmodel-tuner__button';
    button.textContent = label;
    button.dataset.uiControl = '';
    const listener = (event: PointerEvent): void => {
      event.preventDefault();
      onPointerDown();
    };
    button.addEventListener('pointerdown', listener);
    this.cleanup.push(() => button.removeEventListener('pointerdown', listener));
    return button;
  }

  private setPanelVisible(visible: boolean): void {
    this.panelVisible = visible;
    this.panel.hidden = !visible;
    this.toggleButton.classList.toggle('viewmodel-tuner-toggle--active', visible);
    this.toggleButton.setAttribute('aria-pressed', String(visible));
    this.toggleButton.setAttribute('aria-label', visible ? 'Hide viewmodel tuner' : 'Show viewmodel tuner');
  }

  private syncToActiveWeapon(): void {
    const weapon = this.getActiveWeapon();
    this.activeWeaponId = weapon.id;
    const grip = cloneGrip(this.values.get(weapon.id) ?? weapon.view.characterGrip);
    this.values.set(weapon.id, grip);
    const weaponLabel = this.panel.querySelector<HTMLElement>('[data-viewmodel-tuner-weapon]');
    if (weaponLabel) {
      weaponLabel.textContent = weapon.label;
    }

    for (const binding of SLIDER_BINDINGS) {
      const input = this.inputs.get(binding.key);
      if (!input) {
        continue;
      }
      const value = binding.read(grip);
      input.value = String(value);
      const output = input.nextElementSibling;
      if (output) {
        output.textContent = formatNumber(value);
      }
    }

    this.refreshOutput();
  }

  private refreshOutput(): void {
    const weapon = this.getActiveWeapon();
    const grip = this.values.get(weapon.id) ?? weapon.view.characterGrip;
    this.output.value = JSON.stringify(
      {
        weaponId: weapon.id,
        characterGrip: roundGrip(grip),
      },
      null,
      2,
    );
  }
}

export function shouldEnableWeaponViewModelTuner(): boolean {
  return new URLSearchParams(window.location.search).has('viewmodelTuning');
}

const SLIDER_BINDINGS: SliderBinding[] = [
  ...vectorBindings('position', 'P', -2.4, 1.2, 0.01),
  ...vectorBindings('aimPosition', 'AP', -2.4, 1.2, 0.01),
  ...rotationBindings('rotation', 'R'),
  ...rotationBindings('aimRotation', 'AR'),
  {
    key: 'scale',
    label: 'S',
    min: 0.1,
    max: 1.4,
    step: 0.01,
    read: (grip) => grip.scale,
    write: (grip, value) => {
      grip.scale = value;
    },
  },
  {
    key: 'aimScaleMultiplier',
    label: 'AS',
    min: 0.8,
    max: 1.3,
    step: 0.01,
    read: (grip) => grip.aimScaleMultiplier,
    write: (grip, value) => {
      grip.aimScaleMultiplier = value;
    },
  },
  {
    key: 'clipTopY',
    label: 'CLIP',
    min: -1,
    max: 1.4,
    step: 0.01,
    read: (grip) => grip.clipTopY ?? 0.28,
    write: (grip, value) => {
      grip.clipTopY = value;
    },
  },
];

function vectorBindings(
  field: 'position' | 'aimPosition',
  labelPrefix: string,
  min: number,
  max: number,
  step: number,
): SliderBinding[] {
  return (['x', 'y', 'z'] as const).map((axis, index) => ({
    key: `${field}.${axis}`,
    label: `${labelPrefix}${axis.toUpperCase()}`,
    min,
    max,
    step,
    read: (grip) => grip[field][index],
    write: (grip, value) => {
      grip[field][index] = value;
    },
  }));
}

function rotationBindings(field: 'rotation' | 'aimRotation', labelPrefix: string): SliderBinding[] {
  return (['x', 'y', 'z'] as const).map((axis, index) => ({
    key: `${field}.${axis}`,
    label: `${labelPrefix}${axis.toUpperCase()}`,
    min: -180,
    max: 180,
    step: 1,
    read: (grip) => radiansToDegrees(grip[field][index]),
    write: (grip, value) => {
      grip[field][index] = degreesToRadians(value);
    },
  }));
}

function cloneGrip(grip: CharacterGrip): CharacterGrip {
  return {
    position: [...grip.position],
    aimPosition: [...grip.aimPosition],
    rotation: [...grip.rotation],
    aimRotation: [...grip.aimRotation],
    scale: grip.scale,
    aimScaleMultiplier: grip.aimScaleMultiplier,
    clipTopY: grip.clipTopY,
  };
}

function roundGrip(grip: CharacterGrip): CharacterGrip {
  return {
    position: roundTuple(grip.position),
    aimPosition: roundTuple(grip.aimPosition),
    rotation: roundTuple(grip.rotation),
    aimRotation: roundTuple(grip.aimRotation),
    scale: roundNumber(grip.scale),
    aimScaleMultiplier: roundNumber(grip.aimScaleMultiplier),
    clipTopY: grip.clipTopY === null ? null : roundNumber(grip.clipTopY),
  };
}

function roundTuple(tuple: readonly [number, number, number]): [number, number, number] {
  return [roundNumber(tuple[0]), roundNumber(tuple[1]), roundNumber(tuple[2])];
}

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}
