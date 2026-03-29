import { zipSync } from 'fflate';
import { useEffect, useRef, useState } from 'react';
import { detectFormat } from '../lib/detect-format';
import type { StripResult } from '../lib/strip';
import { stripMetadata } from '../lib/strip';
import { getFilesFromDataTransfer } from '../utils/folder-enumerate';
import { MetadataPanel } from './MetadataPanel';
import { MetadataSearch } from './MetadataSearch';

interface Props {
  readonly isDark: boolean;
}

interface FileEntry {
  readonly id: number;
  readonly file: File;
  readonly status: 'queued' | 'processing' | 'done' | 'error' | 'skipped';
  readonly result?: StripResult;
  readonly blob?: Blob;
  readonly originalBuffer?: ArrayBuffer;
  readonly strippedBuffer?: ArrayBuffer;
  readonly errorMessage?: string;
}

type UIState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'preview'; file: File; originalBuffer: ArrayBuffer }
  | { status: 'processing'; message: string }
  | {
      status: 'done';
      file: File;
      result: StripResult;
      blob: Blob;
      originalBuffer: ArrayBuffer;
      strippedBuffer: ArrayBuffer;
    }
  | { status: 'batch'; entries: readonly FileEntry[]; isComplete: boolean };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const MAX_FILES = 20;
const VIDEO_FORMATS = new Set(['mp4', 'mov']);

function maxSizeForBuffer(buffer: ArrayBuffer): number {
  const fmt = detectFormat(buffer);
  return fmt !== null && VIDEO_FORMATS.has(fmt) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
}

function maxSizeLabel(isVideo: boolean): string {
  return isVideo ? '500 MB' : '50 MB';
}

const MIME: Record<StripResult['format'], string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  avif: 'image/avif',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer); // safe: readAsArrayBuffer always returns ArrayBuffer
    reader.onerror = () => reject(new Error('read error'));
    reader.readAsArrayBuffer(file);
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadAllAsZip(entries: readonly FileEntry[]): void {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const entry of entries) {
    if (entry.status === 'done' && entry.result) {
      files[entry.file.name] = [entry.result.data, { level: 0 }];
    }
  }
  const zip = zipSync(files);
  const blob = new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' }); // safe: fflate always allocates plain ArrayBuffer
  triggerDownload(blob, 'stripped-images.zip');
}

const STATUS_ICON: Record<FileEntry['status'], string> = {
  queued: '○',
  processing: '·',
  done: '✓',
  error: '✗',
  skipped: '—',
};

const STATUS_LABEL: Record<FileEntry['status'], string> = {
  queued: 'Pending',
  processing: 'Processing',
  done: 'Stripped',
  error: 'Failed',
  skipped: 'Skipped',
};

interface FileRowProps {
  readonly entry: FileEntry;
  readonly isDark: boolean;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onDownload: () => void;
}

