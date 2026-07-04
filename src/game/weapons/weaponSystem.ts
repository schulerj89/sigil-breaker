import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { collidesWithLevel, raycastLevel } from '../levelMap';
import { WEAPON_COLLISION_RADIUS, getWeaponWallProbeLocalPosition } from './weaponClearance';
import { WeaponAudio, type WeaponAudioSnapshot } from './weaponAudio';
import { WEAPON_DEFINITIONS, publicAssetUrl, withAssetVersion, type WeaponDefinition } from './weaponManifest';
import {
  getCameraSpaceShotDistance,
  getHorizontalRaycastDistance,
  getHorizontalShotDirectionLength,
  hasHorizontalShotDirection,
} from './weaponShotMath';
import {
  getWeaponRootCameraPosition,
  getWeaponRootCameraRotation,
  getWeaponRootCameraScale,
  getWeaponShotEffectPositions,
  type WeaponViewPoseState,
  type WeaponShotEffectPositions,
} from './weaponViewPose';

const WALL_AVOIDANCE_DISTANCE = 1.12;
const WALL_AVOIDANCE_START_DISTANCE = 0.34;
const MIN_BLOCKED_SHOT_DISTANCE_UNITS = 0.35;
const AIM_FOV_OFFSET_DEGREES = 8;
const MIN_AIM_FOV_DEGREES = 58;
const AIM_IN_RESPONSE = 8;
const AIM_OUT_RESPONSE = 6;

export interface WeaponShotSnapshot {
  sequence: number;
  blockedByWall: boolean;
  distanceUnits: number;
  tile: [number, number] | null;
}

export interface WeaponSystemSnapshot {
  weaponIds: string[];
  activeWeaponId: string;
  activeWeaponLabel: string;
  ammoInMagazine: number;
  magazineSize: number;
  isReloading: boolean;
  isFireHeld: boolean;
  aimBlend: number;
  cameraFovDegrees: number;
  shotCount: number;
  wallAvoidance: number;
  modelBytesLoaded: number;
  loadedAssetIds: string[];
  assetLoadErrors: string[];
  audio: WeaponAudioSnapshot;
  effectPose: WeaponShotEffectPositions;
  effectStyle: {
    muzzleColor: string;
    tracerColor: string;
    impactColor: string;
  };
  lastShot: WeaponShotSnapshot | null;
}

interface LoadedWeapon {
  definition: WeaponDefinition;
  object: THREE.Object3D;
}

export class WeaponSystem {
  private readonly loadingManager = new THREE.LoadingManager();
  private readonly loader = new GLTFLoader(this.loadingManager);
  private readonly audio = new WeaponAudio();
  private readonly viewRoot = new THREE.Group();
  private readonly modelSlot = new THREE.Group();
  private readonly muzzleFlash: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly shotFeedbackRoot = new THREE.Group();
  private readonly shotTracer: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly wallImpact: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly wallAvoidanceDirection = new THREE.Vector3();
  private readonly wallAvoidanceProbe = new THREE.Vector3();
  private readonly baseCameraFov: number;
  private readonly aimCameraFov: number;
  private readonly loadedWeapons = new Map<string, LoadedWeapon>();
  private readonly loadedAssetIds = new Set<string>();
  private readonly assetLoadErrors: string[] = [];
  private readonly ammoByWeapon = new Map<string, number>();
  private activeWeapon = WEAPON_DEFINITIONS[0];
  private activeLoadedWeapon: LoadedWeapon | null = null;
  private nextShotAt = 0;
  private reloadCompleteAt = 0;
  private muzzleFlashUntil = 0;
  private shotFeedbackUntil = 0;
  private recoil = 0;
  private wallAvoidance = 0;
  private shotFeedbackDistance = 0;
  private shotCount = 0;
  private aimBlend = 0;
  private firePointerId: number | null = null;
  private keyboardFireHeld = false;
  private lastShot: WeaponShotSnapshot | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.baseCameraFov = camera.fov;
    this.aimCameraFov = Math.max(MIN_AIM_FOV_DEGREES, this.baseCameraFov - AIM_FOV_OFFSET_DEGREES);
    this.viewRoot.name = 'first-person-weapon-root';
    this.loadingManager.setURLModifier(withAssetVersion);
    this.modelSlot.name = 'first-person-weapon-model-slot';
    this.muzzleFlash = createMuzzleFlash();
    this.shotFeedbackRoot.name = 'first-person-shot-feedback-root';
    this.shotTracer = createShotTracer();
    this.wallImpact = createWallImpact();
    this.updateEffectStyle();
    this.viewRoot.add(this.modelSlot);
    this.shotFeedbackRoot.add(this.muzzleFlash, this.shotTracer, this.wallImpact);
    this.camera.add(this.viewRoot, this.shotFeedbackRoot);
    this.audio.bind(root);

