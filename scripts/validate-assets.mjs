#!/usr/bin/env node
/* global console, process */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const ledgerPath = path.join(repoRoot, 'docs', 'assets', 'source-ledger.json');
const maxInitialWeaponPayloadBytes = 1_000_000;
const maxInitialEnvironmentPayloadBytes = 1_000_000;
const maxInitialAudioPayloadBytes = 5_000_000;
const generatedProvidersWithOutputTerms = new Set(['ElevenLabs', 'OpenAI']);
const execFileAsync = promisify(execFile);

const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
const result = await validateAssetLedger(ledger);

if (result.errors.length > 0) {
  console.error(`Asset QA failed for ${ledgerPath}`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    [
      'Asset QA passed',
      `${result.sources} source(s)`,
      `${result.assets} asset(s)`,
      `${result.levelOneWeaponBytes}B level-01 weapon payload`,
      `${result.foundationEnvironmentBytes}B foundation environment payload`,
      `${result.foundationAudioBytes}B foundation audio payload`,
    ].join(' | '),
  );
}

async function validateAssetLedger(assetLedger) {
  const errors = [];
  const assetIds = new Set();
  let assetCount = 0;
  let levelOneWeaponBytes = 0;
  let foundationEnvironmentBytes = 0;
  let foundationAudioBytes = 0;

  if (!Array.isArray(assetLedger.sources)) {
    return {
      errors: ['Ledger must include a sources array.'],
      sources: 0,
      assets: 0,
      levelOneWeaponBytes: 0,
      foundationEnvironmentBytes: 0,
      foundationAudioBytes: 0,
    };
  }

  for (const source of assetLedger.sources) {
    if (!source.sourceId || typeof source.sourceId !== 'string') {
      errors.push('Source is missing a sourceId.');
    }
    const isGeneratedSource = source.generated === true;
    const sourceProvider = typeof source.provider === 'string' ? source.provider : '';
    if (isGeneratedSource && !generatedProvidersWithOutputTerms.has(sourceProvider)) {
      errors.push(`${source.sourceId} generated source must use an approved generated provider.`);
    }
    if (!isGeneratedSource && source.license !== 'Creative Commons Zero, CC0') {
      errors.push(`${source.sourceId} must be CC0 for the current external asset intake gate.`);
    }
    if (source.attributionRequired !== false) {
      errors.push(`${source.sourceId} must not require attribution for MVP assets.`);
    }
    if (source.commercialUseAllowed !== true || source.redistributionAllowed !== true) {
      errors.push(`${source.sourceId} must allow commercial use and redistribution.`);
    }
    if (isGeneratedSource && (!source.licenseUrl || typeof source.licenseUrl !== 'string')) {
      errors.push(`${source.sourceId} generated source must include a provider terms URL.`);
    }

    if (isGeneratedSource) {
      await expectCommittedFile(source.metadataFile, errors, `${source.sourceId} metadata file`);
    } else {
      await expectCommittedFile(source.licenseFile, errors, `${source.sourceId} license file`);
    }

    for (const sharedFile of source.sharedFiles ?? []) {
      if (sharedFile.gameUse === 'weapon' && sharedFile.loadGroup === 'level-01-weapons') {
        levelOneWeaponBytes += Number(sharedFile.bytes) || 0;
      }
      if (sharedFile.gameUse === 'environment' && sharedFile.loadGroup === 'foundation-environment') {
        foundationEnvironmentBytes += Number(sharedFile.bytes) || 0;
      }
      if (sharedFile.gameUse === 'audio' && sharedFile.loadGroup === 'foundation-audio') {
        foundationAudioBytes += Number(sharedFile.bytes) || 0;
      }

      await expectCommittedFile(sharedFile.path, errors, `${source.sourceId} shared file`);
      await expectHash(sharedFile.path, sharedFile.sha256, errors, `${source.sourceId} shared file`);
      await expectByteSize(sharedFile.path, sharedFile.bytes, errors, `${source.sourceId} shared file`);
    }

    if (!Array.isArray(source.assets)) {
      errors.push(`${source.sourceId} must include an assets array.`);
      continue;
    }

    if (source.assets.length === 0 && (source.sharedFiles ?? []).length === 0) {
      errors.push(`${source.sourceId} must list at least one selected asset or shared file.`);
    }

    for (const asset of source.assets) {
      assetCount++;
      if (assetIds.has(asset.assetId)) {
        errors.push(`Duplicate assetId ${asset.assetId}.`);
      }
      assetIds.add(asset.assetId);

      if (asset.gameUse === 'weapon' && asset.loadGroup === 'level-01-weapons') {
        levelOneWeaponBytes += Number(asset.bytes) || 0;
      }
      if (asset.gameUse === 'environment' && asset.loadGroup === 'foundation-environment') {
        foundationEnvironmentBytes += Number(asset.bytes) || 0;
      }
      if (asset.gameUse === 'audio' && asset.loadGroup === 'foundation-audio') {
        foundationAudioBytes += Number(asset.bytes) || 0;
      }

      await expectCommittedFile(asset.path, errors, `${asset.assetId} file`);
      await expectHash(asset.path, asset.sha256, errors, `${asset.assetId} file`);
      await expectByteSize(asset.path, asset.bytes, errors, `${asset.assetId} file`);

      if (asset.assetType === 'texture') {
        if (asset.sourceSha256 !== asset.sha256) {
          errors.push(`${asset.assetId} sourceSha256 must match sha256 for unmodified copied textures.`);
        }
        if (asset.optimizedSha256 !== asset.sha256) {
          errors.push(`${asset.assetId} optimizedSha256 must match sha256 for the committed texture.`);
        }
        continue;
      }

      if (asset.assetType === 'audio') {
        if (asset.provider !== 'ElevenLabs') {
          errors.push(`${asset.assetId} audio provider must be ElevenLabs for generated MVP audio.`);
        }
        if (!asset.prompt || typeof asset.prompt !== 'string') {
          errors.push(`${asset.assetId} must include the generation prompt.`);
        }
        if (!asset.modelId || typeof asset.modelId !== 'string') {
          errors.push(`${asset.assetId} must include an ElevenLabs modelId.`);
        }
        if (!asset.settings || typeof asset.settings !== 'object') {
          errors.push(`${asset.assetId} must include generation settings.`);
        }
        if (!asset.generatedAt || typeof asset.generatedAt !== 'string') {
          errors.push(`${asset.assetId} must include generatedAt.`);
        }
        if (typeof asset.durationSeconds !== 'number' || asset.durationSeconds <= 0) {
          errors.push(`${asset.assetId} must include a positive durationSeconds value.`);
        }
        if (typeof asset.loopable !== 'boolean') {
          errors.push(`${asset.assetId} must include a loopable boolean.`);
        }
        if (typeof asset.lufsTarget !== 'number') {
          errors.push(`${asset.assetId} must include a lufsTarget number.`);
        }
        continue;
      }

      if (asset.assetType === 'image') {
        if (asset.provider !== 'OpenAI') {
          errors.push(`${asset.assetId} generated image provider must be OpenAI.`);
        }
        if (!asset.prompt || typeof asset.prompt !== 'string') {
          errors.push(`${asset.assetId} must include the generation prompt.`);
        }
        if (!asset.modelId || typeof asset.modelId !== 'string') {
          errors.push(`${asset.assetId} must include the OpenAI image modelId.`);
        }
        if (!asset.generatedAt || typeof asset.generatedAt !== 'string') {
          errors.push(`${asset.assetId} must include generatedAt.`);
        }
        if (!asset.sourceArtifact || typeof asset.sourceArtifact !== 'string') {
          errors.push(`${asset.assetId} must include the selected source artifact path.`);
        }
        if (!asset.outputFormat || typeof asset.outputFormat !== 'string') {
          errors.push(`${asset.assetId} must include outputFormat.`);
        }
        continue;
      }

      await expectCommittedFile(asset.previewPath, errors, `${asset.assetId} preview`);
      await expectHash(asset.previewPath, asset.previewSha256, errors, `${asset.assetId} preview`);
    }
  }

  if (levelOneWeaponBytes > maxInitialWeaponPayloadBytes) {
    errors.push(
      `level-01 weapon payload ${levelOneWeaponBytes}B exceeds ${maxInitialWeaponPayloadBytes}B budget.`,
    );
  }
  if (foundationEnvironmentBytes > maxInitialEnvironmentPayloadBytes) {
    errors.push(
      `foundation environment payload ${foundationEnvironmentBytes}B exceeds ${maxInitialEnvironmentPayloadBytes}B budget.`,
    );
  }
  if (foundationAudioBytes > maxInitialAudioPayloadBytes) {
    errors.push(`foundation audio payload ${foundationAudioBytes}B exceeds ${maxInitialAudioPayloadBytes}B budget.`);
  }

  return {
    errors,
    sources: assetLedger.sources.length,
    assets: assetCount,
    levelOneWeaponBytes,
    foundationEnvironmentBytes,
    foundationAudioBytes,
  };
}

