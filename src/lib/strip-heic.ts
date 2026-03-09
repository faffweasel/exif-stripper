type ItemId = number;

const REMOVE_ITEM_TYPES = new Set(['Exif']);
const REMOVE_CONTENT_TYPES = new Set(['application/rdf+xml']); // XMP

// --- Byte helpers ---

function r32(b: Uint8Array, i: number): number {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
}

function w32(b: Uint8Array, i: number, v: number): void {
  b[i] = (v >>> 24) & 0xff;
  b[i + 1] = (v >>> 16) & 0xff;
  b[i + 2] = (v >>> 8) & 0xff;
  b[i + 3] = v & 0xff;
}

function r16(b: Uint8Array, i: number): number {
  return ((b[i] << 8) | b[i + 1]) & 0xffff;
}

function w16(b: Uint8Array, i: number, v: number): void {
  b[i] = (v >>> 8) & 0xff;
  b[i + 1] = v & 0xff;
}

function readN(b: Uint8Array, i: number, n: number): number {
  switch (n) {
    case 1: return b[i];
    case 2: return r16(b, i);
    case 4: return r32(b, i);
    case 8: return r32(b, i) * 0x100000000 + r32(b, i + 4);
    default: return 0;
  }
}

function writeN(b: Uint8Array, i: number, n: number, v: number): void {
  switch (n) {
    case 1: b[i] = v & 0xff; break;
    case 2: w16(b, i, v); break;
    case 4: w32(b, i, v); break;
    case 8: w32(b, i, Math.floor(v / 0x100000000)); w32(b, i + 4, v >>> 0); break;
    default: break;
  }
}

