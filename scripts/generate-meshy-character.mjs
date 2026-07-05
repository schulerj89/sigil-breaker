#!/usr/bin/env node
/* global console, fetch, process, URL */

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const apiBase = 'https://api.meshy.ai';
const manifestPath = process.argv[2];

if (!manifestPath) {
  throw new Error('Usage: node scripts/generate-meshy-character.mjs <manifest.json>');
}

if (!process.env.MESHY_API_KEY) {
  throw new Error('MESHY_API_KEY is required. Use agent-secret with MESHY_API_KEY -- <command>.');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const outputDir = path.resolve(manifest.outputDir);
const modelDir = path.join(outputDir, 'models');
const animationDir = path.join(outputDir, 'animations');
const previewDir = path.join(outputDir, 'previews');
const metadataDir = path.resolve(manifest.metadataDir);
const statePath = path.join(metadataDir, 'run-state.json');

await Promise.all([mkdir(modelDir, { recursive: true }), mkdir(animationDir, { recursive: true }), mkdir(previewDir, { recursive: true }), mkdir(metadataDir, { recursive: true })]);

const state = await readState();

state.previewTask ??= await createTask('text-to-3d preview', manifest.api.textTo3dEndpoint, {
  mode: 'preview',
  prompt: manifest.generation.prompt,
  model_type: manifest.generation.modelType,
  ai_model: manifest.generation.aiModel,
  should_remesh: manifest.generation.shouldRemesh,
  topology: manifest.generation.topology,
  target_polycount: manifest.generation.targetPolycount,
  pose_mode: manifest.generation.poseMode,
  target_formats: manifest.generation.targetFormats,
  moderation: manifest.generation.moderation,
  alpha_thumbnail: manifest.generation.alphaThumbnail,
});
await saveState(state);

const previewTask = await pollTask('text-to-3d preview', `${manifest.api.textTo3dEndpoint}/${state.previewTask.id}`);
state.previewTask = mergeTaskRef(state.previewTask, previewTask);
await writeSanitizedTask('preview-task.json', previewTask);
await saveState(state);
await downloadIfAvailable(previewTask.model_urls?.glb, path.join(modelDir, `${manifest.assetId}.preview.glb`), state, 'previewGlb');
await downloadIfAvailable(previewTask.thumbnail_url, path.join(previewDir, `${manifest.assetId}.preview.png`), state, 'previewThumbnail');
await downloadIfAvailable(previewTask.alpha_thumbnail_url, path.join(previewDir, `${manifest.assetId}.preview-alpha.png`), state, 'previewAlphaThumbnail');

state.refineTask ??= await createTask('text-to-3d refine', manifest.api.textTo3dEndpoint, {
  mode: 'refine',
  preview_task_id: state.previewTask.id,
  texture_prompt: manifest.generation.texturePrompt,
  ai_model: manifest.generation.aiModel,
  enable_pbr: manifest.generation.enablePbr,
  hd_texture: manifest.generation.hdTexture,
  remove_lighting: manifest.generation.removeLighting,
  target_formats: manifest.generation.targetFormats,
  moderation: manifest.generation.moderation,
  alpha_thumbnail: manifest.generation.alphaThumbnail,
});
await saveState(state);

const refineTask = await pollTask('text-to-3d refine', `${manifest.api.textTo3dEndpoint}/${state.refineTask.id}`);
state.refineTask = mergeTaskRef(state.refineTask, refineTask);
await writeSanitizedTask('refine-task.json', refineTask);
await saveState(state);
await downloadIfAvailable(refineTask.model_urls?.glb, path.join(modelDir, `${manifest.assetId}.refined.glb`), state, 'refinedGlb');
await downloadIfAvailable(refineTask.thumbnail_url, path.join(previewDir, `${manifest.assetId}.refined.png`), state, 'refinedThumbnail');
await downloadIfAvailable(refineTask.alpha_thumbnail_url, path.join(previewDir, `${manifest.assetId}.refined-alpha.png`), state, 'refinedAlphaThumbnail');

state.rigTask ??= await createTask('rigging', manifest.api.riggingEndpoint, {
  input_task_id: state.refineTask.id,
  height_meters: manifest.generation.heightMeters,
});
await saveState(state);

const rigTask = await pollTask('rigging', `${manifest.api.riggingEndpoint}/${state.rigTask.id}`);
state.rigTask = mergeTaskRef(state.rigTask, rigTask);
await writeSanitizedTask('rig-task.json', rigTask);
await saveState(state);
await downloadIfAvailable(rigTask.result?.rigged_character_glb_url, path.join(modelDir, `${manifest.assetId}.rigged.glb`), state, 'riggedGlb');
await downloadIfAvailable(rigTask.result?.basic_animations?.walking_glb_url, path.join(animationDir, `${manifest.assetId}.walking.glb`), state, 'walkingAnimationGlb');
await downloadIfAvailable(rigTask.result?.basic_animations?.running_glb_url, path.join(animationDir, `${manifest.assetId}.running.glb`), state, 'runningAnimationGlb');

state.animationTasks ??= {};
for (const animation of manifest.animationRequests) {
  state.animationTasks[animation.id] ??= await createTask(`animation ${animation.id}`, manifest.api.animationEndpoint, {
    rig_task_id: state.rigTask.id,
    action_id: animation.actionId,
  });
  await saveState(state);

  const animationTask = await pollTask(`animation ${animation.id}`, `${manifest.api.animationEndpoint}/${state.animationTasks[animation.id].id}`);
  state.animationTasks[animation.id] = mergeTaskRef(state.animationTasks[animation.id], animationTask);
  await writeSanitizedTask(`animation-${animation.id}-task.json`, animationTask);
  await saveState(state);
  await downloadIfAvailable(
    animationTask.result?.animation_glb_url,
    path.join(animationDir, `${manifest.assetId}.${animation.id}.glb`),
    state,
    `${animation.id}AnimationGlb`,
  );
}

const selectedConceptDestination = path.join(previewDir, `${manifest.assetId}.selected-concept.png`);
if (manifest.selectedConcept && existsSync(path.resolve(manifest.selectedConcept)) && !existsSync(selectedConceptDestination)) {
  await copyFile(path.resolve(manifest.selectedConcept), selectedConceptDestination);
}

const summary = {
  metadataVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  assetId: manifest.assetId,
  sourceId: manifest.sourceId,
  provider: manifest.provider,
  aiModel: manifest.generation.aiModel,
  selectedConcept: manifest.selectedConcept,
  prompt: manifest.generation.prompt,
  texturePrompt: manifest.generation.texturePrompt,
  settings: {
    modelType: manifest.generation.modelType,
    shouldRemesh: manifest.generation.shouldRemesh,
    topology: manifest.generation.topology,
    targetPolycount: manifest.generation.targetPolycount,
    poseMode: manifest.generation.poseMode,
    heightMeters: manifest.generation.heightMeters,
    enablePbr: manifest.generation.enablePbr,
    hdTexture: manifest.generation.hdTexture,
    removeLighting: manifest.generation.removeLighting,
    targetFormats: manifest.generation.targetFormats,
  },
  tasks: {
    preview: summarizeTask(state.previewTask),
    refine: summarizeTask(state.refineTask),
    rig: summarizeTask(state.rigTask),
    animations: Object.fromEntries(Object.entries(state.animationTasks ?? {}).map(([id, task]) => [id, summarizeTask(task)])),
  },
  downloads: state.downloads ?? {},
  animationRequests: manifest.animationRequests,
  budgets: manifest.budgets,
  docs: {
    textTo3d: 'https://docs.meshy.ai/en/api/text-to-3d',
    rigging: 'https://docs.meshy.ai/en/api/rigging',
    animation: 'https://docs.meshy.ai/en/api/animation',
    animationLibrary: 'https://docs.meshy.ai/en/api/animation-library',
  },
};

await writeJson(path.join(metadataDir, 'summary.json'), summary);
await writeJson(path.join(outputDir, 'source.json'), {
  sourceId: manifest.sourceId,
  provider: manifest.provider,
  assetId: manifest.assetId,
  generatedAt: summary.generatedAt,
  modelId: manifest.generation.aiModel,
  selectedConcept: manifest.selectedConcept,
  meshyDocs: summary.docs,
  runtimeFiles: Object.values(state.downloads ?? {})
    .filter((download) => download.path.startsWith('public/assets/characters/'))
    .map((download) => download.path),
  notes: [
    'Generated through the local secret broker; no API keys are stored in this metadata.',
    'Meshy output URLs are intentionally not stored because they expire and can include account-scoped paths.',
    'Character is staged for asset playground QA before gameplay integration.',
  ],
});

console.log(`Meshy character generation complete: ${manifest.assetId}`);
console.log(`Runtime assets: ${manifest.outputDir}`);
console.log(`Metadata: ${manifest.metadataDir}`);

async function createTask(label, endpoint, payload) {
  console.log(`Creating ${label} task...`);
  const response = await fetchJson(`${apiBase}${endpoint}`, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.result) {
    throw new Error(`${label} did not return a result id.`);
  }

  return { id: response.result, createdByRunnerAt: new Date().toISOString() };
}

async function pollTask(label, endpoint) {
  const timeoutAt = Date.now() + 25 * 60 * 1000;
  let lastStatus = '';

  while (Date.now() < timeoutAt) {
    const task = await fetchJson(`${apiBase}${endpoint}`, { headers: requestHeaders() });
    const status = `${task.status ?? 'UNKNOWN'} ${task.progress ?? 0}%`;
    if (status !== lastStatus) {
      console.log(`${label}: ${status}`);
      lastStatus = status;
    }

    if (task.status === 'SUCCEEDED') {
      return task;
    }

    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      await writeSanitizedTask(`${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-failed-task.json`, task);
      throw new Error(`${label} ${task.status}: ${task.task_error?.message ?? 'unknown error'}`);
    }

    await delay(5000);
  }

  throw new Error(`${label} did not finish before timeout.`);
}

