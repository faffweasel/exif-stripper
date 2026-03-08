import { detectFormat } from './detect-format';
import { stripJpeg } from './strip-jpeg';
import { stripPng } from './strip-png';
import { stripWebp } from './strip-webp';
import { stripHeic } from './strip-heic';

export interface StripResult {
  data: Uint8Array;
  format: 'jpeg' | 'png' | 'webp' | 'heic';
  originalSize: number;
  strippedSize: number;
}

export function stripMetadata(buffer: ArrayBuffer): StripResult {
  const format = detectFormat(buffer);
  if (format === null) {
    throw new Error('Unsupported format. Supported formats: JPEG, PNG, WebP, HEIC.');
  }

  const strippers = { jpeg: stripJpeg, png: stripPng, webp: stripWebp, heic: stripHeic };
  const data = strippers[format](buffer);

  return { data, format, originalSize: buffer.byteLength, strippedSize: data.byteLength };
}
