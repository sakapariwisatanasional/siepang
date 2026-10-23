import React, { useEffect, useMemo, useState } from 'react';
import { resolveGoogleDriveImageUrl } from '../utils/googleDriveImage';

interface ParticipantAvatarProps {
  name: string;
  src?: string | null;
  fileId?: string | null;
  className?: string;
  fallbackClassName?: string;
  width?: number;
}

function initials(name: string): string {
  const parts = String(name || 'Peserta').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map(part => part.charAt(0)).join('').toUpperCase() || 'P';
}

/** Foto peserta yang mendukung URL berbagi Google Drive dan fallback inisial jika gagal dimuat. */
export const ParticipantAvatar: React.FC<ParticipantAvatarProps> = ({
  name, src, fileId, className = '', fallbackClassName = '', width = 500,
}) => {
  const imageUrl = useMemo(() => resolveGoogleDriveImageUrl(src, fileId, width), [src, fileId, width]);
  const [failedUrl, setFailedUrl] = useState('');

  useEffect(() => { setFailedUrl(''); }, [imageUrl]);

  if (imageUrl && failedUrl !== imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name || 'Foto peserta'}
        className={className}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(imageUrl)}
      />
    );
  }

  return (
    <div aria-label={`Avatar ${name || 'peserta'}`} role="img" className={fallbackClassName}>
      {initials(name)}
    </div>
  );
};
