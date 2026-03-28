import { useRef } from 'react';

interface Props {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function MetadataSearch({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

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
        aria-label="Filter metadata tags"
        className="w-full px-3 py-1.5 text-[13px] pr-7"
        style={{
          fontFamily: '"Courier New", Courier, monospace',
          color: 'var(--text)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxSizing: 'border-box',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-0 leading-none"
          style={{ color: 'var(--muted)', fontSize: 16 }}
          aria-label="Clear filter"
        >
          ×
        </button>
      )}
    </div>
  );
}
