import { useRef, useState } from 'react';
import type { StripResult } from '../lib/strip';
import { stripMetadata } from '../lib/strip';
import { MetadataPanel } from './MetadataPanel';
import { MetadataSearch } from './MetadataSearch';

interface Props {
  readonly isDark: boolean;
}

type UIState =
  | { status: 'idle' }
  | { status: 'processing'; message: string }
  | { status: 'preview'; file: File; originalBuffer: ArrayBuffer }
  | {
      status: 'done';
      file: File;
      result: StripResult;
      blob: Blob;
      originalBuffer: ArrayBuffer;
      strippedBuffer: ArrayBuffer;
    }
  | { status: 'error'; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_SIZE = 50 * 1024 * 1024;

const MIME: Record<StripResult['format'], string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

export function DropZone({ isDark }: Props) {
  const [uiState, setUiState] = useState<UIState>({ status: 'idle' });
  const [filterText, setFilterText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragCount = useRef(0); // counter to avoid flicker when cursor moves over child elements
  const inputRef = useRef<HTMLInputElement>(null);

  const teal = isDark ? '#00a3a3' : '#007070';
  const muted = isDark ? '#999999' : '#888888';
  const faint = isDark ? '#808080' : '#aaaaaa';

  function handleFile(file: File) {
    if (file.size > MAX_SIZE) {
      setUiState({ status: 'error', message: 'File too large. Maximum size is 50 MB.' });
      return;
    }
    setUiState({ status: 'processing', message: 'Reading file...' });
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer; // safe: readAsArrayBuffer always returns ArrayBuffer
      setUiState({ status: 'preview', file, originalBuffer: buffer });
    };
    reader.onerror = () => setUiState({ status: 'error', message: 'Failed to read file.' });
    reader.readAsArrayBuffer(file);
  }

  function handleStrip() {
    if (uiState.status !== 'preview') return;
    const { file, originalBuffer } = uiState;
    setUiState({ status: 'processing', message: 'Stripping metadata...' });
    // Defer strip to next task so the processing state paints before the synchronous work blocks the thread
    setTimeout(() => {
      try {
        const result = stripMetadata(originalBuffer);
        const strippedBuffer = result.data.buffer as ArrayBuffer; // safe: strip functions return newly allocated Uint8Arrays
        const blob = new Blob([strippedBuffer], { type: MIME[result.format] });
        setUiState({ status: 'done', file, result, blob, originalBuffer, strippedBuffer });
      } catch (err) {
        const isUnsupported = err instanceof Error && err.message.startsWith('Unsupported format');
        setUiState({
          status: 'error',
          message: isUnsupported
            ? `${file.name} is not a supported format. Supported: JPEG, PNG, WebP, HEIC.`
            : `Failed to process ${file.name}. The file may be corrupted.`,
        });
      }
    }, 0);
  }

  function handleDragEnter() {
    dragCount.current++;
    setIsDragging(true);
  }

  function handleDragLeave() {
    dragCount.current--;
    if (dragCount.current === 0) setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCount.current = 0;
    setIsDragging(false);
    setUiState({ status: 'idle' });
    setFilterText('');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUiState({ status: 'idle' });
    setFilterText('');
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (uiState.status !== 'done') return;
    const url = URL.createObjectURL(uiState.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stripped-${uiState.file.name}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const isClickable = uiState.status !== 'processing';

  const borderColor = isDragging ? teal : isDark ? '#333333' : '#b0b0a8';
  const bgColor = isDragging
    ? isDark
      ? 'rgba(0,128,128,0.05)'
      : 'rgba(0,112,112,0.03)'
    : isDark
      ? '#1a1a1a'
      : '#ffffff';

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
        className="hidden"
        onChange={handleInputChange}
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
        aria-label="Select files to strip metadata"
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
            <div className="text-[32px] mb-2.5" style={{ opacity: 0.4, color: muted }}>
              +
            </div>
            <div className="text-[16px] mb-1" style={{ color: isDark ? '#c8c8c0' : '#1a1a1a' }}>
              Drop images here or click to select
            </div>
            <div className="text-[14px]" style={{ color: faint }}>
              JPEG · PNG · WebP — up to 50MB
            </div>
          </>
        )}

        {uiState.status === 'processing' && (
          <div className="text-[16px]" style={{ color: muted }}>
            {uiState.message}
          </div>
        )}

        {uiState.status === 'error' && (
          <>
            <div className="text-[16px] mb-3" style={{ color: isDark ? '#c66666' : '#a44444' }}>
              {uiState.message}
            </div>
            <div className="text-[14px]" style={{ color: faint }}>
              Click to try another file
            </div>
          </>
        )}

        {uiState.status === 'preview' && (
          <>
            <div className="text-[16px] mb-4" style={{ color: isDark ? '#c8c8c0' : '#1a1a1a' }}>
              {uiState.file.name}
              <span style={{ color: muted }}> ({formatBytes(uiState.file.size)})</span>
            </div>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation barrier — prevents drop zone click/key handler from firing on metadata panel interactions */}
            <div
              className="text-left max-w-[460px] mx-auto"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <MetadataSearch value={filterText} onChange={setFilterText} isDark={isDark} />
              <MetadataPanel
                originalBuffer={uiState.originalBuffer}
                fileName={uiState.file.name}
                isDark={isDark}
                filterText={filterText}
              />
              <button
                type="button"
                onClick={handleStrip}
                className="w-full text-[16px] font-bold tracking-[0.5px] text-white py-2.5 mt-4 cursor-pointer border-0"
                style={{ background: teal }}
              >
                STRIP METADATA
              </button>
            </div>
          </>
        )}

        {uiState.status === 'done' && (
          <>
            <div className="text-[16px] mb-4" style={{ color: isDark ? '#c8c8c0' : '#1a1a1a' }}>
              <span style={{ color: teal }}>✓</span> {uiState.file.name}
              <span style={{ color: muted }}> ({formatBytes(uiState.file.size)})</span>
            </div>

            {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation barrier — prevents drop zone click/key handler from firing on metadata panel interactions */}
            <div
              className="text-left max-w-[460px] mx-auto mb-4"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <MetadataSearch value={filterText} onChange={setFilterText} isDark={isDark} />
              <MetadataPanel
                originalBuffer={uiState.originalBuffer}
                strippedBuffer={uiState.strippedBuffer}
                fileName={uiState.file.name}
                isDark={isDark}
                filterText={filterText}
              />
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="text-[16px] font-bold tracking-[0.5px] text-white px-6 py-2 cursor-pointer border-0"
              style={{ background: teal }}
            >
              DOWNLOAD CLEAN FILE
            </button>
            <div className="mt-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterText('');
                  setUiState({ status: 'idle' });
                }}
                className="text-[14px] cursor-pointer border-0 bg-transparent underline"
                style={{ color: teal }}
              >
                Strip another image
              </button>
            </div>
          </>
        )}
      </div>

      <div
        className="text-center text-[13px] mb-6"
        style={{ color: faint, fontFamily: '"Courier New", Courier, monospace' }}
      >
        Supports JPEG · PNG · WebP · HEIC
      </div>
    </>
  );
}