function asciiz(b: Uint8Array, pos: number, end: number): { str: string; next: number } {
  let str = '';
  while (pos < end && b[pos] !== 0) str += String.fromCharCode(b[pos++]);
  return { str, next: pos + 1 };
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
  const out = new Uint8Array(8 + payload.length);
  w32(out, 0, out.length);
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
      // 64-bit extended size: 16-byte header (size + type + largesize)
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

// --- infe (item info entry) ---

interface InfeItem {
  itemId: ItemId;
  itemType: string;
  contentType: string;
}

function parseInfe(src: Uint8Array, b: RawBox): InfeItem {
  const { start, size } = b;
  const version = src[start + 8];
  let pos = start + 12; // past FullBox header
  const end = start + size;

  let itemId: number;
  let itemType: string;
  let contentType: string;

  if (version < 2) {
    itemId = r16(src, pos); pos += 2;
    pos += 2; // item_protection_index
    pos = asciiz(src, pos, end).next; // item_name (skip)
    contentType = asciiz(src, pos, end).str;
    itemType = '';
  } else {
    if (version === 2) { itemId = r16(src, pos); pos += 2; }
    else { itemId = r32(src, pos); pos += 4; }
    pos += 2; // item_protection_index
    itemType = String.fromCharCode(src[pos], src[pos + 1], src[pos + 2], src[pos + 3]);
    pos += 4;
    pos = asciiz(src, pos, end).next; // item_name (skip)
    contentType = itemType === 'mime' ? asciiz(src, pos, end).str : '';
  }

  return { itemId, itemType, contentType };
}

function isMetadataItem(item: InfeItem): boolean {
  return REMOVE_ITEM_TYPES.has(item.itemType) || REMOVE_CONTENT_TYPES.has(item.contentType);
}

// --- iinf (item information box) ---

function rebuildIinf(src: Uint8Array, b: RawBox): { rebuilt: Uint8Array; removeIds: Set<ItemId> } {
  const { start, size } = b;
  const version = src[start + 8];
  const fhdr = src.subarray(start + 8, start + 12); // version + flags
  const countSz = version === 0 ? 2 : 4;

  const removeIds = new Set<ItemId>();
  const kept: Uint8Array[] = [];

  for (const c of scanBoxes(src, start + 12 + countSz, start + size)) {
    if (c.type === 'infe') {
      const item = parseInfe(src, c);
      if (isMetadataItem(item)) {
        removeIds.add(item.itemId);
      } else {
        kept.push(src.subarray(c.start, c.start + c.size));
      }
    }
  }

  const count = new Uint8Array(countSz);
  if (version === 0) { w16(count, 0, kept.length); }
  else { w32(count, 0, kept.length); }

  return { rebuilt: buildBox('iinf', concat([fhdr, count, ...kept])), removeIds };
}

// --- iloc (item location box) ---

function rebuildIloc(src: Uint8Array, b: RawBox, removeIds: Set<ItemId>): Uint8Array {
  const { start, size } = b;
  const version = src[start + 8];
  const fhdr = src.subarray(start + 8, start + 12); // version + flags
  let pos = start + 12;

  const fb1 = src[pos++];
  const fb2 = src[pos++];
  const offsetSz = (fb1 >> 4) & 0xf;
  const lengthSz = fb1 & 0xf;
  const baseOffsetSz = (fb2 >> 4) & 0xf;
  const indexSz = version >= 1 ? fb2 & 0xf : 0;
  const fieldSzBytes = new Uint8Array([fb1, fb2]);

  const countSz = version < 2 ? 2 : 4;
  const itemCount = version < 2 ? r16(src, pos) : r32(src, pos);
  pos += countSz;

  const kept: Uint8Array[] = [];

  for (let i = 0; i < itemCount; i++) {
    const itemStart = pos;

    const itemId = version < 2 ? r16(src, pos) : r32(src, pos);
    pos += version < 2 ? 2 : 4;
    if (version >= 1) pos += 2; // construction_method
    pos += 2; // data_reference_index
    pos += baseOffsetSz;

    const extentCount = r16(src, pos); pos += 2;
    for (let j = 0; j < extentCount; j++) {
      if (version >= 1 && indexSz > 0) pos += indexSz;
      pos += offsetSz;
      pos += lengthSz;
    }

    if (!removeIds.has(itemId)) kept.push(src.subarray(itemStart, pos));
  }

  const count = new Uint8Array(countSz);
  if (version < 2) { w16(count, 0, kept.length); }
  else { w32(count, 0, kept.length); }

  return buildBox('iloc', concat([fhdr, fieldSzBytes, count, ...kept]));
}

// --- iloc offset adjustment ---

// After meta shrinks, mdat shifts earlier in the file. Absolute offsets in iloc
// must be reduced by the size difference so they still point to the right data.
function adjustIlocOffsets(iloc: Uint8Array, delta: number): Uint8Array {
  const out = new Uint8Array(iloc.length);
  out.set(iloc);

  const version = out[8];
  const fb1 = out[12];
  const fb2 = out[13];
  const offsetSz = (fb1 >> 4) & 0xf;
  const lengthSz = fb1 & 0xf;
  const baseOffsetSz = (fb2 >> 4) & 0xf;
  const indexSz = version >= 1 ? fb2 & 0xf : 0;

  const countSz = version < 2 ? 2 : 4;
  const itemCount = version < 2 ? r16(out, 14) : r32(out, 14);
  let pos = 14 + countSz;

  for (let i = 0; i < itemCount; i++) {
    pos += version < 2 ? 2 : 4; // item_ID

    let constructionMethod = 0;
    if (version >= 1) {
      constructionMethod = r16(out, pos) & 0xf;
      pos += 2;
    }

    pos += 2; // data_reference_index

    const baseOffsetPos = pos;
    const baseOffset = baseOffsetSz > 0 ? readN(out, pos, baseOffsetSz) : 0;
    pos += baseOffsetSz;

    const extentCount = r16(out, pos);
    pos += 2;

    // Only adjust file-offset items (construction_method == 0)
    const shouldAdjust = constructionMethod === 0;
    // If base_offset is present and non-zero, adjust it and leave extent offsets alone.
    // Otherwise adjust each extent_offset individually.
    const adjustBase = shouldAdjust && baseOffsetSz > 0 && baseOffset > 0;

    if (adjustBase) {
      writeN(out, baseOffsetPos, baseOffsetSz, baseOffset - delta);
    }

    for (let j = 0; j < extentCount; j++) {
      if (version >= 1 && indexSz > 0) pos += indexSz;
      if (shouldAdjust && !adjustBase && offsetSz > 0) {
        writeN(out, pos, offsetSz, readN(out, pos, offsetSz) - delta);
      }
      pos += offsetSz;
      pos += lengthSz;
    }
  }

  return out;
}

// --- iref (item reference box) ---

function rebuildIref(src: Uint8Array, b: RawBox, removeIds: Set<ItemId>): Uint8Array {
  const { start, size } = b;
  const version = src[start + 8];
  const fhdr = src.subarray(start + 8, start + 12); // version + flags
  const end = start + size;
  const idSz = version === 0 ? 2 : 4;

  const kept: Uint8Array[] = [];
  let pos = start + 12;

  while (pos + 8 <= end) {
    const refSize = r32(src, pos);
    const refType = String.fromCharCode(src[pos + 4], src[pos + 5], src[pos + 6], src[pos + 7]);
    const refEnd = pos + refSize;
    let inner = pos + 8;

    const fromId = idSz === 2 ? r16(src, inner) : r32(src, inner);
    inner += idSz;
    const refCount = r16(src, inner); inner += 2;

    if (!removeIds.has(fromId)) {
      const toIds: number[] = [];
      for (let i = 0; i < refCount; i++) {
        const toId = idSz === 2 ? r16(src, inner) : r32(src, inner);
        inner += idSz;
        if (!removeIds.has(toId)) toIds.push(toId);
      }

      if (toIds.length > 0) {
        if (toIds.length === refCount) {
          kept.push(src.subarray(pos, refEnd)); // no change, copy verbatim
        } else {
          // rebuild with filtered to_item_IDs
          const payload = new Uint8Array(idSz + 2 + toIds.length * idSz);
          let p = 0;
          if (idSz === 2) { w16(payload, p, fromId); } else { w32(payload, p, fromId); }
          p += idSz;
          w16(payload, p, toIds.length); p += 2;
          for (const id of toIds) {
            if (idSz === 2) { w16(payload, p, id); } else { w32(payload, p, id); }
            p += idSz;
          }
          kept.push(buildBox(refType, payload));
        }
      }
    }

    pos = refEnd;
  }

  return buildBox('iref', concat([fhdr, ...kept]));
}

// --- meta ---

function rebuildMeta(src: Uint8Array, b: RawBox, mdatAfterMeta: boolean): Uint8Array {
  const { start, size } = b;
  const fhdr = src.subarray(start + 8, start + 12); // FullBox version + flags
  const children = scanBoxes(src, start + 12, start + size);

  const iinf = children.find(c => c.type === 'iinf');
  if (!iinf) return src.subarray(start, start + size);

  const { rebuilt: newIinf, removeIds } = rebuildIinf(src, iinf);
  if (removeIds.size === 0) return src.subarray(start, start + size);

  const newChildren = children.map(c => {
    if (c.type === 'iinf') return newIinf;
    if (c.type === 'iloc') return rebuildIloc(src, c, removeIds);
    if (c.type === 'iref') return rebuildIref(src, c, removeIds);
    return src.subarray(c.start, c.start + c.size);
  });

  // Meta box shrank — if mdat follows, its file offset shifts earlier by delta.
  // Adjust iloc absolute offsets so they still point to the right data in mdat.
  if (mdatAfterMeta) {
    const newMetaSize = 8 + 4 + newChildren.reduce((s, c) => s + c.length, 0);
    const delta = size - newMetaSize;
    if (delta > 0) {
      const ilocIdx = children.findIndex(c => c.type === 'iloc');
      if (ilocIdx !== -1) {
        newChildren[ilocIdx] = adjustIlocOffsets(newChildren[ilocIdx], delta);
      }
    }
  }

  return buildBox('meta', concat([fhdr, ...newChildren]));
}

// --- public API ---

export function stripHeic(buffer: ArrayBuffer): Uint8Array {
  const src = new Uint8Array(buffer);
  if (src.length < 8) throw new Error('Not a valid HEIC: file too short');

  const topBoxes = scanBoxes(src, 0, src.length);
  if (!topBoxes.find(b => b.type === 'ftyp')) throw new Error('Not a valid HEIC: missing ftyp box');

  const metaIdx = topBoxes.findIndex(b => b.type === 'meta');
  const mdatIdx = topBoxes.findIndex(b => b.type === 'mdat');
  const mdatAfterMeta = metaIdx !== -1 && mdatIdx !== -1 && mdatIdx > metaIdx;

  return concat(
    topBoxes.map(b =>
      b.type === 'meta' ? rebuildMeta(src, b, mdatAfterMeta) : src.subarray(b.start, b.start + b.size),
    ),
  );
}
