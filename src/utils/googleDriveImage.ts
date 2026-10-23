/**
 * Normalize common Google Drive sharing URLs to an image URL suitable for <img>.
 * This does not bypass Drive permissions: the file must be accessible to the viewer.
 */
const cleanText = (value: unknown): string => String(value ?? '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/\u00A0/g, ' ')
  .trim()
  .replace(/^['\"]+|['\"]+$/g, '')
  .trim();

const validDriveId = (value: string): boolean => /^[A-Za-z0-9_-]{10,}$/.test(value);

export function resolveGoogleDriveImageUrl(value: unknown, fileIdValue?: unknown, width = 1000): string {
  const fileId = cleanText(fileIdValue);
  if (validDriveId(fileId)) {
    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w${Math.max(64, Math.min(2400, Math.round(width)))}`;
  }

  const raw = cleanText(value);
  if (!raw || /^(data|blob):/i.test(raw)) return '';

  // A raw Drive file ID may be stored in the photo URL column by older imports.
  if (validDriveId(raw) && !/^https?:\/\//i.test(raw)) {
    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(raw)}=w${Math.max(64, Math.min(2400, Math.round(width)))}`;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    let id = '';

    if (host === 'drive.google.com' || host === 'drive.usercontent.google.com') {
      const match = parsed.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/i);
      id = match?.[1] || parsed.searchParams.get('id') || '';
      if (validDriveId(id)) {
        return `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w${Math.max(64, Math.min(2400, Math.round(width)))}`;
      }
      return '';
    }

    if (host === 'lh3.googleusercontent.com' || host.endsWith('.googleusercontent.com')) {
      const match = parsed.pathname.match(/\/d\/([A-Za-z0-9_-]+)/i);
      if (match?.[1] && validDriveId(match[1])) {
        return `https://lh3.googleusercontent.com/d/${encodeURIComponent(match[1])}=w${Math.max(64, Math.min(2400, Math.round(width)))}`;
      }
      return raw;
    }

    // Preserve other HTTPS image URLs (e.g. approved external image hosts).
    return raw;
  } catch {
    return '';
  }
}
