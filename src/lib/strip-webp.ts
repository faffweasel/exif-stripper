const REMOVE_CHUNKS = new Set(['EXIF', 'XMP ']);

function readUint32LE(src: Uint8Array, offset: number): number {
  return (src[offset] | (src[offset + 1] << 8) | (src[offset + 2] << 16) | (src[offset + 3] << 24)) >>> 0;
}

function writeUint32LE(dst: Uint8Array, offset: number, value: number): void {
  dst[offset] = value & 0xff;
  dst[offset + 1] = (value >>> 8) & 0xff;
  dst[offset + 2] = (value >>> 16) & 0xff;
  dst[offset + 3] = (value >>> 24) & 0xff;
}

export function stripWebp(buffer: ArrayBuffer): Uint8Array {
  const src = new Uint8Array(buffer);

  if (src.length < 12) throw new Error('Not a valid WebP: too short');

  const riff = String.fromCharCode(src[0], src[1], src[2], src[3]);
  const webp = String.fromCharCode(src[8], src[9], src[10], src[11]);
  if (riff !== 'RIFF' || webp !== 'WEBP') throw new Error('Not a valid WebP: bad header');

  // Collect kept chunks as [start, end] byte ranges (excluding RIFF header)
  const kept: Array<[number, number]> = [];
  let totalChunkSize = 0;

  let pos = 12; // skip RIFF header (4 + 4 + 4)
  while (pos < src.length) {
    if (pos + 8 > src.length) throw new Error(`Truncated WebP chunk at offset ${pos}`);

    const type = String.fromCharCode(src[pos], src[pos + 1], src[pos + 2], src[pos + 3]);
    const dataSize = readUint32LE(src, pos + 4);
    const paddedSize = dataSize + (dataSize % 2); // pad to even
    const chunkEnd = pos + 8 + paddedSize;

    if (chunkEnd > src.length) throw new Error(`WebP chunk extends beyond file at offset ${pos}`);

    if (!REMOVE_CHUNKS.has(type)) {
      kept.push([pos, chunkEnd]);
      totalChunkSize += 8 + paddedSize;
    }

    pos = chunkEnd;
  }

  // 12 bytes RIFF header + all kept chunks
  const out = new Uint8Array(12 + totalChunkSize);

  // Copy RIFF header and update file size (bytes 4-7 = total file size minus 8 for "RIFF" + size field itself)
  out.set(src.subarray(0, 12), 0);
  writeUint32LE(out, 4, 4 + totalChunkSize); // 4 = "WEBP" fourcc

  let outPos = 12;
  for (const [start, end] of kept) {
    out.set(src.subarray(start, end), outPos);
    outPos += end - start;
  }

  // Clear Exif (bit 5, 0x20) and XMP (bit 4, 0x10) flags in VP8X chunk data if present
  // VP8X is always the first chunk when present; its data starts at byte 20 (12 header + 8 chunk header)
  const firstType = String.fromCharCode(out[12], out[13], out[14], out[15]);
  if (firstType === 'VP8X') {
    out[20] &= ~(0x20 | 0x10);
  }

  return out;
}
