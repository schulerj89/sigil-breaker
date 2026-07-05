import * as THREE from 'three';
import {
  PLAYER_CHARACTER_ASSET,
  clonePlayerCharacterScene,
  loadPlayerCharacterGltf,
} from './playerCharacterAsset';

const CHARACTER_ASSET_ID = PLAYER_CHARACTER_ASSET.id;
const MODEL_PATH = PLAYER_CHARACTER_ASSET.modelPath;
const POSE_FILE_NAME = 'gun-hold-draft.json';
const POSE_EDIT_ANIMATION_ID = 'pose-edit';
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
const ANIMATION_DEFINITIONS = [
  { id: POSE_EDIT_ANIMATION_ID, label: 'Pose Edit', clipName: null },
  { id: 'idle', label: 'Idle', clipName: 'idle' },
  { id: 'idle-alt', label: 'Idle Alt', clipName: 'idle-alt' },
  { id: 'walking', label: 'Walking', clipName: 'walking' },
  { id: 'running', label: 'Running', clipName: 'running' },
  { id: 'run-and-shoot', label: 'Run + Shoot', clipName: 'run-and-shoot' },
  { id: 'gun-hold', label: 'Gun Hold', clipName: 'gun-hold' },
  { id: 'low-health', label: 'Low Health', clipName: 'low-health' },
  { id: 'out-of-hp', label: 'Out Of HP', clipName: 'out-of-hp' },
  { id: 'victory', label: 'Victory', clipName: 'victory' },
  { id: 'dance', label: 'Dance', clipName: 'dance' },
] as const;

type ControlledBoneName = (typeof CONTROLLED_BONES)[number];
type AxisName = (typeof AXES)[number];
type AnimationId = (typeof ANIMATION_DEFINITIONS)[number]['id'];
type BonePoseDegrees = Record<AxisName, number>;

interface BoneControl {
  bone: THREE.Bone;
  baseRotation: THREE.Euler;
  inputs: Record<AxisName, HTMLInputElement>;
  outputs: Record<AxisName, HTMLOutputElement>;
  element: HTMLElement;
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
  const animationSelect = requireElement<HTMLSelectElement>(root, '[data-character-animation-select]');
  const boneSelect = requireElement<HTMLSelectElement>(root, '[data-character-bone-select]');
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

  const cleanup: Array<() => void> = [];
  const boneControls = new Map<ControlledBoneName, BoneControl>();
  const baseBoneRotations = new Map<THREE.Bone, THREE.Euler>();
  const animationClips = new Map<AnimationId, THREE.AnimationClip>();
  let model: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let activeAction: THREE.AnimationAction | null = null;
  let activeAnimationId: AnimationId = POSE_EDIT_ANIMATION_ID;
  let skeletonHelper: THREE.SkeletonHelper | null = null;
  let loadPromise: Promise<void> | null = null;
  let isOpen = false;
  let cameraTargetY = 0.62;
  let viewPointerId: number | null = null;
  let lastViewPointerX = 0;
  let lastViewPointerY = 0;

