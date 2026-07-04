import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WeaponAudio } from './weaponAudio';
import { WEAPON_DEFINITIONS, publicAssetUrl, type WeaponDefinition } from './weaponManifest';

export interface WeaponSystemSnapshot {
  weaponIds: string[];
  activeWeaponId: string;
  activeWeaponLabel: string;
  ammoInMagazine: number;
  magazineSize: number;
  isReloading: boolean;
  shotCount: number;
  modelBytesLoaded: number;
  loadedAssetIds: string[];
  assetLoadErrors: string[];
}

interface LoadedWeapon {
  definition: WeaponDefinition;
  object: THREE.Object3D;
}

export class WeaponSystem {
  private readonly loader = new GLTFLoader();
  private readonly audio = new WeaponAudio();
  private readonly viewRoot = new THREE.Group();
  private readonly modelSlot = new THREE.Group();
  private readonly muzzleFlash: THREE.Mesh;
  private readonly loadedWeapons = new Map<string, LoadedWeapon>();
  private readonly loadedAssetIds = new Set<string>();
  private readonly assetLoadErrors: string[] = [];
  private readonly ammoByWeapon = new Map<string, number>();
  private activeWeapon = WEAPON_DEFINITIONS[0];
  private activeLoadedWeapon: LoadedWeapon | null = null;
  private nextShotAt = 0;
  private reloadCompleteAt = 0;
  private muzzleFlashUntil = 0;
  private recoil = 0;
  private shotCount = 0;

  constructor(
    private readonly root: HTMLElement,
    camera: THREE.PerspectiveCamera,
  ) {
    this.viewRoot.name = 'first-person-weapon-root';
    this.modelSlot.name = 'first-person-weapon-model-slot';
    this.muzzleFlash = createMuzzleFlash();
    this.viewRoot.add(this.modelSlot, this.muzzleFlash);
    camera.add(this.viewRoot);

    for (const weapon of WEAPON_DEFINITIONS) {
      this.ammoByWeapon.set(weapon.id, weapon.magazineSize);
    }

    this.updateMenuState();
    this.root.addEventListener('pointerdown', this.onPointerDown);
    this.root.addEventListener('click', this.onClick);
    window.addEventListener('keydown', this.onKeyDown);
    void this.preloadWeapons();
  }

  update(deltaSeconds: number, now: number): void {
    if (this.reloadCompleteAt > 0 && now >= this.reloadCompleteAt) {
      this.ammoByWeapon.set(this.activeWeapon.id, this.activeWeapon.magazineSize);
      this.reloadCompleteAt = 0;
    }

    this.recoil = Math.max(0, this.recoil - deltaSeconds * 8);
    this.muzzleFlash.visible = now < this.muzzleFlashUntil;

    const view = this.activeWeapon.view;
    this.viewRoot.position.set(view.position[0], view.position[1], view.position[2] + this.recoil);
    this.viewRoot.rotation.set(
      view.rotation[0] - this.recoil * 1.4,
      view.rotation[1],
      view.rotation[2] + this.recoil * 0.55,
    );
    this.viewRoot.scale.setScalar(view.scale);
  }

  getSnapshot(): WeaponSystemSnapshot {
    return {
      weaponIds: WEAPON_DEFINITIONS.map((weapon) => weapon.id),
      activeWeaponId: this.activeWeapon.id,
      activeWeaponLabel: this.activeWeapon.label,
      ammoInMagazine: this.ammoByWeapon.get(this.activeWeapon.id) ?? 0,
      magazineSize: this.activeWeapon.magazineSize,
      isReloading: this.reloadCompleteAt > 0,
      shotCount: this.shotCount,
      modelBytesLoaded: [...this.loadedWeapons.values()].reduce(
        (total, weapon) => total + weapon.definition.modelBytes,
        0,
      ),
      loadedAssetIds: [...this.loadedAssetIds].sort(),
      assetLoadErrors: [...this.assetLoadErrors],
    };
  }

  dispose(): void {
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.root.removeEventListener('click', this.onClick);
    window.removeEventListener('keydown', this.onKeyDown);
    this.audio.dispose();
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();
    for (const loadedWeapon of this.loadedWeapons.values()) {
      disposeObject3D(loadedWeapon.object, disposedGeometries, disposedMaterials);
    }
    disposeObject3D(this.viewRoot, disposedGeometries, disposedMaterials);
    this.viewRoot.removeFromParent();
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
    const loadedWeapon = this.loadedWeapons.get(nextWeapon.id);
    if (loadedWeapon) {
      this.attachLoadedWeapon(loadedWeapon);
    } else {
      this.attachFallbackWeapon(nextWeapon);
    }
    this.updateMenuState();
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
    this.muzzleFlashUntil = now + 70;
    this.recoil = Math.min(0.18, this.recoil + this.activeWeapon.recoilKick);
    this.shotCount++;
    this.audio.play(this.activeWeapon.soundProfile);
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
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('[data-fire-button]')) {
      event.preventDefault();
      this.shoot(performance.now());
    }
  };

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const weaponButton = target.closest<HTMLElement>('[data-weapon-button]');
    if (!weaponButton?.dataset.weaponId) {
      return;
    }

    this.switchWeapon(weaponButton.dataset.weaponId);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space') {
      event.preventDefault();
      this.shoot(performance.now());
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
}

function createMuzzleFlash(): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(0.055, 0.22, 10);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd06a,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'weapon-muzzle-flash';
  mesh.position.set(0.04, 0.04, -1.1);
  mesh.rotation.x = Math.PI / 2;
  mesh.visible = false;
  return mesh;
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
    if (child instanceof THREE.Mesh) {
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
