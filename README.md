# EXIF Stripper

Strip EXIF and metadata from images entirely in your browser. No files are uploaded to any server.

**Live:** https://exif.faffweasel.com

## Supported Formats

- JPEG — removes APP1 (Exif/XMP), APP13 (IPTC), APP2 (ICC)
- PNG — removes tEXt, iTXt, zTXt, eXIf, tIME chunks
- WebP — removes EXIF and XMP chunks
- HEIC/HEIF — removes Exif and XMP items from ISOBMFF container

## How It Works

Images are processed using ArrayBuffer manipulation — no canvas redraw, no re-encoding, no quality loss. The binary metadata segments are removed and the image data is preserved byte-for-byte.

## Development

```bash
npm install
npm run dev
```

## Licence

[AGPL-3.0](LICENCE)

## Contact

https://faffweasel.com