  const refreshView = (): void => {
    modelRoot.rotation.y = THREE.MathUtils.degToRad(Number(viewYawInput.value));
    const zoom = Number(viewZoomInput.value);
    camera.position.set(0, cameraTargetY, zoom);
    camera.lookAt(0, cameraTargetY, 0);
  };
  const adjustViewYaw = (deltaDegrees: number): void => {
    adjustRangeInput(viewYawInput, deltaDegrees);
    refreshView();
  };
  const adjustViewZoom = (deltaUnits: number): void => {
    adjustRangeInput(viewZoomInput, deltaUnits);
    refreshView();
  };
  addInputListener(viewYawInput, 'input', () => {
    refreshView();
  }, cleanup);
  addInputListener(viewZoomInput, 'input', refreshView, cleanup);
  populateAnimationSelect(animationSelect);
  addChangeListener(animationSelect, () => {
    void playAnimation(animationSelect.value as AnimationId);
  }, cleanup);
  addChangeListener(boneSelect, () => {
    setActiveBone(boneControls, boneSelect.value as ControlledBoneName);
  }, cleanup);
  addPointerListener(screen, 'pointerdown', (event) => {
    if (!isOpen || shouldIgnoreSceneDrag(event.target)) {
      return;
    }

    viewPointerId = event.pointerId;
    lastViewPointerX = event.clientX;
    lastViewPointerY = event.clientY;
    screen.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, cleanup);
  addPointerListener(screen, 'pointermove', (event) => {
    if (!isOpen || event.pointerId !== viewPointerId) {
      return;
    }

    const deltaX = event.clientX - lastViewPointerX;
    const deltaY = event.clientY - lastViewPointerY;
    lastViewPointerX = event.clientX;
    lastViewPointerY = event.clientY;
    adjustViewYaw(deltaX * 0.45);
    adjustViewZoom(deltaY * 0.015);
    event.preventDefault();
  }, cleanup);
  addPointerListener(screen, 'pointerup', (event) => {
    if (event.pointerId !== viewPointerId) {
      return;
    }

    viewPointerId = null;
    if (screen.hasPointerCapture(event.pointerId)) {
      screen.releasePointerCapture(event.pointerId);
    }
    event.preventDefault();
  }, cleanup);
  addPointerListener(screen, 'pointercancel', (event) => {
    if (event.pointerId !== viewPointerId) {
      return;
    }

    viewPointerId = null;
    if (screen.hasPointerCapture(event.pointerId)) {
      screen.releasePointerCapture(event.pointerId);
    }
  }, cleanup);

  const ensureLoaded = (): Promise<void> => {
    if (loadPromise) {
      return loadPromise;
    }

    status.textContent = 'LOADING RIG';
    controlsRoot.textContent = '';
    loadPromise = loadPlayerCharacterGltf()
      .then((gltf) => {
        model = clonePlayerCharacterScene(gltf.scene);
        model.name = CHARACTER_ASSET_ID;
        model.position.set(0, 0, 0);
        model.rotation.y = 0;
        model.scale.setScalar(1.08);
        normalizeModelMaterials(model);
        modelRoot.add(model);
        cacheEmbeddedAnimationClips(gltf.animations, animationClips);
        captureBaseBoneRotations(model, baseBoneRotations);
        mixer = new THREE.AnimationMixer(model);
        frameModel(model, camera, viewZoomInput, (targetY) => {
          cameraTargetY = targetY;
          refreshView();
        });

        skeletonHelper = new THREE.SkeletonHelper(model);
        skeletonHelper.name = 'pose-harness-skeleton';
        skeletonHelper.visible = true;
        scene.add(skeletonHelper);

        buildBoneControls(model, boneControls, controlsRoot, poseOutput, () => {
          if (animationSelect.value !== POSE_EDIT_ANIMATION_ID) {
            animationSelect.value = POSE_EDIT_ANIMATION_ID;
            void playAnimation(POSE_EDIT_ANIMATION_ID);
          }
        });
        populateBoneSelect(boneSelect, boneControls);
        setActiveBone(boneControls, boneSelect.value as ControlledBoneName);
        updatePoseOutput(boneControls, poseOutput, activeAnimationId);
        status.textContent = `READY ${boneControls.size} BONES`;
      })
      .catch((error: unknown) => {
        status.textContent = 'RIG LOAD FAILED';
        poseOutput.value = error instanceof Error ? error.message : String(error);
      });

    return loadPromise;
  };

  const resetPose = (): void => {
    stopActiveAnimation();
    activeAnimationId = POSE_EDIT_ANIMATION_ID;
    animationSelect.value = POSE_EDIT_ANIMATION_ID;
    resetSkeletonToBasePose(baseBoneRotations);
    for (const control of boneControls.values()) {
      for (const axis of AXES) {
        control.values[axis] = 0;
        control.inputs[axis].value = '0';
        control.outputs[axis].textContent = '0';
      }
      applyBonePose(control);
    }
    updatePoseOutput(boneControls, poseOutput, activeAnimationId);
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
    updatePoseOutput(boneControls, poseOutput, activeAnimationId);
    status.textContent = 'RIGHT SIDE MIRRORED';
  };
  addPointerButton(mirrorButton, mirrorPose, cleanup);

  const savePose = (): void => {
    const poseJson = updatePoseOutput(boneControls, poseOutput, activeAnimationId);
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
    const poseJson = updatePoseOutput(boneControls, poseOutput, activeAnimationId);
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
  updatePoseOutput(boneControls, poseOutput, activeAnimationId);

  async function playAnimation(animationId: AnimationId): Promise<void> {
    activeAnimationId = animationId;
    if (!model || !mixer) {
      return;
    }

    if (animationId === POSE_EDIT_ANIMATION_ID) {
      stopActiveAnimation();
      resetSkeletonToBasePose(baseBoneRotations);
      applyAllBonePoses(boneControls);
      updatePoseOutput(boneControls, poseOutput, activeAnimationId);
      status.textContent = 'POSE EDIT';
      return;
    }

    const animationDefinition = ANIMATION_DEFINITIONS.find((definition) => definition.id === animationId);
    if (!animationDefinition?.clipName) {
      return;
    }

    status.textContent = `ANIM ${animationDefinition.label.toUpperCase()}`;
    try {
      const clip = getAnimationClip(animationDefinition.id, animationClips);

      stopActiveAnimation();
      activeAction = mixer.clipAction(clip, model);
      activeAction.reset();
      activeAction.setLoop(THREE.LoopRepeat, Infinity);
      activeAction.fadeIn(0.12);
      activeAction.play();
      updatePoseOutput(boneControls, poseOutput, activeAnimationId);
      status.textContent = `ANIM ${animationDefinition.label.toUpperCase()}`;
    } catch (error: unknown) {
      status.textContent = 'ANIM LOAD FAILED';
      poseOutput.value = error instanceof Error ? error.message : String(error);
    }
  }

  function stopActiveAnimation(): void {
    activeAction?.stop();
    activeAction = null;
    mixer?.stopAllAction();
  }

  return {
    open: () => {
      isOpen = true;
      screen.setAttribute('aria-hidden', 'false');
      void ensureLoaded();
    },
    close: () => {
      isOpen = false;
      viewPointerId = null;
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
        buildBoneControls(model, boneControls, controlsRoot, poseOutput, () => {
          if (animationSelect.value !== POSE_EDIT_ANIMATION_ID) {
            animationSelect.value = POSE_EDIT_ANIMATION_ID;
            void playAnimation(POSE_EDIT_ANIMATION_ID);
          }
        });
        populateBoneSelect(boneSelect, boneControls);
        setActiveBone(boneControls, boneSelect.value as ControlledBoneName);
      }

      if (activeAnimationId !== POSE_EDIT_ANIMATION_ID) {
        mixer?.update(deltaSeconds);
      }
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

function shouldIgnoreSceneDrag(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('[data-ui-control], .character-debug__panel, .character-debug__topbar'))
  );
}

function adjustRangeInput(input: HTMLInputElement, delta: number): number {
  const min = Number(input.min);
  const max = Number(input.max);
  const nextValue = THREE.MathUtils.clamp(Number(input.value) + delta, min, max);
  input.value = String(Math.round(nextValue * 100) / 100);
  return nextValue;
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
  onManualPoseEdit: () => void,
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
      outputs: {} as Record<AxisName, HTMLOutputElement>,
      element: document.createElement('section'),
      values: { x: 0, y: 0, z: 0 },
    };
    boneControls.set(boneName, control);
    controlsRoot.appendChild(createBoneControl(boneName, control, boneControls, poseOutput, onManualPoseEdit));
  }
}

