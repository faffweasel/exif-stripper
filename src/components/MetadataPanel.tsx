import ExifReader from 'exifreader';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import type { ImageFormat } from '../lib/detect-format';

interface Props {
  readonly originalBuffer: ArrayBuffer;
  readonly strippedBuffer?: ArrayBuffer;
  readonly fileName: string;
  readonly filterText?: string;
  readonly format?: ImageFormat;
}

type Category =
  | 'Location'
  | 'Camera'
  | 'Date/Time'
  | 'Software'
  | 'Image'
  | 'Other'
  | 'Image Structure';

interface TagEntry {
  name: string;
  value: string;
}

const CATEGORY_MAP: Record<string, Category> = {
  GPSLatitude: 'Location',
  GPSLongitude: 'Location',
  GPSAltitude: 'Location',
  GPSTimeStamp: 'Location',
  GPSDateStamp: 'Location',
  GPSLatitudeRef: 'Location',
  GPSLongitudeRef: 'Location',
  GPSAltitudeRef: 'Location',
  Make: 'Camera',
  Model: 'Camera',
  LensModel: 'Camera',
  LensMake: 'Camera',
  DateTimeOriginal: 'Date/Time',
  CreateDate: 'Date/Time',
  ModifyDate: 'Date/Time',
  DateTimeDigitized: 'Date/Time',
  Software: 'Software',
  ProcessingSoftware: 'Software',
  HostComputer: 'Software',
  Orientation: 'Image',
  ColorSpace: 'Image',
  // Structural tags — file-header variants (with spaces) and EXIF variants (no spaces)
  'Bits Per Sample': 'Image Structure',
  'Image Height': 'Image Structure',
  'Image Width': 'Image Structure',
  'Color Components': 'Image Structure',
  Subsampling: 'Image Structure',
  BitsPerSample: 'Image Structure',
  ImageWidth: 'Image Structure',
  ImageHeight: 'Image Structure',
};

const CATEGORY_ORDER: readonly Category[] = [
  'Location',
  'Camera',
  'Date/Time',
  'Software',
  'Image',
  'Other',
  'Image Structure',
];
const DEFAULT_EXPANDED: ReadonlySet<Category> = new Set(['Location', 'Camera']);
const SKIP_TAGS: ReadonlySet<string> = new Set([
  'Thumbnail',
  'Images',
  'FileType',
  '_raw',
  'MakerNote',
  'UserComment',
]);

function getDescription(tag: unknown): string | null {
  if (tag === null || tag === undefined || typeof tag !== 'object') return null;
  const record = tag as Record<string, unknown>; // safe: typeof tag === 'object' confirmed above
  const desc = record.description;
  if (typeof desc !== 'string' || desc.startsWith('<') || desc.length > 500) return null;
  return desc;
}

function parseGroups(buffer: ArrayBuffer): Map<Category, TagEntry[]> | null {
  let raw: ExifReader.Tags;
  try {
    raw = ExifReader.load(buffer);
  } catch (err) {
    if (err instanceof ExifReader.errors.MetadataMissingError) {
      return new Map();
    }
    return null;
  }

  const grouped = new Map<Category, TagEntry[]>();
  for (const cat of CATEGORY_ORDER) {
    grouped.set(cat, []);
  }

  for (const [name, tag] of Object.entries(raw)) {
    if (SKIP_TAGS.has(name)) continue;
    const value = getDescription(tag);
    if (value === null) continue;
    const category = CATEGORY_MAP[name] ?? 'Other';
    const bucket = grouped.get(category);
    if (bucket) bucket.push({ name, value });
  }

  return grouped;
}

const STRUCTURAL_SUBTITLE =
  'Structural properties required by the image format. Cannot be removed.';

function Section({
  category,
  tags,
  isStripped,
  isStructural = false,
}: {
  readonly category: Category;
  readonly tags: readonly TagEntry[];
  readonly isStripped: boolean;
  readonly isStructural?: boolean;
}) {
  const [expanded, setExpanded] = useState(DEFAULT_EXPANDED.has(category));
  const applyStrikethrough = isStripped && !isStructural;

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex justify-between items-center py-1.5 bg-transparent border-0 cursor-pointer text-left"
        style={{
          fontFamily: '"Courier New", Courier, monospace',
          color: 'var(--text)',
          fontSize: 14,
        }}
      >
        <span className="font-bold tracking-[0.5px] uppercase">{category}</span>
        <span style={{ color: 'var(--muted)' }}>
          {tags.length} {tags.length === 1 ? 'tag' : 'tags'}&nbsp;
          <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
        </span>
      </button>
      {isStructural && (
        <div
          style={{
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: 12,
            color: 'var(--faint)',
            paddingBottom: 6,
          }}
        >
          {STRUCTURAL_SUBTITLE}
        </div>
      )}
      {expanded && (
        <div className="pb-2">
          {tags.map(({ name, value }) => (
            <div
              key={name}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(min-content, 160px) 1fr',
                gap: '0 16px',
                padding: '3px 0',
                textDecoration: applyStrikethrough ? 'line-through' : 'none',
                color: applyStrikethrough ? 'var(--muted)' : undefined,
                fontSize: 14,
              }}
            >
              <span style={{ color: applyStrikethrough ? 'inherit' : 'var(--muted)' }}>{name}</span>
              <span
                style={{
                  color: applyStrikethrough ? 'inherit' : 'var(--text)',
                  overflowWrap: 'break-word',
                  minWidth: 0,
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const VIDEO_FORMATS = new Set(['mp4', 'mov']);

export function MetadataPanel({ originalBuffer, strippedBuffer, filterText = '', format }: Props) {
  const grouped = useMemo(() => parseGroups(originalBuffer), [originalBuffer]);
  const isStripped = strippedBuffer !== undefined;

  const mono: CSSProperties = { fontFamily: '"Courier New", Courier, monospace' };

  if (grouped === null) {
    const message =
      format !== undefined && VIDEO_FORMATS.has(format)
        ? 'Metadata preview not available for video files'
        : 'Metadata preview unavailable';
    return (
      <div style={{ ...mono, color: 'var(--faint)', fontSize: 14, padding: '12px 0' }}>
        {message}
      </div>
    );
  }

  const needle = filterText.toLowerCase();
  const sections = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    tags: (grouped.get(cat) ?? []).filter((t) => !needle || t.name.toLowerCase().includes(needle)),
  })).filter((s) => s.tags.length > 0);

  if (sections.length === 0) {
    return (
      <div style={{ ...mono, color: 'var(--faint)', fontSize: 14, padding: '12px 0' }}>
        {needle ? 'No tags match filter' : 'No metadata detected'}
      </div>
    );
  }

  return (
    <div style={mono}>
      {sections.map(({ category, tags }) => (
        <Section
          key={category}
          category={category}
          tags={tags}
          isStripped={isStripped}
          isStructural={category === 'Image Structure'}
        />
      ))}
      <div
        className="py-2 font-bold text-[14px]"
        style={{ color: 'var(--accent)' }}
        aria-live="polite"
        aria-atomic="true"
      >
        {isStripped && (
          <>
            <span aria-hidden="true">✓ </span>All metadata removed
          </>
        )}
      </div>
    </div>
  );
}