    for (const weapon of WEAPON_DEFINITIONS) {
      this.ammoByWeapon.set(weapon.id, weapon.magazineSize);
    }

    this.updateMenuState();
    this.root.addEventListener('pointerdown', this.onPointerDown);
    this.root.addEventListener('pointerup', this.onPointerUp);
    this.root.addEventListener('pointercancel', this.onPointerCancel);
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('dblclick', this.onDoubleClick);
    this.root.addEventListener('touchend', this.onTouchEnd, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    void this.preloadWeapons();
  }

  update(deltaSeconds: number, now: number): void {
    if (this.reloadCompleteAt > 0 && now >= this.reloadCompleteAt) {
      this.ammoByWeapon.set(this.activeWeapon.id, this.activeWeapon.magazineSize);
      this.reloadCompleteAt = 0;
    }

    this.aimBlend = damp(
      this.aimBlend,
      this.isFiringHeld() ? 1 : 0,
      deltaSeconds,
      this.isFiringHeld() ? AIM_IN_RESPONSE : AIM_OUT_RESPONSE,
    );
    this.updateCameraFov();

    if (this.isFiringHeld()) {
      this.shoot(now);
    }

    this.recoil = Math.max(0, this.recoil - deltaSeconds * 8);
    this.wallAvoidance = this.getWallAvoidance(this.activeWeapon.view);
    this.muzzleFlash.visible = now < this.muzzleFlashUntil;
    const shotFeedbackVisible = now < this.shotFeedbackUntil;
    this.shotTracer.visible = shotFeedbackVisible;
    this.wallImpact.visible = shotFeedbackVisible && this.lastShot?.blockedByWall === true;

    const view = this.activeWeapon.view;
    const pose = this.getViewPose();
    this.viewRoot.position.set(...getWeaponRootCameraPosition(view, pose));
    this.viewRoot.rotation.set(...getWeaponRootCameraRotation(view, pose));
    this.viewRoot.scale.setScalar(getWeaponRootCameraScale(view, pose));
    const effectPositions = getWeaponShotEffectPositions(
      view,
      this.shotFeedbackDistance > 0 ? this.shotFeedbackDistance : this.activeWeapon.rangeUnits,
      pose,
    );
    this.muzzleFlash.position.set(...effectPositions.muzzle);

    if (shotFeedbackVisible && this.shotFeedbackDistance > 0) {
      this.setShotFeedbackPositions(effectPositions);
    }
  }

