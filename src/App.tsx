import { useState } from 'react';
import { DropZone } from './components/DropZone';
import { PrivacyNotice } from './components/PrivacyNotice';

const FONT = '"Courier New", Courier, monospace';

export default function App() {
  const [isDark, setIsDark] = useState(false);

  const bg = isDark ? '#111111' : '#f0f0ec';
  const surface = isDark ? '#1a1a1a' : '#ffffff';
  const text = isDark ? '#c8c8c0' : '#1a1a1a';
  const muted = isDark ? '#999999' : '#888888';
  const faint = isDark ? '#808080' : '#aaaaaa';
  const teal = isDark ? '#00a3a3' : '#007070';
  const border = isDark ? '#2a2a2a' : '#c8c8c0';

  return (
    <div style={{ background: bg, minHeight: '100vh', fontFamily: FONT, color: text }}>
      <header
        style={{
          background: surface,
          borderBottom: `1px solid ${border}`,
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
            <div style={{ fontSize: 14, color: muted, marginTop: 2 }}>
              by{' '}
              <a
                href="https://faffweasel.com"
                style={{ color: teal, textDecoration: 'none', borderBottom: `1px solid ${border}` }}
              >
                faffweasel
              </a>
            </div>
          </div>

          <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              style={{
                color: muted,
                border: `1px solid ${border}`,
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
          <h1
            style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 8px 0', letterSpacing: 0.5 }}
          >
            Strip metadata from your images
          </h1>
          <p style={{ fontSize: 16, color: muted, margin: 0, lineHeight: 1.6 }}>
            Remove EXIF data, GPS coordinates, camera info, timestamps.
            <br />
            Everything happens in your browser. Nothing is uploaded.
          </p>
        </div>

        <DropZone isDark={isDark} />
        <PrivacyNotice isDark={isDark} />
      </main>

      <footer
        style={{
          borderTop: `1px solid ${border}`,
          padding: '14px 24px',
          fontSize: 14,
          color: faint,
          textAlign: 'center',
        }}
      >
        <a href="https://faffweasel.com" style={{ color: teal, textDecoration: 'none' }}>
          faffweasel.com
        </a>
        <span style={{ margin: '0 6px' }}>·</span>
        <a
          href="https://github.com/faffweasel/exif-stripper/blob/main/LICENCE"
          style={{ color: teal, textDecoration: 'none' }}
        >
          AGPL-3.0
        </a>
        <span style={{ margin: '0 6px' }}>·</span>
        <a
          href="https://github.com/faffweasel/exif-stripper"
          style={{ color: teal, textDecoration: 'none' }}
        >
          github
        </a>
        <span style={{ margin: '0 6px' }}>·</span>
        <span>EU hosted</span>
      </footer>
    </div>
  );
}
