// Advances past all sub-blocks (length-prefixed, terminated by a 0x00 block)
function skipSubBlocks(src: Uint8Array, pos: number): number {
  let p = pos;
  while (p < src.length) {
    const len = src[p++];
    if (len === 0) return p;
    if (p + len > src.length) throw new Error('Not a valid GIF: truncated sub-block');
    p += len;
  }
  throw new Error('Not a valid GIF: unterminated sub-block sequence');
}

function readString(src: Uint8Array, start: number, len: number): string {
  if (start + len > src.length) throw new Error('Not a valid GIF: unexpected end of data');
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(src[start + i]);
  return s;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function stripGif(buffer: ArrayBuffer): Uint8Array {
  const src = new Uint8Array(buffer);

  if (src.length < 6) throw new Error('Not a valid GIF: file too short');
  const header = readString(src, 0, 6);
  if (header !== 'GIF87a' && header !== 'GIF89a') {
    throw new Error('Not a valid GIF: unrecognised header');
  }

  // GIF87a has no extension mechanism; nothing to strip
  if (header === 'GIF87a') return src.slice();

  // Logical Screen Descriptor: 7 bytes at offset 6
  //   offset 10: packed field — bit 7 = Global Color Table flag, bits 0-2 = GCT size exponent
  if (src.length < 13) throw new Error('Not a valid GIF: truncated Logical Screen Descriptor');
  const lsdPacked = src[10];
  const hasGCT = (lsdPacked & 0x80) !== 0;
  const gctSize = hasGCT ? 3 * (1 << ((lsdPacked & 0x07) + 1)) : 0;
  const bodyStart = 13 + gctSize; // header(6) + LSD(7) + GCT
  if (src.length < bodyStart) throw new Error('Not a valid GIF: truncated Global Color Table');

  const kept: Uint8Array[] = [src.subarray(0, bodyStart)];
  let pos = bodyStart;
  let trailerSeen = false;

  while (pos < src.length) {
    const blockStart = pos;
    const introducer = src[pos++];

    if (introducer === 0x3b) {
      // Trailer — copy and stop
      kept.push(src.subarray(blockStart, pos));
      trailerSeen = true;
      break;
    }

    if (introducer === 0x2c) {
      // Image Descriptor: 9 bytes (left, top, width, height, packed) + optional LCT + image data
      if (pos + 9 > src.length) throw new Error('Not a valid GIF: truncated Image Descriptor');
      const imgPacked = src[pos + 8]; // packed field is the 9th byte
      pos += 9;

      const hasLCT = (imgPacked & 0x80) !== 0;
      const lctSize = hasLCT ? 3 * (1 << ((imgPacked & 0x07) + 1)) : 0;
      if (pos + lctSize > src.length)
        throw new Error('Not a valid GIF: truncated Local Color Table');
      pos += lctSize;

      if (pos >= src.length) throw new Error('Not a valid GIF: missing LZW minimum code size');
      pos++; // LZW minimum code size byte

      pos = skipSubBlocks(src, pos); // image data sub-blocks
      kept.push(src.subarray(blockStart, pos)); // copy image block verbatim
      continue;
    }

    if (introducer === 0x21) {
      // Extension introducer
      if (pos >= src.length) throw new Error('Not a valid GIF: truncated extension');
      const label = src[pos++];

      if (label === 0xf9) {
        // Graphics Control Extension — PRESERVE (carries animation timing/disposal)
        // GCE is always a single fixed-size sub-block (4 bytes) followed by a terminator.
        // Read via skipSubBlocks to handle the terminator correctly and catch truncation.
        pos = skipSubBlocks(src, pos);
        kept.push(src.subarray(blockStart, pos));
        continue;
      }

      if (label === 0xff) {
        // Application Extension — check 11-byte identifier to decide keep/remove.
        // The spec mandates an 11-byte block (8-byte app identifier + 3-byte auth code).
        if (pos >= src.length) throw new Error('Not a valid GIF: truncated Application Extension');
        const appBlockSize = src[pos++];
        if (appBlockSize !== 11) {
          throw new Error(
            `Not a valid GIF: Application Extension identifier block must be 11 bytes, got ${appBlockSize}`
          );
        }
        if (pos + appBlockSize > src.length) {
          throw new Error('Not a valid GIF: truncated Application Extension identifier');
        }
        const identifier = readString(src, pos, appBlockSize);
        pos += appBlockSize;
        pos = skipSubBlocks(src, pos); // application-specific data sub-blocks

        // NETSCAPE2.0 and ANIMEXTS1.0 carry loop counts for animated GIFs — PRESERVE
        if (identifier === 'NETSCAPE2.0' || identifier === 'ANIMEXTS1.0') {
          kept.push(src.subarray(blockStart, pos));
        }
        // All other app extensions (XMP, ICC profiles, etc.) — REMOVE
        continue;
      }

      // Comment (0xFE), Plain Text (0x01), or unknown extension label — REMOVE
      pos = skipSubBlocks(src, pos);
      continue;
    }

    throw new Error(
      `Not a valid GIF: unexpected block introducer 0x${introducer.toString(16).padStart(2, '0')} at offset ${blockStart}`
    );
  }

  if (!trailerSeen) throw new Error('Not a valid GIF: missing trailer');

  return concat(kept);
}
