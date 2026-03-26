import { useRef, useState } from 'react';
import { stripMetadata } from '../lib/strip';
import type { StripResult } from '../lib/strip';

interface Props {
  readonly isDark: boolean;
}

type UIState =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'done'; file: File; result: StripResult; blob: Blob }
  | { status: 'error'; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const MIME: Record<StripResult['format'], string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

export function DropZone({ isDark }: Props) {
  const [uiState, setUiState] = useState<UIState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const dragCount = useRef(0); // counter to avoid flicker when cursor moves over child elements
  const inputRef = useRef<HTMLInputElement>(null);

  const teal = isDark ? '#00a3a3' : '#007070';
  const muted = isDark ? '#999999' : '#888888';
  const faint = isDark ? '#808080' : '#aaaaaa';

  function handleFile(file: File) {
    setUiState({ status: 'processing' });
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer; // safe: readAsArrayBuffer guarantees ArrayBuffer
        const result = stripMetadata(buffer);
        const blob = new Blob([result.data.buffer as ArrayBuffer], { type: MIME[result.format] });
        setUiState({ status: 'done', file, result, blob });
      } catch (err) {
        setUiState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to process image.',
        });
      }
    };
    reader.onerror = () => setUiState({ status: 'error', message: 'Failed to read file.' });
    reader.readAsArrayBuffer(file);
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
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    URL.revokeObjectURL(url);
  }

  const isClickable = uiState.status !== 'processing';

  const borderColor = isDragging ? teal : (isDark ? '#333333' : '#b0b0a8');
  const bgColor = isDragging
    ? (isDark ? 'rgba(0,128,128,0.05)' : 'rgba(0,112,112,0.03)')
    : (isDark ? '#1a1a1a' : '#ffffff');

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
        className="hidden"
        onChange={handleInputChange}
      />

      <div
        onClick={() => isClickable && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && isClickable && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
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
            <div className="text-[32px] mb-2.5" style={{ opacity: 0.4, color: muted }}>+</div>
            <div className="text-[16px] mb-1" style={{ color: isDark ? '#c8c8c0' : '#1a1a1a' }}>
              Drop images here or click to select
            </div>
            <div className="text-[14px]" style={{ color: faint }}>
              JPEG · PNG · WebP — up to 50MB
            </div>
          </>
        )}

        {uiState.status === 'processing' && (
          <div className="text-[16px]" style={{ color: muted }}>Processing...</div>
        )}

        {uiState.status === 'error' && (
          <>
            <div className="text-[16px] mb-3" style={{ color: isDark ? '#c66666' : '#a44444' }}>
              {uiState.message}
            </div>
            <div className="text-[14px]" style={{ color: faint }}>Click to try another file</div>
          </>
        )}

        {uiState.status === 'done' && (
          <>
            <div className="text-[16px] mb-4" style={{ color: isDark ? '#c8c8c0' : '#1a1a1a' }}>
              <span style={{ color: teal }}>✓</span>{' '}
              {uiState.file.name}
              <span style={{ color: muted }}> ({formatBytes(uiState.file.size)})</span>
            </div>

            <div className="flex gap-4 text-left text-[14px] max-w-[460px] mx-auto mb-4">
              <div className="flex-1">
                <div
                  className="font-bold text-[14px] tracking-[1px] mb-1.5"
                  style={{ color: isDark ? '#c66666' : '#a44444' }}
                >
                  BEFORE (12 FIELDS)
                </div>
                <div
                  style={{
                    background: isDark ? '#1e1515' : '#faf8f6',
                    border: `1px solid ${isDark ? '#332222' : '#e0dcd8'}`,
                    padding: 8,
                    lineHeight: 1.8,
                    color: muted,
                  }}
                >
                  {/* TODO(complete): Replace hardcoded fields with real metadata from exifreader */}
                  <div>Camera: iPhone 15 Pro</div>
                  <div>GPS: 51.5074°N, 0.1278°W</div>
                  <div>Date: 2026-03-08 14:32</div>
                  <div>Software: iOS 19.3.1</div>
                  <div style={{ color: faint }}>+ 8 more...</div>
                </div>
              </div>

              <div className="flex-1">
                <div
                  className="font-bold text-[14px] tracking-[1px] mb-1.5"
                  style={{ color: teal }}
                >
                  AFTER (0 FIELDS)
                </div>
                <div
                  style={{
                    background: isDark ? '#151e15' : '#f6faf6',
                    border: `1px solid ${isDark ? '#223322' : '#d8e0d8'}`,
                    padding: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 100,
                    color: teal,
                  }}
                >
                  ✓ Clean
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="text-[16px] font-bold tracking-[0.5px] text-white px-6 py-2 cursor-pointer border-0"
              style={{ background: teal }}
            >
              DOWNLOAD CLEAN IMAGE
            </button>
            <div className="mt-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setUiState({ status: 'idle' }); }}
                className="text-[14px] cursor-pointer border-0 bg-transparent underline"
                style={{ color: teal }}
              >
                Strip another image
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
