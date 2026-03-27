export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'avif' | 'gif' | 'mp4' | 'mov';

const AVIF_BRANDS = new Set(['avif', 'avis']);
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis']);
const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso3',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'M4V ',
  'M4A ',
  'f4v ',
  'dash',
  'avc1',
]);
const MOV_BRANDS = new Set(['qt  ']);

export function detectFormat(buffer: ArrayBuffer): ImageFormat | null {
  if (buffer.byteLength < 12) return null;

  const bytes = new Uint8Array(buffer, 0, 12);

  // GIF: GIF87a (47 49 46 38 37 61) or GIF89a (47 49 46 38 39 61)
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  )
    return 'gif';

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

  // ISOBMFF: ftyp box at bytes 4-7, major brand at bytes 8-11
  // Check HEIC/AVIF before MP4/MOV — some files use shared brands (e.g. mif1)
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
    if (MP4_BRANDS.has(brand)) return 'mp4';
    if (MOV_BRANDS.has(brand)) return 'mov';
  }

  return null;
}
