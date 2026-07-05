#!/usr/bin/env node
/* global console */

import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const textureDir = path.join(
  repoRoot,
  'public',
  'assets',
  'environment',
  'kenney-prototype-textures',
  'textures',
);
const size = 1024;

async function main() {
  await mkdir(textureDir, { recursive: true });
  await Promise.all([
    writePng(path.join(textureDir, 'floor-grid-steel.png'), renderTexture(renderFloorPixel)),
    writePng(path.join(textureDir, 'wall-panel-steel.png'), renderTexture(renderWallPixel)),
    writePng(path.join(textureDir, 'roof-flat-steel.png'), renderTexture(renderRoofPixel)),
  ]);

  console.log('Generated foundation metal texture set.');
}

function renderTexture(pixelRenderer) {
  const rgba = Buffer.alloc(size * size * 4);
  let offset = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelRenderer(x, y);
      rgba[offset++] = r;
      rgba[offset++] = g;
      rgba[offset++] = b;
      rgba[offset++] = a;
    }
  }

  return rgba;
}

function renderWallPixel(x, y) {
  const panelX = Math.floor(x / 256);
  const panelY = Math.floor(y / 256);
  const localX = x % 256;
  const localY = y % 256;
  const blockNoise = hashNoise(Math.floor(x / 8), Math.floor(y / 8), 13) - 0.5;
  const fineLine = Math.sin((x + y * 0.18) * 0.09) * 3;
  const verticalShade = ((y / size) - 0.5) * -18;
  const panelShift = ((panelX + panelY * 2) % 4) * 4;
  let color = [92 + panelShift, 105 + panelShift, 110 + panelShift];

  color = add(color, blockNoise * 14 + fineLine + verticalShade);
  color = mix(color, [64, 80, 86], seamAmount(localX, localY, 4) * 0.58);
  color = mix(color, [142, 157, 160], seamAmount(localX, localY, 9) * 0.22);
  color = mix(color, [54, 73, 78], recessAmount(localX, localY) * 0.28);
  color = addScratches(color, x, y, 4, 0.24);
  color = addScrew(color, localX, localY, [
    [34, 34],
    [222, 34],
    [34, 222],
    [222, 222],
    [128, 34],
    [128, 222],
  ]);
  color = addRivetLine(color, localX, localY);

  return toRgba(color);
}

function renderFloorPixel(x, y) {
  const panel = 192;
  const localX = x % panel;
  const localY = y % panel;
  const blockNoise = hashNoise(Math.floor(x / 10), Math.floor(y / 10), 41) - 0.5;
  const stripe = Math.sin((x - y) * 0.08) * 3;
  const panelShift = ((Math.floor(x / panel) + Math.floor(y / panel)) % 2) * 8;
  let color = [56 + panelShift, 66 + panelShift, 70 + panelShift];

  color = add(color, blockNoise * 12 + stripe);
  color = mix(color, [39, 51, 56], seamLine(localX, panel, 3) * 0.42);
  color = mix(color, [87, 96, 98], seamLine(localX, panel, 8) * 0.14);
  color = mix(color, [39, 51, 56], seamLine(localY, panel, 3) * 0.38);
  color = mix(color, [75, 84, 88], treadAmount(x, y) * 0.28);
  color = mix(color, [123, 96, 49], cautionStripeAmount(x, y) * 0.36);
  color = addScrew(color, localX, localY, [
    [24, 24],
    [168, 24],
    [24, 168],
    [168, 168],
  ]);

  return toRgba(color);
}

function renderRoofPixel(x, y) {
  const panel = 256;
  const localX = x % panel;
  const localY = y % panel;
  const blockNoise = hashNoise(Math.floor(x / 12), Math.floor(y / 12), 77) - 0.5;
  let color = [43, 49, 53];

  color = add(color, blockNoise * 10 + Math.sin(x * 0.025) * 3);
  color = mix(color, [30, 38, 42], seamAmount(localX, localY, 5) * 0.46);
  color = mix(color, [76, 84, 86], seamAmount(localX, localY, 11) * 0.16);
  color = mix(color, [58, 70, 74], ventSlatAmount(localX, localY) * 0.34);
  color = addScratches(color, x, y, 7, 0.16);
  color = addScrew(color, localX, localY, [
    [40, 40],
    [216, 40],
    [40, 216],
    [216, 216],
  ]);

  return toRgba(color);
}

