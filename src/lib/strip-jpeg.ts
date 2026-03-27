const REMOVE_MARKERS = new Set([0xe1, 0xed, 0xe2]);

// Markers with no length field
const NO_LENGTH_MARKERS = new Set([
  0xd8, // SOI
  0xd9, // EOI
  0x00, // byte stuffing
  0xd0,
  0xd1,
  0xd2,
  0xd3,
  0xd4,
  0xd5,
  0xd6,
  0xd7, // RST0–RST7
]);

export function stripJpeg(buffer: ArrayBuffer): Uint8Array {
  const src = new Uint8Array(buffer);

  if (src[0] !== 0xff || src[1] !== 0xd8) {
    throw new Error('Not a valid JPEG: missing SOI marker');
  }

  // Collect segments to keep as [start, end] byte ranges
  const kept: Array<[number, number]> = [];
  let totalSize = 0;

  let pos = 0;

  while (pos < src.length) {
    if (src[pos] !== 0xff) throw new Error(`Expected marker at offset ${pos}`);

    const markerStart = pos; // start of this marker, including any 0xFF padding prefix bytes
    // Skip padding 0xFF bytes
    while (pos < src.length && src[pos] === 0xff) pos++;
    if (pos >= src.length) break;

    const marker = src[pos++];

    if (NO_LENGTH_MARKERS.has(marker)) {
      // SOI, EOI, RST: variable-length 0xFF run + marker byte, no length field
      kept.push([markerStart, pos]);
      totalSize += pos - markerStart;

      if (marker === 0xd9) break; // EOI — done
      continue;
    }

    if (pos + 1 >= src.length) throw new Error('Truncated JPEG marker length');
    const length = (src[pos] << 8) | src[pos + 1]; // includes the 2 length bytes
    const segmentEnd = pos - 1 + length + 1; // pos-1 is marker byte, length covers itself + payload
    if (segmentEnd > src.length) throw new Error(`Truncated JPEG segment at offset ${markerStart}`);

    if (marker === 0xda) {
      // SOS: keep header segment, then copy entropy-coded data verbatim to EOI
      kept.push([markerStart, segmentEnd]);
      totalSize += segmentEnd - markerStart;

      // Find EOI (FF D9), skipping FF 00 (stuffing) and FF D0–D7 (RST markers in scan data)
      let scanPos = segmentEnd;
      while (scanPos < src.length) {
        if (src[scanPos] === 0xff && scanPos + 1 < src.length) {
          const next = src[scanPos + 1];
          if (next !== 0x00 && (next < 0xd0 || next > 0xd7)) break;
        }
        scanPos++;
      }

      // Copy entropy-coded data (after SOS header up to EOI)
      if (scanPos > segmentEnd) {
        kept.push([segmentEnd, scanPos]);
        totalSize += scanPos - segmentEnd;
      }

      pos = scanPos;
      continue;
    }

    if (!REMOVE_MARKERS.has(marker)) {
      kept.push([markerStart, segmentEnd]);
      totalSize += segmentEnd - markerStart;
    }

    pos = segmentEnd;
  }

  const out = new Uint8Array(totalSize);
  let outPos = 0;
  for (const [start, end] of kept) {
    out.set(src.subarray(start, end), outPos);
    outPos += end - start;
  }

  return out;
}
