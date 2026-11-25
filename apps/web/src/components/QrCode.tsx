// Draws the otpauth:// link of the TOTP setup (D36) as a QR code, in ink on the card surface.
import QRCode from 'qrcode';
import { useMemo } from 'react';

/** Medium error correction: still scans with a reflection on the screen, without making the code dense. */
const ERROR_CORRECTION_LEVEL = 'M';

/** One SVG path with a 1×1 square per dark module: lighter than one <rect> each. */
function modulesToPath(text: string): { size: number; path: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: ERROR_CORRECTION_LEVEL });
  const squares: string[] = [];
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) squares.push(`M${column} ${row}h1v1h-1z`);
    }
  }
  return { size: modules.size, path: squares.join('') };
}

export function QrCode({ text, label, size }: { text: string; label: string; size: number }) {
  const qr = useMemo(() => modulesToPath(text), [text]);
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
    >
      <path d={qr.path} fill="var(--color-ink)" />
    </svg>
  );
}
