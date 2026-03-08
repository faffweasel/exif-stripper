# EXIF Stripper

## What this is
Client-side EXIF/metadata stripping tool. Browser-based, no server.
ArrayBuffer manipulation only — no canvas redraw, no re-encoding.

## Stack

React + Vite + TypeScript + Tailwind CSS v4. Single-page app, no routing. Biome for linting/formatting (not ESLint/Prettier).

## Architecture

- `src/lib/` — pure stripping logic, extracted as npm package later (`@faffweasel/strip-metadata`)
  - `ArrayBuffer` in → `Uint8Array` out
  - Never imports from React, DOM APIs, `src/components/`, or `node_modules`
  - No `File`, `Blob`, `FileReader`, `URL.createObjectURL` — those belong in the UI layer
  - No `import.meta` references
- `src/components/` — React UI components
- Formats: JPEG, PNG, WebP, HEIC

## Key Constraints

- Detect format from magic bytes, never from file extension
- Strip metadata by removing binary segments — never re-encode the image
- Never use canvas redraw for stripping
- Tailwind utility classes only, no custom CSS files



```
src/
├── lib/
│   ├── detect-format.ts      ← magic byte detection
│   ├── strip-jpeg.ts         ← JPEG metadata removal
│   ├── strip-png.ts          ← PNG metadata removal
│   ├── strip-webp.ts         ← WebP metadata removal
│   ├── strip-heic.ts         ← HEIC/HEIF metadata removal (ISOBMFF)
│   └── strip.ts              ← public API: detect + dispatch
├── components/
│   ├── DropZone.tsx           ← drag-and-drop + processed result (both states)
│   └── PrivacyNotice.tsx
├── App.tsx
├── main.tsx
└── index.css
```

## Design Reference

Match the ExifTool component in `faffweasel-full-mockup.jsx`.

### Colour Tokens

| Token | Light | Dark |
|---|---|---|
| bg | `#f0f0ec` | `#111111` |
| surface | `#ffffff` | `#1a1a1a` |
| text | `#1a1a1a` | `#c8c8c0` |
| muted | `#888888` | `#666666` |
| faint | `#aaaaaa` | `#555555` |
| accent (teal) | `#007070` | `#008080` |
| border | `#c8c8c0` | `#2a2a2a` |

### Typography

- Font: `"Courier New", Courier, monospace` everywhere. No web fonts.
- Headings: bold, letter-spacing 0.5–2px, uppercase for labels
- Body: 12–13px

### Layout

- Max width: 640px, centred
- Header: "EXIF STRIPPER" left, "how it works / source / dark|light" right
- Subtitle: "by faffweasel" (linked)
- Drop zone: dashed 2px border, "+" icon, "Drop images here or click to select"
  - Format line: "JPEG · PNG · WebP — up to 50MB"
  - Drag-over: teal border, faint teal background
- After processing (replaces drop zone content, not a separate list):
  - Filename + size with teal ✓
  - Two-column before/after: red-tinted "BEFORE (N FIELDS)" / green-tinted "AFTER (0 FIELDS) ✓ Clean"
  - "DOWNLOAD CLEAN IMAGE" button: teal bg, white text, uppercase, letter-spacing
- Privacy text below drop zone, separated by border-top
- Footer: "faffweasel.com · AGPL-3.0 · github · EU hosted" centred

### Dark Mode

Full dark theme toggle in header. Not an inversion — separate palette.

### What NOT to Do

- No system sans-serif font — monospace throughout
- No separate FileList below the drop zone — result displays inside the drop zone
- No animations beyond 0.15s border/background transition on drag
- No web fonts, no external font requests

## Commands
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run check` — biome lint + format

## Public API (src/lib/strip.ts)

export interface StripResult {
  data: Uint8Array;
  format: 'jpeg' | 'png' | 'webp' | 'heic';
  originalSize: number;
  strippedSize: number;
}

export function stripMetadata(buffer: ArrayBuffer): StripResult;

## Licence

AGPL-3.0


## Commit Messages
- Keep commit messages and PR descriptions straightforward like an experienced engineer
- Brief descriptions, highlighting any choices that weren't obvious
- No buzzwords, marketing, or pitches. Just meaningful messages