  getSnapshot(): WeaponSystemSnapshot {
    const audioSnapshot = this.audio.getSnapshot();

    return {
      weaponIds: WEAPON_DEFINITIONS.map((weapon) => weapon.id),
      activeWeaponId: this.activeWeapon.id,
      activeWeaponLabel: this.activeWeapon.label,
      ammoInMagazine: this.ammoByWeapon.get(this.activeWeapon.id) ?? 0,
      magazineSize: this.activeWeapon.magazineSize,
      isReloading: this.reloadCompleteAt > 0,
      isFireHeld: this.isFiringHeld(),
      aimBlend: roundMetric(this.getEasedAimBlend()),
      cameraFovDegrees: roundMetric(this.camera.fov),
      shotCount: this.shotCount,
      wallAvoidance: roundMetric(this.wallAvoidance),
      modelBytesLoaded: [...this.loadedWeapons.values()].reduce(
        (total, weapon) => total + weapon.definition.modelBytes,
        0,
      ),
      loadedAssetIds: [...this.loadedAssetIds, ...audioSnapshot.loadedAssetIds].sort(),
      assetLoadErrors: [...this.assetLoadErrors, ...audioSnapshot.assetLoadErrors],
      audio: audioSnapshot,
      effectPose: roundEffectPose(
        getWeaponShotEffectPositions(
          this.activeWeapon.view,
          this.shotFeedbackDistance > 0 ? this.shotFeedbackDistance : this.activeWeapon.rangeUnits,
          this.getViewPose(),
        ),
      ),
      effectStyle: {
        muzzleColor: toHexColor(this.activeWeapon.effects.muzzleColor),
        tracerColor: toHexColor(this.activeWeapon.effects.tracerColor),
        impactColor: toHexColor(this.activeWeapon.effects.impactColor),
      },
      lastShot: this.lastShot,
    };
  }

  dispose(): void {
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.root.removeEventListener('pointerup', this.onPointerUp);
    this.root.removeEventListener('pointercancel', this.onPointerCancel);
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('dblclick', this.onDoubleClick);
    this.root.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    this.releaseFireState();
    this.camera.fov = this.baseCameraFov;
    this.camera.updateProjectionMatrix();
    this.audio.dispose();
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();
    for (const loadedWeapon of this.loadedWeapons.values()) {
      disposeObject3D(loadedWeapon.object, disposedGeometries, disposedMaterials);
    }
    disposeObject3D(this.viewRoot, disposedGeometries, disposedMaterials);
    disposeObject3D(this.shotFeedbackRoot, disposedGeometries, disposedMaterials);
    this.viewRoot.removeFromParent();
    this.shotFeedbackRoot.removeFromParent();
    this.loadedWeapons.clear();
    this.loadedAssetIds.clear();
  }

  private async preloadWeapons(): Promise<void> {
    await Promise.all(WEAPON_DEFINITIONS.map((weapon) => this.loadWeapon(weapon)));
    this.switchWeapon(this.activeWeapon.id);
  }

  private async loadWeapon(definition: WeaponDefinition): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(publicAssetUrl(definition.modelPath));
      const object = gltf.scene;
      object.name = definition.id;
      object.traverse((child) => {
        child.frustumCulled = false;
      });
      const loadedWeapon = { definition, object };
      this.loadedWeapons.set(definition.id, loadedWeapon);
      this.loadedAssetIds.add(definition.id);

