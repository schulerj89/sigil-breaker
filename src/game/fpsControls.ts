import * as THREE from 'three';
import { collidesWithLevel, getSpawnPosition } from './levelMap';

const EYE_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.24;
const MOVE_SPEED_UNITS_PER_SECOND = 3.25;
const LOOK_SENSITIVITY = 0.004;
const MIN_PITCH = -1.15;
const MAX_PITCH = 1.1;

export interface FpsPlayerState {
  position: [number, number, number];
  yawRadians: number;
  pitchRadians: number;
}

export interface FpsControlState {
  moveVector: [number, number];
  keyboardVector: [number, number];
  lookActive: boolean;
  movePointerActive: boolean;
}

export interface FpsControllerSnapshot {
  player: FpsPlayerState;
  controls: FpsControlState;
}

type KeyName = 'forward' | 'backward' | 'left' | 'right';

export class FpsControls {
  private readonly player = getSpawnPosition();
  private yaw = -Math.PI / 2;
  private pitch = 0;
  private readonly moveInput = new THREE.Vector2();
  private readonly keyboardInput = new THREE.Vector2();
  private movePointerId: number | null = null;
  private lookPointerId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private readonly pressedKeys = new Set<KeyName>();
  private readonly stick: HTMLElement | null;
  private readonly stickKnob: HTMLElement | null;

  constructor(
    private readonly root: HTMLElement,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.stick = root.querySelector<HTMLElement>('[data-move-stick]');
    this.stickKnob = root.querySelector<HTMLElement>('[data-stick-knob]');
    this.camera.rotation.order = 'YXZ';
    this.syncCamera();
    this.root.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  update(deltaSeconds: number): void {
    this.updateKeyboardVector();
    const inputX = clamp(this.moveInput.x + this.keyboardInput.x, -1, 1);
    const inputY = clamp(this.moveInput.y + this.keyboardInput.y, -1, 1);
    const magnitude = Math.hypot(inputX, inputY);

    if (magnitude > 0.001) {
      const normalizedX = inputX / Math.max(1, magnitude);
      const normalizedY = inputY / Math.max(1, magnitude);
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const move = right
        .multiplyScalar(normalizedX)
        .add(forward.multiplyScalar(normalizedY))
        .multiplyScalar(MOVE_SPEED_UNITS_PER_SECOND * deltaSeconds);

      this.tryMove(move.x, move.z);
    }

    this.syncCamera();
  }

  dispose(): void {
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  getSnapshot(): FpsControllerSnapshot {
    return {
      player: {
        position: [
          roundMetric(this.player.x),
          roundMetric(EYE_HEIGHT),
          roundMetric(this.player.z),
        ],
        yawRadians: roundMetric(this.yaw),
        pitchRadians: roundMetric(this.pitch),
      },
      controls: {
        moveVector: [roundMetric(this.moveInput.x), roundMetric(this.moveInput.y)],
        keyboardVector: [roundMetric(this.keyboardInput.x), roundMetric(this.keyboardInput.y)],
        lookActive: this.lookPointerId !== null,
        movePointerActive: this.movePointerId !== null,
      },
    };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('[data-ui-control]')) {
      return;
    }

    if (target.closest('[data-move-stick]')) {
      this.movePointerId = event.pointerId;
      this.root.setPointerCapture(event.pointerId);
      this.updateMoveInput(event);
      event.preventDefault();
      return;
    }

    if (event.clientX >= window.innerWidth * 0.42) {
      this.lookPointerId = event.pointerId;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
      this.root.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.movePointerId) {
      this.updateMoveInput(event);
      event.preventDefault();
      return;
    }

    if (event.pointerId === this.lookPointerId) {
      const deltaX = event.clientX - this.lastLookX;
      const deltaY = event.clientY - this.lastLookY;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
      this.yaw -= deltaX * LOOK_SENSITIVITY;
      this.pitch = clamp(this.pitch - deltaY * LOOK_SENSITIVITY, MIN_PITCH, MAX_PITCH);
      event.preventDefault();
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.movePointerId) {
      this.movePointerId = null;
      this.moveInput.set(0, 0);
      this.updateStickKnob(0, 0);
    }

    if (event.pointerId === this.lookPointerId) {
      this.lookPointerId = null;
    }

    if (this.root.hasPointerCapture(event.pointerId)) {
      this.root.releasePointerCapture(event.pointerId);
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const mappedKey = mapKey(event.code);
    if (!mappedKey) {
      return;
    }

    this.pressedKeys.add(mappedKey);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const mappedKey = mapKey(event.code);
    if (!mappedKey) {
      return;
    }

    this.pressedKeys.delete(mappedKey);
  };

  private updateMoveInput(event: PointerEvent): void {
    if (!this.stick) {
      return;
    }

    const rect = this.stick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDistance = rect.width * 0.38;
    const deltaX = event.clientX - centerX;
    const deltaY = event.clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);
    const clampedDistance = Math.min(maxDistance, distance);
    const angle = Math.atan2(deltaY, deltaX);
    const knobX = Math.cos(angle) * clampedDistance;
    const knobY = Math.sin(angle) * clampedDistance;

    this.moveInput.set(knobX / maxDistance, -knobY / maxDistance);
    this.updateStickKnob(knobX, knobY);
  }

  private updateStickKnob(x: number, y: number): void {
    if (!this.stickKnob) {
      return;
    }

    this.stickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }

  private updateKeyboardVector(): void {
    const x = Number(this.pressedKeys.has('right')) - Number(this.pressedKeys.has('left'));
    const y = Number(this.pressedKeys.has('forward')) - Number(this.pressedKeys.has('backward'));
    this.keyboardInput.set(x, y);

    if (this.keyboardInput.lengthSq() > 1) {
      this.keyboardInput.normalize();
    }
  }

  private tryMove(deltaX: number, deltaZ: number): void {
    const nextX = this.player.x + deltaX;
    if (!collidesWithLevel(nextX, this.player.z, PLAYER_RADIUS)) {
      this.player.x = nextX;
    }

    const nextZ = this.player.z + deltaZ;
    if (!collidesWithLevel(this.player.x, nextZ, PLAYER_RADIUS)) {
      this.player.z = nextZ;
    }
  }

  private syncCamera(): void {
    this.camera.position.set(this.player.x, EYE_HEIGHT, this.player.z);
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.z = 0;
  }
}

function mapKey(code: string): KeyName | null {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      return 'forward';
    case 'KeyS':
    case 'ArrowDown':
      return 'backward';
    case 'KeyA':
    case 'ArrowLeft':
      return 'left';
    case 'KeyD':
    case 'ArrowRight':
      return 'right';
    default:
      return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}
