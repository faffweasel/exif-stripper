export function PrivacyNotice() {
  return (
    <div
      style={{
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 16,
        lineHeight: 1.7,
        color: 'var(--muted)',
        borderTop: '1px solid var(--border)',
        paddingTop: 20,
      }}
    >
      <p style={{ margin: '0 0 8px 0' }}>
        Images are processed entirely in the browser using client-side JavaScript. No files touch
        any server. The{' '}
        <a
          href="https://github.com/faffweasel/exif-stripper"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
        >
          source code
        </a>{' '}
        is open and auditable.
      </p>
      <p style={{ margin: 0 }}>
        EXIF metadata can reveal your location, device, timestamps, and software. Strip it before
        sharing.
      </p>
    </div>
  );
}