async function downloadIfAvailable(url, outPath, runState, key) {
  if (!url) {
    return;
  }

  runState.downloads ??= {};
  if (runState.downloads[key]?.sha256 && existsSync(outPath)) {
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${key}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, buffer);
  runState.downloads[key] = {
    path: toRepoPath(outPath),
    bytes: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
  await saveState(runState);
  console.log(`Downloaded ${key}: ${runState.downloads[key].path} (${buffer.byteLength}B)`);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Meshy API ${response.status} ${response.statusText}: ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

function requestHeaders() {
  return {
    Authorization: `Bearer ${process.env.MESHY_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function readState() {
  if (!existsSync(statePath)) {
    return {};
  }

  return JSON.parse(await readFile(statePath, 'utf8'));
}

async function saveState(runState) {
  await writeJson(statePath, runState);
}

async function writeSanitizedTask(fileName, task) {
  await writeJson(path.join(metadataDir, fileName), sanitizeTask(task));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sanitizeTask(task) {
  if (Array.isArray(task)) {
    return task.map((item) => sanitizeTask(item));
  }

  if (!task || typeof task !== 'object') {
    return task;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(task)) {
    if (key.endsWith('_url') || key.endsWith('_urls') || key === 'model_urls' || key === 'texture_urls') {
      sanitized[key] = summarizeUrls(value);
    } else if (key === 'result' && value && typeof value === 'object') {
      sanitized[key] = sanitizeTask(value);
    } else {
      sanitized[key] = sanitizeTask(value);
    }
  }

  return sanitized;
}

function summarizeUrls(value) {
  if (typeof value === 'string') {
    if (value.length === 0) {
      return '';
    }

    return new URL(value).pathname.split('/').pop() ?? 'url-redacted';
  }

  if (Array.isArray(value)) {
    return value.map((item) => summarizeUrls(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, summarizeUrls(nested)]));
}

function summarizeTask(task) {
  if (!task) {
    return null;
  }

  return {
    id: task.id,
    type: task.type,
    status: task.status,
    progress: task.progress,
    consumedCredits: task.consumed_credits,
    createdAt: task.created_at,
    startedAt: task.started_at,
    finishedAt: task.finished_at,
    expiresAt: task.expires_at,
    taskError: task.task_error,
  };
}

function mergeTaskRef(existing, task) {
  return {
    ...existing,
    id: task.id,
    type: task.type,
    status: task.status,
    progress: task.progress,
    consumed_credits: task.consumed_credits,
    created_at: task.created_at,
    started_at: task.started_at,
    finished_at: task.finished_at,
    expires_at: task.expires_at,
    task_error: task.task_error,
  };
}

function toRepoPath(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replaceAll(path.sep, '/');
}
