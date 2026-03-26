type ImageFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'avif';

const AVIF_BRANDS = new Set(['avif', 'avis']);
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis']);

export function detectFormat(buffer: ArrayBuffer): ImageFormat | null {
  if (buffer.byteLength < 12) return null;

  const bytes = new Uint8Array(buffer, 0, 12);

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'png';

  // WebP: RIFF at 0-3, WEBP at 8-11
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'webp';

  // HEIC/AVIF: ftyp box at bytes 4-7, major brand at bytes 8-11
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (AVIF_BRANDS.has(brand)) return 'avif';
    if (HEIC_BRANDS.has(brand)) return 'heic';
    if (brand === 'mif1') {
      // mif1 is shared by HEIC, AVIF, and other ISOBMFF formats; scan compatible brands to disambiguate
      const ftypSize = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
      if (ftypSize >= 20 && buffer.byteLength >= ftypSize) {
        const ftyp = new Uint8Array(buffer, 0, ftypSize);
        for (let i = 16; i + 4 <= ftypSize; i += 4) {
          const cb = String.fromCharCode(ftyp[i], ftyp[i + 1], ftyp[i + 2], ftyp[i + 3]);
          if (AVIF_BRANDS.has(cb)) return 'avif';
          if (HEIC_BRANDS.has(cb)) return 'heic';
        }
      }
      return null; // mif1 without a recognised HEIC or AVIF compatible brand
    }
  }

  return null;
}
