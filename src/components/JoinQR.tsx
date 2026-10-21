import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { joinUrl } from '../lib/rooms';
import { cx } from './ui';

export function useQR(text: string) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: 720, errorCorrectionLevel: 'M', color: { dark: '#0B0F1B', light: '#FFFFFF' } })
      .then((u) => alive && setSrc(u)).catch(() => alive && setSrc(''));
    return () => { alive = false; };
  }, [text]);
  return src;
}

export function JoinQR({ code, className }: { code: string; className?: string }) {
  const src = useQR(joinUrl(code));
  return (
    <div className={cx('aspect-square overflow-hidden rounded-2xl bg-white p-2', className)}>
      {src ? <img src={src} alt="Scan to join your team room" className="h-full w-full" style={{ imageRendering: 'pixelated' }} /> : null}
    </div>
  );
}
