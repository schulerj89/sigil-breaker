#!/usr/bin/env node
/* global console */

import { copyFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const distRoot = path.join(repoRoot, 'dist');
const characterRoot = path.join(distRoot, 'assets', 'characters', 'meshy-gadget-gremlin');

const removals = [
  path.join(characterRoot, 'animations'),
  path.join(characterRoot, 'previews'),
  path.join(characterRoot, 'models', 'player.hero.gadget-gremlin.preview.glb'),
  path.join(characterRoot, 'models', 'player.hero.gadget-gremlin.refined.glb'),
  path.join(characterRoot, 'models', 'player.hero.gadget-gremlin.rigged.glb'),
];

await expectFile(path.join(distRoot, 'index.html'));
await writeFile(path.join(distRoot, '.nojekyll'), '');
await copyFile(path.join(distRoot, 'index.html'), path.join(distRoot, '404.html'));

let prunedBytes = 0;
for (const target of removals) {
  prunedBytes += await byteSize(target);
  await rm(target, { force: true, recursive: true });
}

const totalBytes = await byteSize(distRoot);
console.log(
  [
    'Prepared GitHub Pages dist',
    `${prunedBytes}B pruned source-only character assets`,
    `${totalBytes}B remaining`,
  ].join(' | '),
);

async function expectFile(filePath) {
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      return;
    }
  } catch {
    // Report a clear build-order problem below.
  }

  throw new Error(`Missing required Pages file: ${path.relative(repoRoot, filePath)}`);
}

async function byteSize(target) {
  try {
    const targetStat = await stat(target);
    if (targetStat.isFile()) {
      return targetStat.size;
    }
    if (!targetStat.isDirectory()) {
      return 0;
    }
  } catch {
    return 0;
  }

  const entries = await readdir(target, { withFileTypes: true });
  const childSizes = await Promise.all(entries.map((entry) => byteSize(path.join(target, entry.name))));
  return childSizes.reduce((total, size) => total + size, 0);
}