      if (definition.id === this.activeWeapon.id) {
        this.attachLoadedWeapon(loadedWeapon);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.assetLoadErrors.push(`${definition.id}: ${message}`);
      if (definition.id === this.activeWeapon.id) {
        this.attachFallbackWeapon(definition);
      }
    }
  }

  private switchWeapon(weaponId: string): void {
    const nextWeapon = WEAPON_DEFINITIONS.find((weapon) => weapon.id === weaponId);
    if (!nextWeapon || nextWeapon.id === this.activeWeapon.id) {
      return;
    }

    this.activeWeapon = nextWeapon;
    this.reloadCompleteAt = 0;
    this.updateEffectStyle();
    const loadedWeapon = this.loadedWeapons.get(nextWeapon.id);
    if (loadedWeapon) {
      this.attachLoadedWeapon(loadedWeapon);
    } else {
      this.attachFallbackWeapon(nextWeapon);
    }
    this.updateMenuState();
  }

  private cycleWeapon(): void {
    const activeIndex = WEAPON_DEFINITIONS.findIndex((weapon) => weapon.id === this.activeWeapon.id);
    const nextWeapon = WEAPON_DEFINITIONS[(activeIndex + 1) % WEAPON_DEFINITIONS.length] ?? WEAPON_DEFINITIONS[0];
    this.switchWeapon(nextWeapon.id);
  }

  private shoot(now: number): void {
    if (now < this.nextShotAt || this.reloadCompleteAt > 0) {
      return;
    }

    const ammo = this.ammoByWeapon.get(this.activeWeapon.id) ?? 0;
    if (ammo <= 0) {
      this.reloadCompleteAt = now + this.activeWeapon.reloadMs;
      return;
    }

    this.ammoByWeapon.set(this.activeWeapon.id, ammo - 1);
    this.nextShotAt = now + this.activeWeapon.fireIntervalMs;
    this.reloadCompleteAt = ammo - 1 <= 0 ? now + this.activeWeapon.reloadMs : 0;
    this.muzzleFlashUntil = now + this.activeWeapon.effects.flashMs;
    this.recoil = Math.min(0.18, this.recoil + this.activeWeapon.recoilKick);
    this.shotCount++;
    this.traceShot(now);
    this.audio.play(this.activeWeapon.soundProfile);
  }

  private traceShot(now: number): void {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    const horizontalDirectionLength = getHorizontalShotDirectionLength(direction.x, direction.z);
    const maxHorizontalDistance = getHorizontalRaycastDistance(
      this.activeWeapon.rangeUnits,
      horizontalDirectionLength,
    );
    const hit = hasHorizontalShotDirection(horizontalDirectionLength)
      ? raycastLevel(
          this.camera.position.x,
          this.camera.position.z,
          direction.x,
          direction.z,
          maxHorizontalDistance,
        )
      : null;
    const distance = hit
      ? Math.max(
          MIN_BLOCKED_SHOT_DISTANCE_UNITS,
          getCameraSpaceShotDistance(hit.distance, horizontalDirectionLength),
        )
      : this.activeWeapon.rangeUnits;
    this.lastShot = {
      sequence: this.shotCount,
      blockedByWall: Boolean(hit),
      distanceUnits: roundMetric(distance),
      tile: hit?.tile ? [hit.tile.column, hit.tile.row] : null,
    };
    this.shotFeedbackDistance = distance;
    this.shotFeedbackUntil = now + this.activeWeapon.effects.feedbackMs;
    this.updateShotFeedback(distance);
  }

  private updateShotFeedback(distance: number): void {
    const positions = getWeaponShotEffectPositions(this.activeWeapon.view, distance, this.getViewPose());
    this.muzzleFlash.position.set(...positions.muzzle);
    this.setShotFeedbackPositions(positions);
  }

  private setShotFeedbackPositions(positions: WeaponShotEffectPositions): void {
    updateShotTracer(this.shotTracer, positions.muzzle, positions.tracerEnd);
    this.wallImpact.position.set(...positions.wallImpact);
  }

  private getWallAvoidance(view: WeaponDefinition['view']): number {
    this.camera.updateMatrixWorld();
    this.camera.getWorldDirection(this.wallAvoidanceDirection);
    const hit = raycastLevel(
      this.camera.position.x,
      this.camera.position.z,
      this.wallAvoidanceDirection.x,
      this.wallAvoidanceDirection.z,
      WALL_AVOIDANCE_DISTANCE,
    );
    const rayAvoidance = hit
      ? 1 -
        clamp01(
          (hit.distance - WALL_AVOIDANCE_START_DISTANCE) /
            (WALL_AVOIDANCE_DISTANCE - WALL_AVOIDANCE_START_DISTANCE),
        )
      : 0;

    this.wallAvoidanceProbe.set(...getWeaponWallProbeLocalPosition(view)).applyMatrix4(this.camera.matrixWorld);
    const probeAvoidance = collidesWithLevel(
      this.wallAvoidanceProbe.x,
      this.wallAvoidanceProbe.z,
      WEAPON_COLLISION_RADIUS,
    )
      ? 1
      : 0;

    return Math.max(rayAvoidance, probeAvoidance);
  }

  private getViewPose(): WeaponViewPoseState {
    return {
      recoil: this.recoil,
      wallAvoidance: this.wallAvoidance,
      aimBlend: this.getEasedAimBlend(),
    };
  }

  private getEasedAimBlend(): number {
    return smoothstep(this.aimBlend);
  }

  private updateEffectStyle(): void {
    const { effects } = this.activeWeapon;
    this.muzzleFlash.material.color.setHex(effects.muzzleColor);
    this.muzzleFlash.scale.setScalar(effects.muzzleScale);
    this.shotTracer.material.color.setHex(effects.tracerColor);
    this.shotTracer.material.opacity = effects.tracerOpacity;
    this.wallImpact.material.color.setHex(effects.impactColor);
    this.wallImpact.scale.setScalar(effects.impactScale);
  }

  private attachLoadedWeapon(loadedWeapon: LoadedWeapon): void {
    this.clearModelSlot();
    this.activeLoadedWeapon = loadedWeapon;
    this.modelSlot.add(loadedWeapon.object);
  }

  private attachFallbackWeapon(definition: WeaponDefinition): void {
    this.clearModelSlot();
    this.activeLoadedWeapon = null;
    const fallback = createFallbackWeapon(definition.id);
    this.modelSlot.add(fallback);
  }

  private clearModelSlot(): void {
    if (!this.activeLoadedWeapon) {
      disposeObject3D(this.modelSlot);
    }
    this.modelSlot.clear();
  }

  private updateMenuState(): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-weapon-button]')) {
      const isActive = button.dataset.weaponId === this.activeWeapon.id;
      button.classList.toggle('weapon-button--active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }

    const cycleButton = this.root.querySelector<HTMLButtonElement>('[data-weapon-cycle-button]');
    if (cycleButton) {
      cycleButton.dataset.activeWeaponId = this.activeWeapon.id;
      cycleButton.setAttribute('aria-label', `Switch weapon. Current ${this.activeWeapon.label}`);
    }
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const weaponButton = target.closest<HTMLElement>('[data-weapon-button]');
    if (weaponButton?.dataset.weaponId) {
      event.preventDefault();
      this.switchWeapon(weaponButton.dataset.weaponId);
      return;
    }

    if (target.closest('[data-weapon-cycle-button]')) {
      event.preventDefault();
      this.cycleWeapon();
      return;
    }

    if (target.closest('[data-fire-button]')) {
      event.preventDefault();
      this.beginPointerFire(event.pointerId, performance.now());
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.firePointerId) {
      event.preventDefault();
      this.endPointerFire(event.pointerId);
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest('[data-ui-control]')) {
      event.preventDefault();
    }
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.firePointerId) {
      event.preventDefault();
      this.endPointerFire(event.pointerId);
    }
  };

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const weaponButton = target.closest<HTMLElement>('[data-weapon-button]');
    if (target.closest('[data-ui-control]')) {
      event.preventDefault();
    }

    if (!weaponButton?.dataset.weaponId) {
      return;
    }

    this.switchWeapon(weaponButton.dataset.weaponId);
  };

  private readonly onDoubleClick = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-ui-control]')) {
      event.preventDefault();
    }
  };

  private readonly onTouchEnd = (event: TouchEvent): void => {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-ui-control]')) {
      event.preventDefault();
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space') {
      event.preventDefault();
      if (!this.keyboardFireHeld) {
        this.keyboardFireHeld = true;
        this.updateFireButtonState();
        this.shoot(performance.now());
      }
      return;
    }

    if (!event.code.startsWith('Digit')) {
      return;
    }

    const weaponIndex = Number(event.code.replace('Digit', '')) - 1;
    const weapon = WEAPON_DEFINITIONS[weaponIndex];
    if (weapon) {
      this.switchWeapon(weapon.id);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space') {
      event.preventDefault();
      this.keyboardFireHeld = false;
      this.updateFireButtonState();
    }
  };

  private readonly onWindowBlur = (): void => {
    this.releaseFireState();
  };

  private beginPointerFire(pointerId: number, now: number): void {
    if (this.firePointerId !== null) {
      return;
    }

    this.firePointerId = pointerId;
    if (!this.root.hasPointerCapture(pointerId)) {
      this.root.setPointerCapture(pointerId);
    }
    this.updateFireButtonState();
    this.shoot(now);
  }

  private endPointerFire(pointerId: number): void {
    if (this.firePointerId !== pointerId) {
      return;
    }

    this.firePointerId = null;
    if (this.root.hasPointerCapture(pointerId)) {
      this.root.releasePointerCapture(pointerId);
    }
    this.updateFireButtonState();
  }

  private releaseFireState(): void {
    const activePointerId = this.firePointerId;
    this.firePointerId = null;
    this.keyboardFireHeld = false;
    if (activePointerId !== null && this.root.hasPointerCapture(activePointerId)) {
      this.root.releasePointerCapture(activePointerId);
    }
    this.updateFireButtonState();
  }

  private isFiringHeld(): boolean {
    return this.firePointerId !== null || this.keyboardFireHeld;
  }

  private updateFireButtonState(): void {
    const fireButton = this.root.querySelector<HTMLElement>('[data-fire-button]');
    if (fireButton) {
      fireButton.classList.toggle('action-button--active', this.isFiringHeld());
    }
  }

  private updateCameraFov(): void {
    const targetFov = lerp(this.baseCameraFov, this.aimCameraFov, this.aimBlend);
    if (Math.abs(this.camera.fov - targetFov) < 0.01) {
      return;
    }

    this.camera.fov = targetFov;
    this.camera.updateProjectionMatrix();
  }
}

