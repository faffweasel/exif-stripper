import { useCallback, useState } from 'react';
import { DropZone } from './components/DropZone';
import { PrivacyNotice } from './components/PrivacyNotice';

const FONT = '"Courier New", Courier, monospace';

function getInitialDark(): boolean {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(isDark: boolean) {
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

// Apply before first render to avoid flash of wrong theme
applyTheme(getInitialDark());

export default function App() {
  const [isDark, setIsDark] = useState(getInitialDark);

  const handleToggle = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    applyTheme(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }, [isDark]);

  return (
    <div
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        fontFamily: FONT,
        color: 'var(--text)',
      }}
    >
      <header
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 'bold', letterSpacing: 1 }}>EXIF STRIPPER</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>
              by{' '}
              <a
                href="https://faffweasel.com"
                style={{
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                faffweasel
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            aria-label="Toggle dark mode"
            aria-pressed={isDark}
            style={{
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              padding: '2px 6px',
              fontSize: 14,
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            {isDark ? 'light' : 'dark'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 8px 0', letterSpacing: 0.5 }}>
            Strip metadata from your images
          </h1>
          <p style={{ fontSize: 16, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
            Remove EXIF data, GPS coordinates, camera info, timestamps.
            <br />
            Everything happens in your browser. Nothing is uploaded.
          </p>
        </div>

        <DropZone isDark={isDark} />
        <PrivacyNotice />
      </main>

      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '14px 24px',
          fontSize: 14,
          color: 'var(--muted)',
          textAlign: 'center',
        }}
      >
        <a href="https://faffweasel.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          faffweasel.com
        </a>
        <span style={{ margin: '0 6px' }}>·</span>
        <a
          href="https://github.com/faffweasel/exif-stripper/blob/main/LICENCE"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
        >
          AGPL-3.0
        </a>
        <span style={{ margin: '0 6px' }}>·</span>
        <a
          href="https://github.com/faffweasel/exif-stripper"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
        >
          source
        </a>
        <span style={{ margin: '0 6px' }}>·</span>
        <span>EU hosted</span>
      </footer>
    </div>
  );
}
