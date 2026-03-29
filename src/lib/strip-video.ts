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

function rebuildContainer(src: Uint8Array, box: RawBox): Uint8Array {
  const hdr = boxHeaderSize(src, box);
  const children = scanBoxes(src, box.start + hdr, box.start + box.size);
  const keptChildren = children.filter((c) => !MOOV_REMOVE.has(c.type));

  // Recurse into trak boxes to strip per-track udta/meta
  const childBuffers = keptChildren.map((c) =>
    c.type === 'trak' ? rebuildContainer(src, c) : src.subarray(c.start, c.start + c.size)
  );

  const changed =
    keptChildren.length !== children.length ||
    childBuffers.some((buf, i) => buf.length !== keptChildren[i].size);

  if (!changed) return src.subarray(box.start, box.start + box.size);
  return buildBox(box.type, concat(childBuffers));
}

// --- stco / co64 chunk offset adjustment ---

interface ByteShift {
  readonly endPos: number;
  readonly removed: number;
}

const ISOBMFF_CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf', 'edts']);

function adjustChunkOffsets(moov: Uint8Array, shifts: readonly ByteShift[]): void {
  function deltaFor(offset: number): number {
    let d = 0;
    for (const s of shifts) {
      if (s.endPos <= offset) d += s.removed;
      else break;
    }
    return d;
  }

  function walk(start: number, end: number): void {
    for (const box of scanBoxes(moov, start, end)) {
      const hdr = r32(moov, box.start) === 1 ? 16 : 8;
      if (box.type === 'stco') {
        const entryCount = r32(moov, box.start + hdr + 4);
        let pos = box.start + hdr + 8;
        for (let i = 0; i < entryCount; i++) {
          const orig = r32(moov, pos);
          const d = deltaFor(orig);
          if (d > 0) w32(moov, pos, orig - d);
          pos += 4;
        }
      } else if (box.type === 'co64') {
        const entryCount = r32(moov, box.start + hdr + 4);
        let pos = box.start + hdr + 8;
        for (let i = 0; i < entryCount; i++) {
          const hi = r32(moov, pos);
          const lo = r32(moov, pos + 4);
          const orig = hi * 0x100000000 + lo;
          const d = deltaFor(orig);
          if (d > 0) {
            const adjusted = orig - d;
            w32(moov, pos, Math.floor(adjusted / 0x100000000));
            w32(moov, pos + 4, adjusted >>> 0);
          }
          pos += 8;
        }
      } else if (ISOBMFF_CONTAINERS.has(box.type)) {
        walk(box.start + hdr, box.start + box.size);
      }
    }
  }

  const hdr = r32(moov, 0) === 1 ? 16 : 8;
  walk(hdr, moov.length);
}

// --- Public API ---

export function stripVideo(buffer: ArrayBuffer): Uint8Array {
  const src = new Uint8Array(buffer);
  if (src.length < 8) throw new Error('Not a valid ISOBMFF container: file too short');

  const topBoxes = scanBoxes(src, 0, src.length);
  if (!topBoxes.find((b) => b.type === 'ftyp')) {
    throw new Error('Not a valid ISOBMFF container: missing ftyp box');
  }

  function isRemoved(box: RawBox): boolean {
    if (box.type === 'free') return true;
    if (box.type === 'uuid' && isXmpUuid(src, box)) return true;
    return false;
  }

  // Rebuild moov (potentially smaller after removing udta/meta)
  const moovBox = topBoxes.find((b) => b.type === 'moov');
  let rebuiltMoov = moovBox ? rebuildContainer(src, moovBox) : null;
  const moovShrinkage = moovBox && rebuiltMoov ? moovBox.size - rebuiltMoov.length : 0;

  // Compute byte shifts from removed/shrunk top-level boxes (sorted by position)
  const shifts: ByteShift[] = [];
  for (const box of topBoxes) {
    if (isRemoved(box)) {
      shifts.push({ endPos: box.start + box.size, removed: box.size });
    } else if (box.type === 'moov' && moovShrinkage > 0) {
      shifts.push({ endPos: box.start + box.size, removed: moovShrinkage });
    }
  }
  shifts.sort((a, b) => a.endPos - b.endPos);

  // Adjust stco/co64 chunk offsets to account for shifted data positions
  if (rebuiltMoov && shifts.length > 0) {
    // rebuildMoov returns a subarray view when moov content is unchanged —
    // copy before mutating to avoid corrupting the source buffer
    if (moovShrinkage === 0) {
      rebuiltMoov = new Uint8Array(rebuiltMoov);
    }
    adjustChunkOffsets(rebuiltMoov, shifts);
  }

  const parts: Uint8Array[] = [];
  for (const box of topBoxes) {
    if (isRemoved(box)) continue;
    if (box.type === 'moov' && rebuiltMoov) {
      parts.push(rebuiltMoov);
      continue;
    }
    parts.push(src.subarray(box.start, box.start + box.size));
  }

  return concat(parts);
}
