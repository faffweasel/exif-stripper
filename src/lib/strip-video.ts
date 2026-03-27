// --- Byte helpers (copied from strip-heic.ts — no cross-file imports in src/lib/) ---

function r32(b: Uint8Array, i: number): number {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
}

function w32(b: Uint8Array, i: number, v: number): void {
  b[i] = (v >>> 24) & 0xff;
  b[i + 1] = (v >>> 16) & 0xff;
  b[i + 2] = (v >>> 8) & 0xff;
  b[i + 3] = v & 0xff;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function buildBox(type: string, payload: Uint8Array): Uint8Array {
  const total = 8 + payload.length;
  if (total > 0xffffffff)
    throw new Error(`Box '${type}' exceeds 4 GiB — extended-size rebuild not supported`);
  const out = new Uint8Array(total);
  w32(out, 0, total);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  return out;
}

// --- Box scanning ---

interface RawBox {
  type: string;
  start: number;
  size: number;
}

function scanBoxes(src: Uint8Array, start: number, end: number): RawBox[] {
  const result: RawBox[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    const size = r32(src, pos);
    const type = String.fromCharCode(src[pos + 4], src[pos + 5], src[pos + 6], src[pos + 7]);

    let actual: number;
    if (size === 1) {
      if (pos + 16 > end) throw new Error(`Truncated 64-bit box header at offset ${pos}`);
      actual = r32(src, pos + 8) * 0x100000000 + r32(src, pos + 12);
      if (actual < 16) throw new Error(`Invalid 64-bit box size at offset ${pos}`);
    } else if (size === 0) {
      actual = end - pos;
    } else {
      actual = size;
      if (actual < 8) throw new Error(`Invalid box size ${actual} at offset ${pos}`);
    }

    result.push({ type, start: pos, size: actual });
    if (size === 0) break;
    pos += actual;
  }
  return result;
}

// --- XMP UUID ---

const XMP_UUID = new Uint8Array([
  0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac,
]);

function isXmpUuid(src: Uint8Array, box: RawBox): boolean {
  // UUID is 16 bytes immediately after the box header
  const headerSize = r32(src, box.start) === 1 ? 16 : 8;
  const uuidStart = box.start + headerSize;
  if (uuidStart + 16 > box.start + box.size) return false;
  for (let i = 0; i < 16; i++) {
    if (src[uuidStart + i] !== XMP_UUID[i]) return false;
  }
  return true;
}

// --- Metadata boxes to remove from moov ---

const MOOV_REMOVE = new Set(['udta', 'meta']);

// --- moov rebuild ---

function boxHeaderSize(src: Uint8Array, box: RawBox): number {
  return r32(src, box.start) === 1 ? 16 : 8;
}

function rebuildMoov(src: Uint8Array, box: RawBox): Uint8Array {
  const children = scanBoxes(src, box.start + boxHeaderSize(src, box), box.start + box.size);
  const keptChildren = children.filter((c) => !MOOV_REMOVE.has(c.type));

  // Nothing to remove — return original
  if (keptChildren.length === children.length) {
    return src.subarray(box.start, box.start + box.size);
  }

  const childBuffers = keptChildren.map((c) => src.subarray(c.start, c.start + c.size));
  return buildBox('moov', concat(childBuffers));
}

// --- Public API ---

export function stripVideo(buffer: ArrayBuffer): Uint8Array {
  const src = new Uint8Array(buffer);
  if (src.length < 8) throw new Error('Not a valid ISOBMFF container: file too short');

  const topBoxes = scanBoxes(src, 0, src.length);
  if (!topBoxes.find((b) => b.type === 'ftyp')) {
    throw new Error('Not a valid ISOBMFF container: missing ftyp box');
  }

  const parts: Uint8Array[] = [];
  for (const box of topBoxes) {
    if (box.type === 'free') continue;
    if (box.type === 'uuid' && isXmpUuid(src, box)) continue;
    if (box.type === 'moov') {
      parts.push(rebuildMoov(src, box));
      continue;
    }
    parts.push(src.subarray(box.start, box.start + box.size));
  }

  return concat(parts);
}