function FileRow({ entry, isDark, isSelected, onSelect, onDownload }: FileRowProps) {
  const mono = '"Courier New", Courier, monospace';

  const statusIconColor =
    entry.status === 'done'
      ? 'var(--accent)'
      : entry.status === 'error'
        ? 'var(--error)'
        : entry.status === 'processing'
          ? 'var(--muted)'
          : 'var(--faint)';

  const isSelectable = entry.originalBuffer !== undefined;

  const rowContent = (
    <>
      <span
        style={{ flexShrink: 0, width: 14, color: statusIconColor }}
        aria-label={STATUS_LABEL[entry.status]}
        role="img"
      >
        {STATUS_ICON[entry.status]}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          color: 'var(--text)',
        }}
      >
        {entry.file.name}
      </span>
      {entry.status === 'done' && entry.result && (
        <span style={{ color: 'var(--muted)', flexShrink: 0, fontSize: 12 }}>
          {entry.result.format.toUpperCase()}
        </span>
      )}
      {entry.status === 'processing' && (
        <span style={{ color: 'var(--muted)', flexShrink: 0 }}>Processing...</span>
      )}
    </>
  );

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        background: isSelected
          ? isDark
            ? 'rgba(0,163,163,0.08)'
            : 'rgba(0,112,112,0.05)'
          : 'transparent',
        fontFamily: mono,
        fontSize: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isSelectable ? (
          <button
            type="button"
            onClick={onSelect}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              minWidth: 0,
              padding: '7px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: mono,
              fontSize: 14,
            }}
          >
            {rowContent}
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              minWidth: 0,
              padding: '7px 0',
            }}
          >
            {rowContent}
          </div>
        )}
        {entry.status === 'done' && entry.blob && (
          <button
            type="button"
            onClick={onDownload}
            style={{
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: mono,
              fontSize: 14,
              flexShrink: 0,
              padding: '7px 0 7px 8px',
            }}
          >
            Download
          </button>
        )}
      </div>
      {(entry.status === 'error' || entry.status === 'skipped') && entry.errorMessage && (
        <div
          role={entry.status === 'error' ? 'alert' : undefined}
          style={{
            color: entry.status === 'error' ? 'var(--error)' : 'var(--faint)',
            fontSize: 12,
            paddingLeft: 22,
            paddingBottom: 4,
          }}
        >
          {entry.errorMessage}
        </div>
      )}
    </div>
  );
}