function createMuzzleFlash(): THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> {
  const geometry = new THREE.CircleGeometry(0.11, 18);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd06a,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'weapon-muzzle-flash';
  mesh.renderOrder = 5;
  mesh.visible = false;
  return mesh;
}

function createShotTracer(): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  line.name = 'weapon-shot-tracer';
  line.visible = false;
  return line;
}

function createWallImpact(): THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> {
  const geometry = new THREE.RingGeometry(0.035, 0.07, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffe28a,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'weapon-wall-impact';
  mesh.visible = false;
  return mesh;
}

function updateShotTracer(
  tracer: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>,
  muzzle: readonly [number, number, number],
  tracerEnd: readonly [number, number, number],
): void {
  const position = tracer.geometry.getAttribute('position');
  position.setXYZ(0, ...muzzle);
  position.setXYZ(1, ...tracerEnd);
  position.needsUpdate = true;
  tracer.geometry.computeBoundingSphere();
}

function createFallbackWeapon(name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = `${name}-fallback`;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.22, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x31363d, roughness: 0.72 }),
  );
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1a1f26, roughness: 0.68 }),
  );
  body.position.z = -0.2;
  barrel.position.set(0, 0.02, -0.72);
  group.add(body, barrel);
  return group;
}

function disposeObject3D(
  object: THREE.Object3D,
  disposedGeometries = new Set<THREE.BufferGeometry>(),
  disposedMaterials = new Set<THREE.Material>(),
): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      if (!disposedGeometries.has(child.geometry)) {
        child.geometry.dispose();
        disposedGeometries.add(child.geometry);
      }
      disposeMaterial(child.material, disposedMaterials);
    }
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[], disposedMaterials: Set<THREE.Material>): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      disposeMaterial(item, disposedMaterials);
    }
    return;
  }

  if (disposedMaterials.has(material)) {
    return;
  }

  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
  material.dispose();
  disposedMaterials.add(material);
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundEffectPose(positions: WeaponShotEffectPositions): WeaponShotEffectPositions {
  return {
    muzzle: roundTuple(positions.muzzle),
    tracerEnd: roundTuple(positions.tracerEnd),
    wallImpact: roundTuple(positions.wallImpact),
  };
}

function roundTuple(tuple: readonly [number, number, number]): [number, number, number] {
  return [roundMetric(tuple[0]), roundMetric(tuple[1]), roundMetric(tuple[2])];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function damp(current: number, target: number, deltaSeconds: number, response: number): number {
  const amount = 1 - Math.exp(-response * Math.min(deltaSeconds, 0.05));
  return current + (target - current) * amount;
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function toHexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