async function expectCommittedFile(repoRelativePath, errors, label) {
  if (!repoRelativePath || typeof repoRelativePath !== 'string') {
    errors.push(`${label} is missing a path.`);
    return;
  }

  const resolvedPath = resolveRepoPath(repoRelativePath);
  try {
    const fileStat = await stat(resolvedPath);
    if (!fileStat.isFile()) {
      errors.push(`${label} path is not a file: ${repoRelativePath}`);
    }
  } catch {
    errors.push(`${label} is missing: ${repoRelativePath}`);
    return;
  }

  try {
    await execFileAsync('git', ['ls-files', '--error-unmatch', '--', repoRelativePath], { cwd: repoRoot });
  } catch {
    errors.push(`${label} is not tracked by git: ${repoRelativePath}`);
  }
}

async function expectHash(repoRelativePath, expectedHash, errors, label) {
  if (!expectedHash || typeof expectedHash !== 'string') {
    errors.push(`${label} is missing a sha256 hash.`);
    return;
  }

  try {
    const fileBuffer = await readFile(resolveRepoPath(repoRelativePath));
    const actualHash = createHash('sha256').update(fileBuffer).digest('hex');
    if (actualHash !== expectedHash) {
      errors.push(`${label} sha256 mismatch: expected ${expectedHash}, found ${actualHash}.`);
    }
  } catch {
    errors.push(`${label} could not be hashed: ${repoRelativePath}`);
  }
}

async function expectByteSize(repoRelativePath, expectedBytes, errors, label) {
  if (!Number.isInteger(expectedBytes) || expectedBytes <= 0) {
    errors.push(`${label} is missing a positive byte count.`);
    return;
  }

  try {
    const fileStat = await stat(resolveRepoPath(repoRelativePath));
    if (fileStat.size !== expectedBytes) {
      errors.push(`${label} size mismatch: expected ${expectedBytes}B, found ${fileStat.size}B.`);
    }
  } catch {
    errors.push(`${label} size could not be checked: ${repoRelativePath}`);
  }
}

function resolveRepoPath(repoRelativePath) {
  const resolvedPath = path.resolve(repoRoot, repoRelativePath);
  const relativePath = path.relative(repoRoot, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Asset path escapes repo root: ${repoRelativePath}`);
  }

  return resolvedPath;
}
