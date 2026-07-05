import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { publicAssetUrl } from './assetUrls';

const CHARACTER_ASSET_ID = 'character.player.meshy.gadget-gremlin.rigged';
const MODEL_PATH = 'assets/characters/meshy-gadget-gremlin/models/player.hero.gadget-gremlin.rigged.glb';
const POSE_FILE_NAME = 'gun-hold-draft.json';
const CONTROLLED_BONES = [
  'Spine',
  'Spine01',
  'Spine02',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'neck',
  'Head',
] as const;
const AXES = ['x', 'y', 'z'] as const;

type ControlledBoneName = (typeof CONTROLLED_BONES)[number];
type AxisName = (typeof AXES)[number];
type BonePoseDegrees = Record<AxisName, number>;

interface BoneControl {
  bone: THREE.Bone;
  baseRotation: THREE.Euler;
  inputs: Record<AxisName, HTMLInputElement>;
  values: BonePoseDegrees;
}

export interface PlayerCharacterPoseHarness {
  open: () => void;
  close: () => void;
  resize: (width: number, height: number) => void;
  update: (deltaSeconds: number) => void;
  render: (renderer: THREE.WebGLRenderer) => void;
  dispose: () => void;
}

export function createPlayerCharacterPoseHarness(root: HTMLElement): PlayerCharacterPoseHarness {
  const screen = requireElement<HTMLElement>(root, '[data-character-debug]');
  const controlsRoot = requireElement<HTMLElement>(root, '[data-character-pose-controls]');
  const poseOutput = requireElement<HTMLTextAreaElement>(root, '[data-character-pose-json]');
  const status = requireElement<HTMLElement>(root, '[data-character-pose-status]');
  const saveButton = requireElement<HTMLButtonElement>(root, '[data-character-pose-save]');
  const copyButton = requireElement<HTMLButtonElement>(root, '[data-character-pose-copy]');
  const resetButton = requireElement<HTMLButtonElement>(root, '[data-character-pose-reset]');
  const mirrorButton = requireElement<HTMLButtonElement>(root, '[data-character-pose-mirror]');
  const viewYawInput = requireElement<HTMLInputElement>(root, '[data-character-view-yaw]');
  const viewZoomInput = requireElement<HTMLInputElement>(root, '[data-character-view-zoom]');

  const scene = new THREE.Scene();
  scene.name = 'player-character-pose-harness';
  scene.background = new THREE.Color(0x101418);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  const modelRoot = new THREE.Group();
  modelRoot.name = 'pose-harness-model-root';
  scene.add(modelRoot);

  const lights = createLights();
  scene.add(...lights);

  const grid = new THREE.GridHelper(6, 12, 0x64f2d0, 0x26343a);
  grid.position.y = -0.01;
  scene.add(grid);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 48),
    new THREE.MeshStandardMaterial({
      color: 0x172026,
      roughness: 0.82,
      metalness: 0.18,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);

  const loader = new GLTFLoader();
  const cleanup: Array<() => void> = [];
  const boneControls = new Map<ControlledBoneName, BoneControl>();
  let model: THREE.Object3D | null = null;
  let skeletonHelper: THREE.SkeletonHelper | null = null;
  let loadPromise: Promise<void> | null = null;
  let isOpen = false;
  let cameraTargetY = 0.62;

  const refreshView = (): void => {
    modelRoot.rotation.y = THREE.MathUtils.degToRad(Number(viewYawInput.value));
    const zoom = Number(viewZoomInput.value);
    camera.position.set(0, cameraTargetY, zoom);
    camera.lookAt(0, cameraTargetY, 0);
  };
  addInputListener(viewYawInput, 'input', () => {
    refreshView();
  }, cleanup);
  addInputListener(viewZoomInput, 'input', refreshView, cleanup);

  const ensureLoaded = (): Promise<void> => {
    if (loadPromise) {
      return loadPromise;
    }

    status.textContent = 'LOADING RIG';
    controlsRoot.textContent = '';
    loadPromise = loader
      .loadAsync(publicAssetUrl(MODEL_PATH))
      .then((gltf) => {
        model = gltf.scene;
        model.name = CHARACTER_ASSET_ID;
        model.position.set(0, 0, 0);
        model.rotation.y = 0;
        model.scale.setScalar(1.08);
        normalizeModelMaterials(model);
        modelRoot.add(model);
        frameModel(model, camera, viewZoomInput, (targetY) => {
          cameraTargetY = targetY;
          refreshView();
        });

        skeletonHelper = new THREE.SkeletonHelper(model);
        skeletonHelper.name = 'pose-harness-skeleton';
        skeletonHelper.visible = true;
        scene.add(skeletonHelper);

        buildBoneControls(model, boneControls, controlsRoot, poseOutput);
        updatePoseOutput(boneControls, poseOutput);
        status.textContent = `READY ${boneControls.size} BONES`;
      })
      .catch((error: unknown) => {
        status.textContent = 'RIG LOAD FAILED';
        poseOutput.value = error instanceof Error ? error.message : String(error);
      });

    return loadPromise;
  };

  const resetPose = (): void => {
    for (const control of boneControls.values()) {
      for (const axis of AXES) {
        control.values[axis] = 0;
        control.inputs[axis].value = '0';
      }
      applyBonePose(control);
    }
    updatePoseOutput(boneControls, poseOutput);
    status.textContent = 'POSE RESET';
  };
  addPointerButton(resetButton, resetPose, cleanup);

  const mirrorPose = (): void => {
    for (const side of ['Arm', 'ForeArm', 'Hand', 'Shoulder'] as const) {
      const left = boneControls.get(`Left${side}` as ControlledBoneName);
      const right = boneControls.get(`Right${side}` as ControlledBoneName);
      if (!left || !right) {
        continue;
      }

      right.values.x = left.values.x;
      right.values.y = -left.values.y;
      right.values.z = -left.values.z;
      syncControlInputs(right);
      applyBonePose(right);
    }
    updatePoseOutput(boneControls, poseOutput);
    status.textContent = 'RIGHT SIDE MIRRORED';
  };
  addPointerButton(mirrorButton, mirrorPose, cleanup);

  const savePose = (): void => {
    const poseJson = updatePoseOutput(boneControls, poseOutput);
    window.localStorage.setItem('sigilbreaker.playerPoseDraft', poseJson);
    void postPoseIfAvailable(poseJson).then((savedToRepo) => {
      if (savedToRepo) {
        status.textContent = 'SAVED TO REPO';
        return;
      }

      downloadTextFile(POSE_FILE_NAME, poseJson);
      status.textContent = 'POSE DOWNLOADED';
    });
  };
  addPointerButton(saveButton, savePose, cleanup);

  const copyPose = (): void => {
    const poseJson = updatePoseOutput(boneControls, poseOutput);
    void navigator.clipboard
      ?.writeText(poseJson)
      .then(() => {
        status.textContent = 'POSE COPIED';
      })
      .catch(() => {
        poseOutput.focus();
        poseOutput.select();
        status.textContent = 'POSE SELECTED';
      });
  };
  addPointerButton(copyButton, copyPose, cleanup);

  refreshView();
  updatePoseOutput(boneControls, poseOutput);

  return {
    open: () => {
      isOpen = true;
      screen.setAttribute('aria-hidden', 'false');
      void ensureLoaded();
    },
    close: () => {
      isOpen = false;
      screen.setAttribute('aria-hidden', 'true');
    },
    resize: (width, height) => {
      camera.aspect = Math.max(1, width) / Math.max(1, height);
      camera.updateProjectionMatrix();
      refreshView();
    },
    update: (deltaSeconds) => {
      if (!isOpen) {
        return;
      }

      if (model && boneControls.size === 0) {
        buildBoneControls(model, boneControls, controlsRoot, poseOutput);
      }

      void deltaSeconds;
      refreshView();
      skeletonHelper?.updateMatrixWorld(true);
    },
    render: (renderer) => {
      renderer.render(scene, camera);
    },
    dispose: () => {
      for (const release of cleanup) {
        release();
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          disposeMaterial(object.material);
        }
      });
      skeletonHelper?.geometry.dispose();
      disposeMaterial(skeletonHelper?.material);
    },
  };
}