export function DropZone({ isDark }: Props) {
  const [uiState, setUiState] = useState<UIState>({ status: 'idle' });
  const [filterText, setFilterText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const dragCount = useRef(0); // counter to avoid flicker when cursor moves over child elements
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef(0); // incremented on each new file/batch to cancel stale async work
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextEntryIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // isDark retained only for rgba overlay values that have no CSS custom property

  function handleSingleFile(file: File) {
    // Reject files over the video limit upfront (format-specific limit checked after reading)
    if (file.size > MAX_VIDEO_SIZE) {
      setUiState({ status: 'error', message: 'File too large. Maximum size is 500 MB.' });
      return;
    }
    const session = sessionRef.current;
    setUiState({ status: 'processing', message: 'Reading file...' });
    const reader = new FileReader();
    reader.onload = () => {
      if (sessionRef.current !== session) return;
      const buffer = reader.result as ArrayBuffer; // safe: readAsArrayBuffer always returns ArrayBuffer
      const limit = maxSizeForBuffer(buffer);
      if (file.size > limit) {
        const isVideo = limit === MAX_VIDEO_SIZE;
        setUiState({
          status: 'error',
          message: `File too large. Maximum size for ${isVideo ? 'video' : 'images'} is ${maxSizeLabel(isVideo)}.`,
        });
        return;
      }
      if (detectFormat(buffer) === null) {
        setUiState({
          status: 'error',
          message: `"${file.name}" is not a supported format. Supported: JPEG, PNG, WebP, HEIC, AVIF, GIF, MP4, and MOV.`,
        });
        return;
      }
      setUiState({ status: 'preview', file, originalBuffer: buffer });
    };
    reader.onerror = () => {
      if (sessionRef.current !== session) return;
      setUiState({ status: 'error', message: 'Failed to read file.' });
    };
    reader.readAsArrayBuffer(file);
  }

  function handleStrip() {
    if (uiState.status !== 'preview') return;
    const { file, originalBuffer } = uiState;
    const session = sessionRef.current;
    setUiState({ status: 'processing', message: 'Stripping metadata...' });
    // Defer to next task so the processing state paints before the synchronous strip blocks the thread
    setTimeout(() => {
      if (sessionRef.current !== session) return;
      try {
        const result = stripMetadata(originalBuffer);
        // slice() gives a fresh Uint8Array<ArrayBuffer> — correct byte range, no subarray ambiguity
        const stripped = result.data.slice();
        const blob = new Blob([stripped], { type: MIME[result.format] });
        setUiState({
          status: 'done',
          file,
          result,
          blob,
          originalBuffer,
          strippedBuffer: stripped.buffer,
        });
      } catch (err) {
        const isUnsupported = err instanceof Error && err.message.startsWith('Unsupported format');
        setUiState({
          status: 'error',
          message: isUnsupported
            ? `${file.name} is not a supported format. Supported: JPEG, PNG, WebP, HEIC, AVIF, GIF, MP4, MOV.`
            : `Failed to process ${file.name}. The file may be corrupted.`,
        });
      }
    }, 0);
  }

  async function processBatch(files: File[], session: number): Promise<void> {
    const draft: FileEntry[] = files.map((file) => ({
      id: nextEntryIdRef.current++,
      file,
      status: 'queued',
    }));
    setUiState({ status: 'batch', entries: [...draft], isComplete: false });

    for (let i = 0; i < files.length; i++) {
      if (sessionRef.current !== session) return;

      const file = files[i];
      draft[i] = { id: draft[i].id, file, status: 'processing' };
      setUiState({ status: 'batch', entries: [...draft], isComplete: false });

      if (file.size > MAX_VIDEO_SIZE) {
        draft[i] = {
          id: draft[i].id,
          file,
          status: 'skipped',
          errorMessage: 'File too large (500 MB limit)',
        };
        setUiState({ status: 'batch', entries: [...draft], isComplete: false });
        continue;
      }

      let buffer: ArrayBuffer;
      try {
        buffer = await readFileAsArrayBuffer(file);
      } catch {
        draft[i] = { id: draft[i].id, file, status: 'error', errorMessage: 'Failed to read file.' };
        setUiState({ status: 'batch', entries: [...draft], isComplete: false });
        continue;
      }

      if (sessionRef.current !== session) return;

      const limit = maxSizeForBuffer(buffer);
      if (file.size > limit) {
        const isVideo = limit === MAX_VIDEO_SIZE;
        draft[i] = {
          id: draft[i].id,
          file,
          status: 'skipped',
          errorMessage: `File too large (${maxSizeLabel(isVideo)} limit)`,
          originalBuffer: buffer,
        };
        setUiState({ status: 'batch', entries: [...draft], isComplete: false });
        continue;
      }

      try {
        const result = stripMetadata(buffer);
        // slice() gives a fresh Uint8Array<ArrayBuffer> — correct byte range, no subarray ambiguity
        const stripped = result.data.slice();
        const blob = new Blob([stripped], { type: MIME[result.format] });
        draft[i] = {
          id: draft[i].id,
          file,
          status: 'done',
          result,
          blob,
          originalBuffer: buffer,
          strippedBuffer: stripped.buffer,
        };
      } catch (err) {
        const isUnsupported = err instanceof Error && err.message.startsWith('Unsupported format');
        draft[i] = {
          id: draft[i].id,
          file,
          status: 'error',
          errorMessage: isUnsupported
            ? 'Unsupported format. Supported: JPEG, PNG, WebP, HEIC, AVIF, GIF, MP4, MOV.'
            : 'Failed to process file. The file may be corrupted.',
          originalBuffer: buffer, // retain so metadata preview works even on unsupported files
        };
      }
      setUiState({ status: 'batch', entries: [...draft], isComplete: false });
    }

    if (sessionRef.current !== session) return;
    setUiState({ status: 'batch', entries: [...draft], isComplete: true });
  }

  function handleFileList(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    if (files.length > MAX_FILES) {
      setUiState({
        status: 'error',
        message: `Maximum 20 files at once. You selected ${files.length}.`,
      });
      return;
    }

    sessionRef.current++;
    setFilterText('');
    setSelectedIndex(null);
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setCopyState('idle');

    if (files.length === 1) {
      handleSingleFile(files[0]);
    } else {
      void processBatch(files, sessionRef.current);
    }
  }

  function handleDragEnter() {
    dragCount.current++;
    setIsDragging(true);
  }

  function handleDragLeave() {
    dragCount.current--;
    if (dragCount.current === 0) setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCount.current = 0;
    setIsDragging(false);

    // Detect folder drop before any await — dataTransfer is only valid synchronously
    let hasDirectory = false;
    const items = e.dataTransfer.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          hasDirectory = true;
          break;
        }
      }
    }

    if (!hasDirectory) {
      handleFileList(e.dataTransfer.files);
      return;
    }

    // Folder drop — reset session state
    sessionRef.current++;
    const session = sessionRef.current;
    setFilterText('');
    setSelectedIndex(null);
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setCopyState('idle');
    setUiState({ status: 'processing', message: 'Scanning folder...' });

    let files: File[];
    let skipped: number;
    try {
      ({ files, skipped } = await getFilesFromDataTransfer(e.dataTransfer));
    } catch {
      if (sessionRef.current !== session) return;
      setUiState({ status: 'error', message: 'Failed to read folder contents.' });
      return;
    }
    if (sessionRef.current !== session) return;

    if (files.length === 0) {
      setUiState({ status: 'error', message: 'No supported files found in folder.' });
      return;
    }

    if (files.length > MAX_FILES) {
      setUiState({
        status: 'error',
        message: `Found ${files.length} supported files. Maximum 20 files at once — select fewer files or a subfolder.`,
      });
      return;
    }

    // Show summary before processing
    const skippedNote = skipped > 0 ? ` (${skipped} skipped — unsupported format)` : '';
    setUiState({
      status: 'processing',
      message: `Found ${files.length} supported file${files.length !== 1 ? 's' : ''}${skippedNote}`,
    });

    // Yield to let summary paint before processing replaces it
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    if (sessionRef.current !== session) return;

    if (files.length === 1) {
      handleSingleFile(files[0]);
    } else {
      void processBatch(files, session);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFileList(e.target.files);
    e.target.value = '';
  }

  async function handleCopy() {
    if (uiState.status !== 'done') return;
    const session = sessionRef.current;
    const mimeType = MIME[uiState.result.format];
    try {
      await navigator.clipboard.write([new ClipboardItem({ [mimeType]: uiState.blob })]);
      if (sessionRef.current !== session) return;
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
      setCopyState('copied');
      copyTimerRef.current = setTimeout(() => {
        setCopyState('idle');
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      if (sessionRef.current !== session) return;
      setCopyState('unavailable');
    }
  }

  function handleReset(e: React.MouseEvent) {
    e.stopPropagation();
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setCopyState('idle');
    sessionRef.current++;
    setFilterText('');
    setSelectedIndex(null);
    setUiState({ status: 'idle' });
  }

  const isClickable = uiState.status === 'idle' || uiState.status === 'error';
  // ClipboardItem.supports() gives accurate per-MIME runtime support (PNG mandated by spec, others browser-dependent).
  // Wrapped in try/catch: pre-M121 Chromium shipped supports() as throwing for unknown types rather than returning false.
  // Falls back to hiding the button in browsers where supports() is absent or misbehaves.
  const canCopy = (() => {
    if (uiState.status !== 'done' || copyState === 'unavailable') return false;
    if (typeof ClipboardItem?.supports !== 'function') return false;
    try {
      return ClipboardItem.supports(MIME[uiState.result.format]);
    } catch {
      return false;
    }
  })();
  const borderColor = isDragging ? 'var(--accent)' : isDark ? '#333333' : '#b0b0a8';
  const bgColor = isDragging
    ? isDark
      ? 'rgba(0,128,128,0.05)'
      : 'rgba(0,112,112,0.03)'
    : 'var(--surface)';

  const batchProcessingIdx =
    uiState.status === 'batch' ? uiState.entries.findIndex((e) => e.status === 'processing') : -1;
  const batchSelected =
    uiState.status === 'batch' && selectedIndex !== null ? uiState.entries[selectedIndex] : null;
  const batchDoneCount =
    uiState.status === 'batch' ? uiState.entries.filter((e) => e.status === 'done').length : 0;

  const dropZoneLabel = (() => {
    switch (uiState.status) {
      case 'idle':
      case 'error':
        return 'Drop zone: drag files here or click to select';
      case 'processing':
        return 'Drop zone: processing files';
      case 'preview':
        return 'Drop zone: 1 file loaded';
      case 'done':
        return 'Drop zone: 1 file loaded';
      case 'batch':
        return uiState.isComplete
          ? `Drop zone: ${uiState.entries.length} files loaded`
          : 'Drop zone: processing files';
      default: {
        const _exhaustive: never = uiState;
        return _exhaustive;
      }
    }
  })();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.gif,.mp4,.mov,.m4v,.m4a"
        className="hidden"
        onChange={handleInputChange}
        aria-label="Select files to strip metadata"
      />

      {/* biome-ignore lint/a11y/useSemanticElements: must be a div — drag events (onDragOver/onDrop) are unreliable on <button> across browsers */}
      <div
        onClick={() => isClickable && inputRef.current?.click()}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') && isClickable && inputRef.current?.click()
        }
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label={dropZoneLabel}
        style={{
          border: `2px dashed ${borderColor}`,
          background: bgColor,
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
          fontFamily: '"Courier New", Courier, monospace',
        }}
        className={`px-6 py-8 text-center mb-6 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {uiState.status === 'idle' && (
          <>
            <div className="text-[32px] mb-2.5" style={{ opacity: 0.4, color: 'var(--muted)' }}>
              +
            </div>
            <div className="text-[16px] mb-1" style={{ color: 'var(--text)' }}>
              Drop files here or click to select
            </div>
            <div className="text-[14px]" style={{ color: 'var(--faint)' }}>
              JPEG · PNG · WebP · HEIC · AVIF · GIF · MP4 · MOV · M4A — 20 files max
            </div>
          </>
        )}

        {uiState.status === 'processing' && (
          <div className="text-[16px]" style={{ color: 'var(--muted)' }} aria-live="polite">
            {uiState.message}
          </div>
        )}

        {uiState.status === 'error' && (
          <>
            <div className="text-[16px] mb-3" style={{ color: 'var(--error)' }} role="alert">
              {uiState.message}
            </div>
            <div className="text-[14px]" style={{ color: 'var(--faint)' }}>
              Click to try another file
            </div>
          </>
        )}

        {uiState.status === 'preview' && (
          <>
            <div className="text-[16px] mb-4" style={{ color: 'var(--text)' }}>
              {uiState.file.name}
              <span style={{ color: 'var(--muted)' }}> ({formatBytes(uiState.file.size)})</span>
            </div>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation barrier — prevents drop zone click/key handler from firing on metadata panel interactions */}
            <div
              className="text-left max-w-[460px] mx-auto"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <MetadataSearch value={filterText} onChange={setFilterText} />
              <MetadataPanel
                originalBuffer={uiState.originalBuffer}
                fileName={uiState.file.name}
                filterText={filterText}
                format={detectFormat(uiState.originalBuffer) ?? undefined}
              />
              <button
                type="button"
                onClick={handleStrip}
                className="w-full text-[16px] font-bold tracking-[0.5px] py-2.5 mt-4 cursor-pointer border-0 hover:opacity-80"
                style={{ background: 'var(--accent)', color: 'var(--bg)', minHeight: 44 }}
              >
                STRIP METADATA
              </button>
            </div>
          </>
        )}

        {uiState.status === 'done' && (
          <>
            <div className="text-[16px] mb-4" style={{ color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)' }} aria-hidden="true">
                ✓
              </span>{' '}
              {uiState.file.name}
              <span style={{ color: 'var(--muted)' }}> ({formatBytes(uiState.file.size)})</span>
            </div>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation barrier — prevents drop zone click/key handler from firing on metadata panel interactions */}
            <div
              className="text-left max-w-[460px] mx-auto"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <MetadataSearch value={filterText} onChange={setFilterText} />
              <MetadataPanel
                originalBuffer={uiState.originalBuffer}
                strippedBuffer={uiState.strippedBuffer}
                fileName={uiState.file.name}
                filterText={filterText}
                format={uiState.result.format}
              />
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerDownload(uiState.blob, `stripped-${uiState.file.name}`);
                  }}
                  className="flex-1 text-[16px] font-bold tracking-[0.5px] py-2.5 cursor-pointer border-0 hover:opacity-80"
                  style={{ background: 'var(--accent)', color: 'var(--bg)', minHeight: 44 }}
                >
                  DOWNLOAD CLEAN FILE
                </button>
                {canCopy && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleCopy();
                      }}
                      className="text-[14px] font-bold tracking-[0.5px] cursor-pointer hover:opacity-80"
                      style={{
                        color: 'var(--accent)',
                        background: 'none',
                        border: '1px solid var(--accent)',
                        padding: '0 16px',
                        flexShrink: 0,
                        fontFamily: '"Courier New", Courier, monospace',
                        minWidth: 90,
                        minHeight: 44,
                      }}
                    >
                      {copyState === 'copied' ? 'COPIED ✓' : 'COPY'}
                    </button>
                    <output className="sr-only">
                      {copyState === 'copied' ? 'Copied to clipboard' : ''}
                    </output>
                  </>
                )}
              </div>
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[14px] cursor-pointer border-0 bg-transparent underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Strip another image
                </button>
              </div>
            </div>
          </>
        )}

        {uiState.status === 'batch' && (
          <>
            {!uiState.isComplete && (
              <div
                className="text-[14px] mb-3"
                style={{ color: 'var(--muted)' }}
                aria-live="polite"
              >
                {batchProcessingIdx >= 0
                  ? `Processing ${batchProcessingIdx + 1} of ${uiState.entries.length}...`
                  : `${batchDoneCount} of ${uiState.entries.length} processed`}
              </div>
            )}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation barrier — prevents drop zone click/key handler from firing on file list interactions */}
            <div
              className="text-left max-w-[460px] mx-auto"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {batchDoneCount >= 2 && (
                <button
                  type="button"
                  onClick={() => downloadAllAsZip(uiState.entries)}
                  className="w-full text-[14px] font-bold tracking-[0.5px] py-2 mb-3 cursor-pointer border-0 hover:opacity-80"
                  style={{ background: 'var(--accent)', color: 'var(--bg)', minHeight: 44 }}
                >
                  DOWNLOAD ALL ({batchDoneCount} FILES)
                </button>
              )}
              <div className="mb-2">
                {uiState.entries.map((entry, i) => (
                  <FileRow
                    key={entry.id}
                    entry={entry}
                    isDark={isDark}
                    isSelected={selectedIndex === i}
                    onSelect={() => setSelectedIndex((prev) => (prev === i ? null : i))}
                    onDownload={() =>
                      entry.blob && triggerDownload(entry.blob, `stripped-${entry.file.name}`)
                    }
                  />
                ))}
              </div>
              {batchSelected !== null && batchSelected.originalBuffer !== undefined && (
                <div className="mt-4">
                  <MetadataSearch value={filterText} onChange={setFilterText} />
                  <MetadataPanel
                    originalBuffer={batchSelected.originalBuffer}
                    strippedBuffer={batchSelected.strippedBuffer}
                    fileName={batchSelected.file.name}
                    filterText={filterText}
                    format={
                      batchSelected.result?.format ??
                      detectFormat(batchSelected.originalBuffer) ??
                      undefined
                    }
                  />
                </div>
              )}
              {uiState.isComplete && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[14px] cursor-pointer border-0 bg-transparent underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    Strip another batch
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div
        className="text-center text-[13px] mb-6"
        style={{ color: 'var(--muted)', fontFamily: '"Courier New", Courier, monospace' }}
      >
        Supports JPEG · PNG · WebP · HEIC · AVIF · GIF · MP4 · MOV · M4A
      </div>
    </>
  );
}
