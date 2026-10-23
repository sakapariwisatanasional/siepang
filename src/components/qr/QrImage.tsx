import React, { useEffect, useState } from 'react';
import * as QRCode from 'qrcode';

interface QrImageProps {
  value?: string;
  size?: number;
  className?: string;
  imageClassName?: string;
  emptyLabel?: string;
  subtitle?: string;
}

export const QrImage: React.FC<QrImageProps> = ({
  value,
  size = 200,
  className = '',
  imageClassName = '',
  emptyLabel = 'Token QR belum tersedia',
  subtitle = 'Simpan pengaturan atau aktifkan QR untuk membuat token resmi.',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let active = true;

    const generate = async () => {
      if (!value || !value.trim()) {
        setDataUrl('');
        setError('');
        return;
      }
      try {
        const url = await QRCode.toDataURL(value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#111827',
            light: '#FFFFFF',
          },
        });
        if (active) {
          setDataUrl(url);
          setError('');
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Gagal membuat QR code');
          setDataUrl('');
        }
      }
    };

    generate();
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!value || !value.trim()) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500 ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="px-4 text-sm font-semibold">{emptyLabel}</div>
        <div className="mt-2 px-4 text-[11px] leading-relaxed text-slate-400">{subtitle}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-center text-red-500 ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="px-4 text-sm font-semibold">QR tidak dapat dibuat</div>
        <div className="mt-2 px-4 text-[11px] leading-relaxed text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={dataUrl}
        alt="QR Code"
        className={`block h-full w-full object-contain ${imageClassName}`}
      />
    </div>
  );
};