function createLights(): THREE.Object3D[] {
  const ambient = new THREE.HemisphereLight(0xe7fbff, 0x132024, 2.1);
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(2.5, 4, 3);
  const rim = new THREE.DirectionalLight(0x79ffd7, 2.2);
  rim.position.set(-3, 2, -2);
  return [ambient, key, rim];
}

function buildBoneControls(
  model: THREE.Object3D,
  boneControls: Map<ControlledBoneName, BoneControl>,
  controlsRoot: HTMLElement,
  poseOutput: HTMLTextAreaElement,
): void {
  if (boneControls.size > 0) {
    return;
  }

  const bones = new Map<string, THREE.Bone>();
  model.traverse((object) => {
    if (isBone(object)) {
      bones.set(object.name, object);
    }
  });

  controlsRoot.replaceChildren();
  for (const boneName of CONTROLLED_BONES) {
    const bone = bones.get(boneName);
    if (!bone) {
      continue;
    }

    const control: BoneControl = {
      bone,
      baseRotation: bone.rotation.clone(),
      inputs: {} as Record<AxisName, HTMLInputElement>,
      values: { x: 0, y: 0, z: 0 },
    };
    boneControls.set(boneName, control);
    controlsRoot.appendChild(createBoneControl(boneName, control, boneControls, poseOutput));
  }
}

function createBoneControl(
  boneName: ControlledBoneName,
  control: BoneControl,
  boneControls: Map<ControlledBoneName, BoneControl>,
  poseOutput: HTMLTextAreaElement,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'character-pose__bone';

  const title = document.createElement('div');
  title.className = 'character-pose__bone-title';
  title.textContent = boneName;
  section.appendChild(title);

  for (const axis of AXES) {
    const label = document.createElement('label');
    label.className = 'character-pose__axis';
    const text = document.createElement('span');
    text.textContent = axis.toUpperCase();
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '-180';
    input.max = '180';
    input.step = '1';
    input.value = '0';
    input.dataset.uiControl = '';
    input.dataset.poseAxis = axis;
    const value = document.createElement('output');
    value.textContent = '0';

    input.addEventListener('input', () => {
      control.values[axis] = Number(input.value);
      value.textContent = input.value;
      applyBonePose(control);
      updatePoseOutput(boneControls, poseOutput);
    });

    control.inputs[axis] = input;
    label.append(text, input, value);
    section.appendChild(label);
  }

  return section;
}