function seamAmount(localX, localY, width) {
  return Math.max(seamLine(localX, 256, width), seamLine(localY, 256, width));
}

function seamLine(local, period, width) {
  return local < width || local > period - width ? 1 : 0;
}

function recessAmount(localX, localY) {
  const insetX = localX > 24 && localX < 232 ? 1 : 0;
  const insetY = localY > 22 && localY < 234 ? 1 : 0;
  const border =
    (Math.abs(localX - 24) < 3 || Math.abs(localX - 232) < 3 || Math.abs(localY - 22) < 3 || Math.abs(localY - 234) < 3)
      ? 1
      : 0;

  return insetX && insetY ? border : 0;
}

function treadAmount(x, y) {
  const band = mod(x - y, 96);
  const raised = band > 42 && band < 49;
  const shortRepeat = mod(x + y, 128);

  return raised && shortRepeat > 20 && shortRepeat < 92 ? 1 : 0;
}

function cautionStripeAmount(x, y) {
  const localY = mod(y, 384);
  if (localY < 24 || localY > 64) {
    return 0;
  }

  return mod(x + y, 96) < 44 ? 1 : 0;
}

function ventSlatAmount(localX, localY) {
  if (localX < 68 || localX > 188 || localY < 84 || localY > 172) {
    return 0;
  }

  return mod(localY, 18) < 5 ? 1 : 0;
}

function addScrew(color, localX, localY, points) {
  let next = color;
  for (const [cx, cy] of points) {
    const dx = localX - cx;
    const dy = localY - cy;
    const distance = Math.hypot(dx, dy);
    if (distance > 16) {
      continue;
    }

    if (distance < 9) {
      next = mix(next, [42, 50, 52], 0.5);
    }
    if (distance >= 9 && distance < 13) {
      next = mix(next, [142, 153, 154], 0.44);
    }
    if (Math.abs(dy) < 1.8 && Math.abs(dx) < 8) {
      next = mix(next, [24, 31, 34], 0.62);
    }
  }

  return next;
}

function addRivetLine(color, localX, localY) {
  if (Math.abs(localX - 128) > 4) {
    return color;
  }

  return mod(localY, 64) < 12 ? mix(color, [132, 146, 148], 0.24) : color;
}

function addScratches(color, x, y, seed, opacity) {
  const scratch =
    hashNoise(Math.floor(x / 28), Math.floor((y + x * 0.17) / 2), seed) > 0.94 &&
    mod(x + Math.floor(y * 0.35), 90) < 42;

  return scratch ? mix(color, [158, 166, 163], opacity) : color;
}

function hashNoise(x, y, seed) {
  let value = (x * 374761393 + y * 668265263 + seed * 2147483647) >>> 0;
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 1274126177) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;

  return value / 0xffffffff;
}

function add(color, amount) {
  return [color[0] + amount, color[1] + amount, color[2] + amount];
}

function mix(color, target, amount) {
  return [
    color[0] + (target[0] - color[0]) * amount,
    color[1] + (target[1] - color[1]) * amount,
    color[2] + (target[2] - color[2]) * amount,
  ];
}

function toRgba(color) {
  return [clampByte(color[0]), clampByte(color[1]), clampByte(color[2]), 255];
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mod(value, period) {
  return ((value % period) + period) % period;
}

async function writePng(filePath, rgba) {
  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  let sourceOffset = 0;
  let targetOffset = 0;
  for (let y = 0; y < size; y++) {
    scanlines[targetOffset++] = 0;
    rgba.copy(scanlines, targetOffset, sourceOffset, sourceOffset + size * 4);
    sourceOffset += size * 4;
    targetOffset += size * 4;
  }

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', createIhdr()),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  await writeFile(filePath, png);
}

function createIhdr() {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(size, 0);
  buffer.writeUInt32BE(size, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;

  return buffer;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}

await main();
