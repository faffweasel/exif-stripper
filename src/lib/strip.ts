import { detectFormat, type ImageFormat } from './detect-format';
import { stripGif } from './strip-gif';
import { stripHeic } from './strip-heic';
import { stripJpeg } from './strip-jpeg';
import { stripPng } from './strip-png';
import { stripWebp } from './strip-webp';

export interface StripResult {
  data: Uint8Array;
  format: ImageFormat;
  originalSize: number;
  strippedSize: number;
}

export function stripMetadata(buffer: ArrayBuffer): StripResult {
  const format = detectFormat(buffer);
  if (format === null) {
    throw new Error('Unsupported format. Supported formats: JPEG, PNG, WebP, HEIC, AVIF, GIF.');
  }

  if (format === 'mp4' || format === 'mov') {
    throw new Error(
      `Unsupported format. ${format.toUpperCase()} metadata stripping is not yet supported.`
    );
  }

  // avif uses the same ISOBMFF container as heic — identical stripping logic
  const strippers = {
    jpeg: stripJpeg,
    png: stripPng,
    webp: stripWebp,
    heic: stripHeic,
    avif: stripHeic,
    gif: stripGif,
  };
  const data = strippers[format](buffer);

  return { data, format, originalSize: buffer.byteLength, strippedSize: data.byteLength };
}
