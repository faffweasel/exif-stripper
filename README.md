# EXIF Stripper

Strip metadata from images, video, and audio files entirely in your browser. No files touch any server.

**Live:** https://exif.faffweasel.com

## Screenshots

![Empty drop zone showing supported format indicators](docs/screenshots/empty.png)

![Single file with metadata comparison showing fields before and after stripping](docs/screenshots/single.png)

![Batch processing multiple files with progress indicators](docs/screenshots/batch.png)

![Dark mode view of the EXIF Stripper interface](docs/screenshots/darkmode.png)

## Supported Formats

| Format | What's stripped |
|--------|---------------|
| JPEG | APP1 (Exif/XMP), APP2 (ICC), APP13 (IPTC) |
| PNG | tEXt, iTXt, zTXt, eXIf, tIME chunks |
| WebP | EXIF and XMP chunks from RIFF container |
| HEIC/HEIF | Exif and XMP items from ISOBMFF container |
| AVIF | Exif and XMP items from ISOBMFF container |
| GIF | Comment extensions, XMP application extensions |
| MP4 | User data (udta), XMP, GPS coordinates |
| MOV | User data (udta), XMP, GPS coordinates |
| M4A | User data (udta), XMP, iTunes-style tags |

## How It Works

Files are processed using ArrayBuffer manipulation. No canvas redraw, no re-encoding, no quality loss. Binary metadata segments are removed and file data is preserved byte-for-byte. 

## Privacy

- All processing happens in your browser via client-side JavaScript
- No files are uploaded to any server
- No tracking, no analytics, no cookies
- The source code is open and auditable

## Known Limitations

- Video: fragmented MP4 (fMP4) is not supported.
- HEIC metadata preview may not display in all browsers (stripping still works).

## Development

```bash
npm install
npm run dev
```

---

## Licence

All code in this repository is licensed under the AGPL-3.0
[AGPL-3.0](LICENCE)

---

### Logo Licence

The Faffweasel logos are copyright © Phill Richardson, all rights reserved,
and may not be used without permission. If you would like to use the logos or
icons, please contact the author for permission.

---

Copyright © 2026 Phill Richardson
https://www.gnu.org/licenses/agpl-3.0.txt