function applyBonePose(control: BoneControl): void {
  control.bone.rotation.set(
    control.baseRotation.x + THREE.MathUtils.degToRad(control.values.x),
    control.baseRotation.y + THREE.MathUtils.degToRad(control.values.y),
    control.baseRotation.z + THREE.MathUtils.degToRad(control.values.z),
  );
}

function syncControlInputs(control: BoneControl): void {
  for (const axis of AXES) {
    control.inputs[axis].value = String(Math.round(control.values[axis]));
    const output = control.inputs[axis].parentElement?.querySelector('output');
    if (output) {
      output.textContent = control.inputs[axis].value;
    }
  }
}

function updatePoseOutput(
  boneControls: Map<ControlledBoneName, BoneControl>,
  poseOutput: HTMLTextAreaElement,
): string {
  const rotationsDegrees: Partial<Record<ControlledBoneName, BonePoseDegrees>> = {};
  const rotationsRadians: Partial<Record<ControlledBoneName, BonePoseDegrees>> = {};
  const handWorldPositions: Partial<Record<'left' | 'right', [number, number, number]>> = {};

  for (const [boneName, control] of boneControls) {
    rotationsDegrees[boneName] = { ...control.values };
    rotationsRadians[boneName] = {
      x: roundRadians(THREE.MathUtils.degToRad(control.values.x)),
      y: roundRadians(THREE.MathUtils.degToRad(control.values.y)),
      z: roundRadians(THREE.MathUtils.degToRad(control.values.z)),
    };
    if (boneName === 'LeftHand') {
      handWorldPositions.left = readWorldPosition(control.bone);
    }
    if (boneName === 'RightHand') {
      handWorldPositions.right = readWorldPosition(control.bone);
    }
  }

  const payload = JSON.stringify(
    {
      version: 1,
      assetId: CHARACTER_ASSET_ID,
      modelPath: MODEL_PATH,
      purpose: 'player-gun-hold-still-pose',
      units: {
        rotationsDegrees: 'degrees relative to imported bind pose',
        rotationsRadians: 'radians relative to imported bind pose',
        handWorldPositions: 'Three.js world units',
      },
      rotationsDegrees,
      rotationsRadians,
      handWorldPositions,
    },
    null,
    2,
  );
  poseOutput.value = payload;
  return payload;
}

async function postPoseIfAvailable(poseJson: string): Promise<boolean> {
  try {
    const response = await fetch('/__save_pose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: poseJson,
    });
    return response.ok;
  } catch {
    return false;
  }
}

function downloadTextFile(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeModelMaterials(model: THREE.Object3D): void {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = false;
  });
}

function frameModel(
  model: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  zoomInput: HTMLInputElement,
  setTargetY: (targetY: number) => void,
): void {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= bounds.min.y;

  const normalizedBounds = new THREE.Box3().setFromObject(model);
  normalizedBounds.getSize(size);
  const height = Math.max(size.y, 1);
  const distance = Math.max(3.2, height * 2.15);
  const targetY = height * 0.62;

  zoomInput.min = String(Math.round(distance * 65) / 100);
  zoomInput.max = String(Math.round(distance * 155) / 100);
  zoomInput.value = String(Math.round(distance * 100) / 100);
  setTargetY(targetY);
  camera.near = 0.05;
  camera.far = Math.max(60, distance * 8);
  camera.updateProjectionMatrix();
}

function readWorldPosition(object: THREE.Object3D): [number, number, number] {
  const position = new THREE.Vector3();
  object.getWorldPosition(position);
  return [roundCoordinate(position.x), roundCoordinate(position.y), roundCoordinate(position.z)];
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundRadians(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function addPointerButton(button: HTMLButtonElement, listener: () => void, cleanup: Array<() => void>): void {
  const onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    listener();
  };
  button.addEventListener('pointerdown', onPointerDown);
  cleanup.push(() => button.removeEventListener('pointerdown', onPointerDown));
}

function addInputListener(
  input: HTMLInputElement,
  type: 'input',
  listener: () => void,
  cleanup: Array<() => void>,
): void {
  input.addEventListener(type, listener);
  cleanup.push(() => input.removeEventListener(type, listener));
}

function requireElement<ElementType extends Element>(root: HTMLElement, selector: string): ElementType {
  const element = root.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error(`Missing player pose harness element: ${selector}`);
  }

  return element;
}

function isBone(object: THREE.Object3D): object is THREE.Bone {
  return (object as THREE.Bone).isBone === true;
}

function disposeMaterial(material: THREE.Material | THREE.Material[] | undefined): void {
  if (!material) {
    return;
  }

  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
    return;
  }

  material.dispose();
}
