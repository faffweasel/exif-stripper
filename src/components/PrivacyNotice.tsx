interface Props {
  readonly isDark: boolean;
}

export function PrivacyNotice({ isDark }: Props) {
  const muted = isDark ? '#999999' : '#888888';
  const teal = isDark ? '#00a3a3' : '#007070';
  const border = isDark ? '#2a2a2a' : '#c8c8c0';

  return (
    <div
      style={{
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 16,
        lineHeight: 1.7,
        color: muted,
        borderTop: `1px solid ${border}`,
        paddingTop: 20,
      }}
    >
      <p style={{ margin: '0 0 8px 0' }}>
        Images are processed entirely in the browser using client-side JavaScript. No files touch
        any server. The{' '}
        <a
          href="https://github.com/faffweasel/exif-stripper"
          style={{ color: teal, textDecoration: 'none' }}
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
