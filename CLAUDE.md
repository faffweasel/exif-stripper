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

## Architecture
- `src/lib/` — pure stripping logic. NO React, NO DOM APIs, NO File/Blob/FileReader.
  ArrayBuffer in → Uint8Array out. This will be extracted as an npm package later.
- `src/components/` — React UI components
- Formats: JPEG, PNG, WebP, HEIC

## File Structure

src/
├── lib/
│   ├── detect-format.ts   ← magic byte detection
│   ├── strip-jpeg.ts      ← JPEG metadata removal
│   ├── strip-png.ts       ← PNG metadata removal
│   ├── strip-webp.ts      ← WebP metadata removal
│   ├── strip-heic.ts      ← HEIC/HEIF metadata removal (ISOBMFF)
│   └── strip.ts           ← public API: detect + dispatch
├── components/
│   ├── DropZone.tsx
│   ├── FileList.tsx
│   └── PrivacyNotice.tsx
├── App.tsx
├── main.tsx
└── index.css

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