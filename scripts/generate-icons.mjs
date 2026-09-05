import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcSrc = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcSrc));
  return Buffer.concat([length, crcSrc, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    rgba[i * 4] = 0x3f;
    rgba[i * 4 + 1] = 0x51;
    rgba[i * 4 + 2] = 0xb5;
    rgba[i * 4 + 3] = 0xff;
  }
  const left = Math.round(size * 0.32);
  const right = Math.round(size * 0.72);
  const top = Math.round(size * 0.22);
  const bottom = Math.round(size * 0.78);
  for (let y = top; y <= bottom; y += 1) {
    const t = (y - top) / Math.max(bottom - top, 1);
    const half = (1 - Math.abs(2 * t - 1)) * (right - left);
    for (let x = left; x <= left + half; x += 1) {
      const i = (y * size + x) * 4;
      rgba[i] = 0xff;
      rgba[i + 1] = 0xff;
      rgba[i + 2] = 0xff;
      rgba[i + 3] = 0xff;
    }
  }
  return encodePng(size, size, rgba);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(dir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(dir, `icon${size}.png`), drawIcon(size));
}
