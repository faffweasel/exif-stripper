const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const REMOVE_CHUNKS = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME', 'dSIG']);

function readUint32BE(src: Uint8Array, offset: number): number {
  return ((src[offset] << 24) | (src[offset + 1] << 16) | (src[offset + 2] << 8) | src[offset + 3]) >>> 0;
}

export function stripPng(buffer: ArrayBuffer): Uint8Array {
  const src = new Uint8Array(buffer);

  if (src.length < 8) throw new Error('Not a valid PNG: too short');
  for (let i = 0; i < 8; i++) {
    if (src[i] !== PNG_SIGNATURE[i]) throw new Error('Not a valid PNG: bad signature');
  }

  const kept: Array<[number, number]> = [[0, 8]]; // signature
  let totalSize = 8;

  let pos = 8;
  while (pos < src.length) {
    if (pos + 8 > src.length) throw new Error(`Truncated PNG chunk at offset ${pos}`);

    const dataLength = readUint32BE(src, pos);
    const chunkSize = dataLength + 12; // length(4) + type(4) + data + crc(4)

    if (pos + chunkSize > src.length) throw new Error(`PNG chunk extends beyond end of file at offset ${pos}`);

    const type = String.fromCharCode(src[pos + 4], src[pos + 5], src[pos + 6], src[pos + 7]);

    if (!REMOVE_CHUNKS.has(type)) {
      kept.push([pos, pos + chunkSize]);
      totalSize += chunkSize;
    }

    pos += chunkSize;
  }

  const out = new Uint8Array(totalSize);
  let outPos = 0;
  for (const [start, end] of kept) {
    out.set(src.subarray(start, end), outPos);
    outPos += end - start;
  }

  return out;
}
