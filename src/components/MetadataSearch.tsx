import { useRef } from 'react';

interface Props {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly isDark: boolean;
}

export function MetadataSearch({ value, onChange, isDark }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const text = isDark ? '#c8c8c0' : '#1a1a1a';
  const muted = isDark ? '#999999' : '#888888';
  const border = isDark ? '#2a2a2a' : '#c8c8c0';
  const surface = isDark ? '#1a1a1a' : '#ffffff';

  function handleClear() {
    onChange('');
    inputRef.current?.focus();
  }

  return (
    <div className="relative w-full mb-3">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter tags... (e.g. GPS, Camera)"
        className="w-full px-3 py-1.5 text-[13px] pr-7"
        style={{
          fontFamily: '"Courier New", Courier, monospace',
          color: text,
          background: surface,
          border: `1px solid ${border}`,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-0 leading-none"
          style={{ color: muted, fontSize: 16 }}
          aria-label="Clear filter"
        >
          ×
        </button>
      )}
    </div>
  );
}
