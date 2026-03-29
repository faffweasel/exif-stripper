import { detectFormat, type MediaFormat } from './detect-format';
import { stripGif } from './strip-gif';
import { stripHeic } from './strip-heic';
import { stripJpeg } from './strip-jpeg';
import { stripPng } from './strip-png';
import { stripVideo } from './strip-video';
import { stripWebp } from './strip-webp';

export interface StripResult {
  data: Uint8Array;
  format: MediaFormat;
  originalSize: number;
  strippedSize: number;
}

export function stripMetadata(buffer: ArrayBuffer): StripResult {
  const format = detectFormat(buffer);
  if (format === null) {
    throw new Error(
      'Unsupported format. Supported formats: JPEG, PNG, WebP, HEIC, AVIF, GIF, MP4, MOV.'
    );
  }

  // avif uses the same ISOBMFF container as heic; mp4 and mov share the same video stripper
  const strippers = {
    jpeg: stripJpeg,
    png: stripPng,
    webp: stripWebp,
    heic: stripHeic,
    avif: stripHeic,
    gif: stripGif,
    mp4: stripVideo,
    mov: stripVideo,
  };
  const data = strippers[format](buffer);

  return { data, format, originalSize: buffer.byteLength, strippedSize: data.byteLength };
}
