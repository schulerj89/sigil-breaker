#!/usr/bin/env node
/* global console, process */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { copyToDocument, dedup, prune, unpartition } from '@gltf-transform/functions';

const manifestPath = process.argv[2];

if (!manifestPath) {
  throw new Error('Usage: node scripts/combine-meshy-character-clips.mjs <manifest.json>');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const outputDir = path.resolve(manifest.outputDir);
const modelDir = path.join(outputDir, 'models');
const animationDir = path.join(outputDir, 'animations');
const metadataDir = path.resolve(manifest.metadataDir);
const assetId = manifest.assetId;
const runtimeFileName = manifest.runtime?.combinedFileName ?? `${assetId}.animated.glb`;
const runtimePath = path.join(modelDir, runtimeFileName);
const io = new NodeIO();

const basePath = path.join(modelDir, `${assetId}.rigged.glb`);
const baseDoc = await io.read(basePath);
const root = baseDoc.getRoot();
const targetNodes = new Map(root.listNodes().map((node) => [node.getName(), node]));
const clipReports = [];

for (const animation of root.listAnimations()) {
  animation.dispose();
}

for (const clip of collectClipSources()) {
  const report = await copyClipToBase(clip);
  clipReports.push(report);
  if (report.copiedChannels === 0) {
    throw new Error(`Animation ${clip.id} copied no channels from ${clip.path}`);
  }
}

await baseDoc.transform(dedup(), unpartition(), prune());
await mkdir(modelDir, { recursive: true });
await io.write(runtimePath, baseDoc);

const runtimeBuffer = await readFile(runtimePath);
const summary = {
  metadataVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  assetId,
  sourceId: manifest.sourceId,
  sourceManifest: path.relative(process.cwd(), path.resolve(manifestPath)).replaceAll(path.sep, '/'),
  baseModel: toRepoPath(basePath),
  runtimeModel: toRepoPath(runtimePath),
  runtimeBytes: runtimeBuffer.byteLength,
  runtimeSha256: createHash('sha256').update(runtimeBuffer).digest('hex'),
  clips: clipReports,
};

await mkdir(metadataDir, { recursive: true });
await writeFile(path.join(metadataDir, 'combined-runtime.json'), `${JSON.stringify(summary, null, 2)}\n`);

console.log(`Combined runtime GLB: ${summary.runtimeModel}`);
console.log(`Animations: ${clipReports.map((clip) => clip.id).join(', ')}`);
console.log(`Bytes: ${summary.runtimeBytes}`);

function collectClipSources() {
  const clips = [];

  for (const basic of manifest.runtime?.basicAnimationClips ?? []) {
    clips.push({
      id: basic.id,
      label: basic.label ?? basic.id,
      path: path.join(animationDir, `${assetId}.${basic.source}.glb`),
    });
  }

  for (const request of manifest.animationRequests ?? []) {
    clips.push({
      id: request.id,
      label: request.label ?? request.name ?? request.id,
      path: path.join(animationDir, `${assetId}.${request.id}.glb`),
    });
  }

  const seenIds = new Set();
  return clips.filter((clip) => {
    if (seenIds.has(clip.id)) {
      return false;
    }
    seenIds.add(clip.id);
    return true;
  });
}

async function copyClipToBase(clip) {
  const sourceDoc = await io.read(clip.path);
  const [sourceAnimation] = sourceDoc.getRoot().listAnimations();
  if (!sourceAnimation) {
    throw new Error(`No animation clips found in ${clip.path}`);
  }

  const targetAnimation = baseDoc.createAnimation(clip.id);
  const samplerMap = new Map();
  let copiedChannels = 0;
  let skippedChannels = 0;

  for (const sourceSampler of sourceAnimation.listSamplers()) {
    const propertyMap = copyToDocument(
      baseDoc,
      sourceDoc,
      [sourceSampler.getInput(), sourceSampler.getOutput()].filter(Boolean),
    );
    const input = propertyMap.get(sourceSampler.getInput());
    const output = propertyMap.get(sourceSampler.getOutput());
    const targetSampler = baseDoc
      .createAnimationSampler()
      .setInput(input)
      .setOutput(output)
      .setInterpolation(sourceSampler.getInterpolation());
    targetAnimation.addSampler(targetSampler);
    samplerMap.set(sourceSampler, targetSampler);
  }

  for (const sourceChannel of sourceAnimation.listChannels()) {
    const sourceNode = sourceChannel.getTargetNode();
    const targetNode = sourceNode ? targetNodes.get(sourceNode.getName()) : null;
    const targetSampler = samplerMap.get(sourceChannel.getSampler());
    if (!targetNode || !targetSampler) {
      skippedChannels++;
      continue;
    }

    targetAnimation.addChannel(
      baseDoc
        .createAnimationChannel()
        .setTargetNode(targetNode)
        .setTargetPath(sourceChannel.getTargetPath())
        .setSampler(targetSampler),
    );
    copiedChannels++;
  }

  return {
    id: clip.id,
    label: clip.label,
    sourcePath: toRepoPath(clip.path),
    sourceClipName: sourceAnimation.getName(),
    copiedChannels,
    skippedChannels,
    durationSeconds: Math.max(
      ...targetAnimation
        .listSamplers()
        .map((sampler) => sampler.getInput()?.getMax([])?.[0] ?? 0),
    ),
  };
}

function toRepoPath(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replaceAll(path.sep, '/');
}