function createBoneControl(
  boneName: ControlledBoneName,
  control: BoneControl,
  boneControls: Map<ControlledBoneName, BoneControl>,
  poseOutput: HTMLTextAreaElement,
  onManualPoseEdit: () => void,
): HTMLElement {
  const section = control.element;
  section.className = 'character-pose__bone';
  section.dataset.poseBone = boneName;

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
      onManualPoseEdit();
      control.values[axis] = Number(input.value);
      value.textContent = input.value;
      applyBonePose(control);
      updatePoseOutput(boneControls, poseOutput, POSE_EDIT_ANIMATION_ID);
    });

    control.inputs[axis] = input;
    control.outputs[axis] = value;
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
    control.outputs[axis].textContent = control.inputs[axis].value;
  }
}

function updatePoseOutput(
  boneControls: Map<ControlledBoneName, BoneControl>,
  poseOutput: HTMLTextAreaElement,
  activeAnimationId: AnimationId,
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
      activeAnimationId,
      activeAnimationLabel: ANIMATION_DEFINITIONS.find((definition) => definition.id === activeAnimationId)?.label ?? activeAnimationId,
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

function cacheEmbeddedAnimationClips(
  clips: THREE.AnimationClip[],
  animationClips: Map<AnimationId, THREE.AnimationClip>,
): void {
  for (const definition of ANIMATION_DEFINITIONS) {
    if (!definition.clipName) {
      continue;
    }

    const clip = clips.find((candidate) => candidate.name === definition.clipName);
    if (clip) {
      animationClips.set(definition.id, clip);
    }
  }
}

function getAnimationClip(
  animationId: AnimationId,
  animationClips: Map<AnimationId, THREE.AnimationClip>,
): THREE.AnimationClip {
  const cachedClip = animationClips.get(animationId);
  if (cachedClip) {
    return cachedClip;
  }

  throw new Error(`Combined character GLB did not include animation clip: ${animationId}`);
}

function populateAnimationSelect(animationSelect: HTMLSelectElement): void {
  animationSelect.replaceChildren();
  for (const definition of ANIMATION_DEFINITIONS) {
    const option = document.createElement('option');
    option.value = definition.id;
    option.textContent = definition.label;
    animationSelect.appendChild(option);
  }
  animationSelect.value = POSE_EDIT_ANIMATION_ID;
}

function populateBoneSelect(
  boneSelect: HTMLSelectElement,
  boneControls: Map<ControlledBoneName, BoneControl>,
): void {
  boneSelect.replaceChildren();
  for (const boneName of boneControls.keys()) {
    const option = document.createElement('option');
    option.value = boneName;
    option.textContent = boneName;
    boneSelect.appendChild(option);
  }
  boneSelect.value = boneControls.has('RightArm') ? 'RightArm' : [...boneControls.keys()][0] ?? '';
}

function setActiveBone(
  boneControls: Map<ControlledBoneName, BoneControl>,
  activeBoneName: ControlledBoneName,
): void {
  for (const [boneName, control] of boneControls) {
    control.element.classList.toggle('is-active', boneName === activeBoneName);
  }
}

function applyAllBonePoses(boneControls: Map<ControlledBoneName, BoneControl>): void {
  for (const control of boneControls.values()) {
    applyBonePose(control);
  }
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

function captureBaseBoneRotations(model: THREE.Object3D, baseBoneRotations: Map<THREE.Bone, THREE.Euler>): void {
  baseBoneRotations.clear();
  model.traverse((object) => {
    if (isBone(object)) {
      baseBoneRotations.set(object, object.rotation.clone());
    }
  });
}

function resetSkeletonToBasePose(baseBoneRotations: Map<THREE.Bone, THREE.Euler>): void {
  for (const [bone, rotation] of baseBoneRotations) {
    bone.rotation.copy(rotation);
  }
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

function addPointerListener(
  element: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  listener: (event: PointerEvent) => void,
  cleanup: Array<() => void>,
): void {
  element.addEventListener(type, listener);
  cleanup.push(() => element.removeEventListener(type, listener));
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

function addChangeListener(
  select: HTMLSelectElement,
  listener: () => void,
  cleanup: Array<() => void>,
): void {
  select.addEventListener('change', listener);
  cleanup.push(() => select.removeEventListener('change', listener));
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
