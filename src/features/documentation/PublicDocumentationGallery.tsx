/**
 * @license
 * SiEpang - Public Event Documentation Gallery (Part 50-65, 87-90, 95-96, 125-126)
 * Official photo and video documentation accessible without login:
 * - Album filtering & search
 * - Lazy loaded responsive image grid
 * - High-performance modern Lightbox with next/prev and mobile swipe
 * - Safe embedded video player with fallback to provider
 * - Photo download permission controls (VIEW_ONLY vs ALLOW_ORIGINAL_LINK)
 * - Empty state handling
 */

import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Film,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Download,
  Calendar,
  Layers,
  Sparkles,
  Search,
  Eye,
  ArrowLeft,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { documentationService } from '../../services/documentationService';
import { eventService } from '../../services/eventService';
import { PhotoAlbum, MediaItem } from '../../types';
import { GlobalFooter } from '../../components/layout/GlobalFooter';

/** Convert Drive file viewer links to image URLs without changing GAS records. */
function imageUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    if (url.hostname === 'drive.google.com') {
      const id = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1] || url.searchParams.get('id');
      if (id && /^[A-Za-z0-9_-]{10,}$/.test(id)) return `https://drive.google.com/thumbnail?id=${id}&sz=w1280`;
      if (url.pathname.includes('/folders/')) return '';
    }
    return value;
  } catch { return ''; }
}

function photoPage(item: MediaItem): string {
  const source = item.source_page_url || item.source_url || '';
  try {
    const url = new URL(source);
    return url.protocol === 'https:' && (item.source_page_url || (url.hostname === 'drive.google.com' && url.pathname.includes('/folders/'))) ? source : '';
  } catch { return ''; }
}

/** Only allow supported HTTPS providers in an embedded player. */
function resolveVideo(item: MediaItem): { kind: 'iframe' | 'file' | 'link'; url: string; thumbnail: string } {
  const source = item.source_url || '';
  let url: URL;
  try { url = new URL(source); } catch { return { kind: 'link', url: source, thumbnail: item.thumbnail_url }; }
  if (url.protocol !== 'https:') return { kind: 'link', url: '', thumbnail: item.thumbnail_url };
  const host = url.hostname.toLowerCase();
  let ytId = '';
  if (host === 'youtu.be' || host === 'www.youtu.be') ytId = url.pathname.split('/')[1] || '';
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    ytId = url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')
      ? url.pathname.split('/')[2] || '' : url.searchParams.get('v') || '';
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(ytId)) return {
    kind: 'iframe', url: `https://www.youtube-nocookie.com/embed/${ytId}`,
    thumbnail: item.thumbnail_url || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
  };
  if (host === 'drive.google.com') {
    const id = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.searchParams.get('id') || '';
    if (/^[a-zA-Z0-9_-]{10,}$/.test(id)) return {
      kind: 'iframe', url: `https://drive.google.com/file/d/${id}/preview`,
      thumbnail: item.thumbnail_url || `https://drive.google.com/thumbnail?id=${id}&sz=w1280`,
    };
  }
  if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) return { kind: 'file', url: source, thumbnail: item.thumbnail_url };
  return { kind: 'link', url: source, thumbnail: item.thumbnail_url };
}


/** Resolve a direct thumbnail URL where the provider supports one. Social post URLs
 * are not assumed to be image URLs; those require thumbnail_url from the GAS record. */
function resolvePhotoThumbnail(item: MediaItem): string {
  if (item.thumbnail_url) return imageUrl(item.thumbnail_url);
  const source = item.source_url || '';
  try {
    const url = new URL(source);
    const host = url.hostname.toLowerCase();
    let youtubeId = '';
    if (host === 'youtu.be' || host === 'www.youtu.be') youtubeId = url.pathname.split('/')[1] || '';
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      youtubeId = url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] || '' : url.searchParams.get('v') || '';
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    if (host === 'drive.google.com') {
      const driveId = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.searchParams.get('id') || '';
      if (/^[A-Za-z0-9_-]{10,}$/.test(driveId)) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1280`;
    }
    return imageUrl(source);
  } catch { return ''; }
}

const Thumbnail: React.FC<{ src?: string; alt: string; kind: 'photo' | 'video' }> = ({ src, alt, kind }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 dark:from-slate-800 dark:to-slate-900 dark:text-slate-300" role="img" aria-label={`Thumbnail ${kind === 'photo' ? 'foto' : 'video'} belum tersedia`}>
      {kind === 'photo' ? <ImageIcon className="h-8 w-8" /> : <Film className="h-8 w-8" />}
      <span className="px-3 text-center text-[10px] font-medium">Thumbnail belum tersedia. Pastikan file dapat dilihat publik.</span>
    </div>
  );
  return <img src={imageUrl(src)} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />;
};

interface PublicDocumentationGalleryProps {
  onBackToHome?: () => void;
  initialTab?: 'photos' | 'videos';
}

export const PublicDocumentationGallery: React.FC<PublicDocumentationGalleryProps> = ({
  onBackToHome,
  initialTab = 'photos',
}) => {
  const [activeTab] = useState<'photos' | 'videos'>(initialTab);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visiblePhotoCount, setVisiblePhotoCount] = useState<number>(12);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeVideoItem, setActiveVideoItem] = useState<MediaItem | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [publishedMedia, setPublishedMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError('');
    documentationService.loadPublicGallery().then(items => {
      if (alive) setPublishedMedia(items);
    }).catch(err => {
      if (alive) setLoadError(err instanceof Error ? err.message : 'Gagal memuat galeri dari server.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // Touch swipe state for Lightbox (Section 10)
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const event = eventService.getCurrentEvent();
  const albums: PhotoAlbum[] = []; // Album management is not yet supplied by gallery.public.list.
  const photos = publishedMedia.filter(item => item.media_type === 'PHOTO');
  const videos = publishedMedia.filter(item => item.media_type === 'VIDEO');

  // Reset pagination when album or search query changes
  useEffect(() => {
    setVisiblePhotoCount(12);
  }, [selectedAlbumId, searchQuery]);

  // Filter photos based on album and search
  const filteredPhotos = photos.filter(p => {
    const matchesAlbum = selectedAlbumId === 'all' || p.album_id === selectedAlbumId;
    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.caption && p.caption.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesAlbum && matchesSearch;
  });

  // Photos to render for performance (Section 8)
  const displayedPhotos = filteredPhotos.slice(0, visiblePhotoCount);

  // Filter videos based on search
  const filteredVideos = videos.filter(v => {
    return (
      !searchQuery ||
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.caption && v.caption.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const currentLightboxPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;
  const currentPhotoAlbum = currentLightboxPhoto?.album_id
    ? albums.find(a => a.album_id === currentLightboxPhoto.album_id)
    : null;

  const handleOpenLightbox = (index: number) => {
    setLightboxIndex(index);
    const item = filteredPhotos[index];
    if (item) {
      // Public view statistics are not yet exposed by the GAS Gallery API.
    }
  };

  const handleNextPhoto = () => {
    if (lightboxIndex !== null && lightboxIndex < filteredPhotos.length - 1) {
      handleOpenLightbox(lightboxIndex + 1);
    } else if (lightboxIndex !== null && lightboxIndex === filteredPhotos.length - 1) {
      handleOpenLightbox(0); // loop around
    }
  };

  const handlePrevPhoto = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      handleOpenLightbox(lightboxIndex - 1);
    } else if (lightboxIndex !== null && lightboxIndex === 0) {
      handleOpenLightbox(filteredPhotos.length - 1); // loop around
    }
  };

  // Touch gesture listeners (Section 10)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };
  const handleTouchEnd = () => {
    if (touchStartX !== null && touchEndX !== null) {
      const distance = touchStartX - touchEndX;
      if (distance > 50) {
        handleNextPhoto(); // swiped left
      } else if (distance < -50) {
        handlePrevPhoto(); // swiped right
      }
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  const handlePlayVideo = (video: MediaItem) => {
    setActiveVideoItem(video);
    // Public play statistics are not yet exposed by the GAS Gallery API.
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Galeri Dokumentasi | ${event.name}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex !== null) {
        if (e.key === 'ArrowRight') handleNextPhoto();
        if (e.key === 'ArrowLeft') handlePrevPhoto();
        if (e.key === 'Escape') setLightboxIndex(null);
      }
      if (activeVideoItem && e.key === 'Escape') {
        setActiveVideoItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, activeVideoItem, filteredPhotos.length]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#121215]/90 backdrop-blur-md border-b border-black/5 dark:border-white/10 px-4 py-3 sm:px-6 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title="Kembali ke Beranda"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Beranda</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Dokumentasi Resmi Kegiatan
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                  Publik
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {event.name} · {event.campGround}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-black/5 dark:border-white/10 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copyFeedback ? 'Tersalin ✓' : 'Bagikan'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1 w-full">
        {/* Gallery Intro Banner */}
        <div className="rounded-[28px] bg-gradient-to-r from-[#208C60]/10 via-[#F47743]/10 to-amber-500/10 dark:from-[#208C60]/20 dark:via-[#141418] dark:to-black border border-black/5 dark:border-white/10 p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Arsip Foto & Rekaman Video Perkemahan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Galeri Kenangan & Jejak Prestasi Pramuka
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Koleksi dokumentasi resmi kegiatan, apel pembukaan, giat materi penjelajahan rimba, dan malam api unggun untuk peserta, orang tua, dan pembina pendamping.
            </p>
          </div>
        </div>

        {loading && <div role="status" className="text-center rounded-2xl bg-white dark:bg-[#121215] p-8 text-sm text-slate-600 dark:text-slate-300">Memuat foto dan video dari SiEpang...</div>}
        {!loading && loadError && (
          <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-950/20 p-5 text-sm">
            <p className="font-bold text-red-700 dark:text-red-300">Galeri belum dapat dimuat</p>
            <p className="text-slate-600 dark:text-slate-300 mt-1">{loadError}</p>
            <button type="button" onClick={() => setReloadKey(v => v + 1)} className="mt-3 rounded-xl bg-[#208C60] text-white px-4 py-2 font-semibold">Coba Lagi</button>
          </div>
        )}
        {/* Search across both media grids */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><ImageIcon className="h-4 w-4" /> Foto ({photos.length})</span>
            <span className="inline-flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"><Film className="h-4 w-4" /> Video ({videos.length})</span>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Cari foto atau video kegiatan..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-[#208C60] focus:outline-none dark:border-white/10 dark:bg-[#121215] dark:text-white" />
          </div>
        </div>

        {/* ALBUM SELECTOR (Only in Photos tab) */}
        {activeTab === 'photos' && albums.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              Pilih Album Foto:
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedAlbumId('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
                  selectedAlbumId === 'all'
                    ? 'bg-[#208C60] text-white border-[#208C60]'
                    : 'bg-white dark:bg-[#121215] text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/10 hover:border-[#208C60]/40'
                }`}
              >
                Semua Album ({photos.length})
              </button>

              {albums.map(alb => (
                <button
                  key={alb.album_id}
                  type="button"
                  onClick={() => setSelectedAlbumId(alb.album_id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border flex items-center gap-1.5 ${
                    selectedAlbumId === alb.album_id
                      ? 'bg-[#208C60] text-white border-[#208C60]'
                      : 'bg-white dark:bg-[#121215] text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/10 hover:border-[#208C60]/40'
                  }`}
                >
                  <Layers className="w-3 h-3 text-purple-400" />
                  <span>{alb.album_name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({alb.photo_count})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PHOTO GRID */}
        {!loading && !loadError && (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900 dark:text-white">Foto Kegiatan</h2><p className="text-xs text-slate-500 dark:text-slate-400">Dokumentasi foto resmi yang telah dipublikasikan.</p></div><span className="text-xs font-semibold text-slate-500">{filteredPhotos.length} foto</span></div>
            {filteredPhotos.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/5 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-2xl">
                  📷
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Belum ada dokumentasi foto</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Foto resmi kegiatan akan diunggah oleh panitia dokumentasi selama perkemahan berlangsung.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {displayedPhotos.map((photo, idx) => (
                    <div
                      key={photo.media_id}
                      onClick={() => {
                        if (photoPage(photo)) window.open(photoPage(photo), '_blank', 'noopener,noreferrer');
                        else handleOpenLightbox(idx);
                      }}
                      className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 hover:border-[#208C60]/50 transition-all duration-300 shadow-xs flex flex-col"
                    >
                      {/* Image Thumbnail with lazy loading */}
                      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-black/40 relative">
                        <Thumbnail src={resolvePhotoThumbnail(photo)} alt={photo.title} kind="photo" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                          <span className="text-[10px] text-white flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            <span>{photoPage(photo) ? 'Buka Halaman Sumber' : 'Perbesar Foto'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="p-2.5 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-[#208C60] dark:group-hover:text-[#F47743] transition-colors">
                            {photo.title}
                          </h4>
                          {photo.caption && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {photo.caption}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 mt-2 font-mono">
                          <span>{photo.event_date}</span>
                          {photo.views_count ? <span>{photo.views_count} views</span> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Section 8: Load More / Pagination Button */}
                {visiblePhotoCount < filteredPhotos.length && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setVisiblePhotoCount(prev => prev + 12)}
                      className="px-6 py-2.5 rounded-2xl bg-white dark:bg-[#121215] border border-black/10 dark:border-white/10 hover:border-[#208C60] text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs hover:shadow-md transition-all active:scale-98"
                    >
                      <span>Muat Lebih Banyak Foto ({filteredPhotos.length - visiblePhotoCount} tersisa)</span>
                    </button>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      Menampilkan {displayedPhotos.length} dari {filteredPhotos.length} foto resmi
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* VIDEO GRID */}
        {!loading && !loadError && (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900 dark:text-white">Video Resmi</h2><p className="text-xs text-slate-500 dark:text-slate-400">Putar dokumentasi video tanpa meninggalkan halaman.</p></div><span className="text-xs font-semibold text-slate-500">{filteredVideos.length} video</span></div>
            {filteredVideos.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/5 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-2xl">
                  🎬
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Belum ada video kegiatan</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Video highlight dan liputan resmi perkemahan akan segera ditayangkan di sini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {filteredVideos.map(video => (
                  <div
                    key={video.media_id}
                    onClick={() => {
                      if (video.source_page_url) window.open(video.source_page_url, '_blank', 'noopener,noreferrer');
                      else handlePlayVideo(video);
                    }}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 hover:border-[#F47743]/50 transition-all duration-300 shadow-xs flex flex-col"
                  >
                    {/* Video Thumbnail with centered play icon */}
                    <div className="aspect-video w-full overflow-hidden bg-black/60 relative">
                      <Thumbnail src={resolveVideo(video).thumbnail || undefined} alt={video.title} kind="video" />
                      {/* Centered Play Button with subtle gradient ring */}
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full p-[1.5px] bg-gradient-to-tr from-[#208C60] via-[#F47743] to-[#FFD36A] shadow-lg group-hover:scale-110 transition-transform">
                          <div className="w-full h-full rounded-full bg-black/80 flex items-center justify-center text-white">
                            <Play className="w-5 h-5 fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Duration Tag */}
                      {video.duration && (
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-mono font-bold">
                          {video.duration}
                        </div>
                      )}

                      {/* Provider badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-slate-200 text-[9px] font-mono">
                        {video.provider}
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="p-2.5 sm:p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-[#F47743] transition-colors">
                          {video.title}
                        </h4>
                        {video.caption && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                            {video.caption}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-black/5 dark:border-white/5 font-mono">
                        <span>{video.event_date}</span>
                        {video.plays_count ? <span>{video.plays_count} putar</span> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* 3. PHOTO LIGHTBOX MODAL (Section 10) */}
      {currentLightboxPhoto && (
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4 select-none animate-in fade-in"
        >
          {/* Top Bar with Close & Actions */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pt-safe">
            <div className="text-xs text-slate-300 font-mono">
              Foto {lightboxIndex! + 1} dari {filteredPhotos.length} {currentPhotoAlbum ? `· ${currentPhotoAlbum.album_name}` : ''}
            </div>

            <div className="flex items-center gap-2">
              {currentLightboxPhoto.download_control === 'ALLOW_ORIGINAL_LINK' && currentLightboxPhoto.original_url && (
                <a
                  href={currentLightboxPhoto.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Unduh resolusi asli"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Unduh Asli</span>
                </a>
              )}

              {currentLightboxPhoto.source_page_url && (
                <a
                  href={currentLightboxPhoto.source_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Buka halaman sumber"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Halaman Sumber</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Tutup Pratinjau"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={handlePrevPhoto}
            className="absolute left-2 sm:left-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all hover:scale-105"
            aria-label="Foto Sebelumnya"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={handleNextPhoto}
            className="absolute right-2 sm:right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all hover:scale-105"
            aria-label="Foto Selanjutnya"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Main Large Image & Caption */}
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center justify-center p-2">
            <img
              src={resolvePhotoThumbnail(currentLightboxPhoto)}
              alt={currentLightboxPhoto.title}
              className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />

            <div className="text-center mt-3 max-w-xl space-y-1">
              <h3 className="text-base font-bold text-white">
                {currentLightboxPhoto.title}
              </h3>
              {currentLightboxPhoto.caption && (
                <p className="text-xs text-slate-300">{currentLightboxPhoto.caption}</p>
              )}
              <div className="text-[11px] text-purple-300 font-mono">
                {currentPhotoAlbum ? `${currentPhotoAlbum.album_name} · ` : ''}{currentLightboxPhoto.event_date} · {event.name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. VIDEO PLAYER MODAL (Part 59, 112) */}
      {activeVideoItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 animate-in fade-in">
          <div className="w-full max-w-3xl bg-white dark:bg-[#121215] border border-black/10 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/10">
              <div className="min-w-0 pr-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  {activeVideoItem.title}
                </h3>
                <div className="text-[11px] text-purple-600 dark:text-purple-400 font-mono">
                  {activeVideoItem.event_date} · Penyedia: {activeVideoItem.provider}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideoItem(null)}
                className="p-2 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Embedded Player or Fallback View */}
            <div className="aspect-video w-full bg-black relative">
              {resolveVideo(activeVideoItem).kind === 'iframe' ? (
                <iframe
                  src={resolveVideo(activeVideoItem).url}
                  title={activeVideoItem.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              ) : resolveVideo(activeVideoItem).kind === 'file' ? (
                <video src={resolveVideo(activeVideoItem).url} controls autoPlay playsInline className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#208C60]/20 text-[#208C60] dark:text-[#F47743] flex items-center justify-center text-3xl">
                    🎬
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">Pemutaran Sematan Eksternal</h4>
                    <p className="text-xs text-slate-400 max-w-md">
                      Video ini dihosting di {activeVideoItem.provider}. Klik tombol di bawah untuk membuka video di tab baru.
                    </p>
                  </div>
                  <a
                    href={activeVideoItem.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-gradient-to-r from-[#208C60] to-[#F47743] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                  >
                    <span>Buka Video di {activeVideoItem.provider}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Video description & external action */}
            <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs border-t border-black/5 dark:border-white/10">
              <div className="text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg">
                {activeVideoItem.caption || 'Dokumentasi resmi liputan video kegiatan perkemahan.'}
              </div>
              <a
                href={activeVideoItem.source_page_url || activeVideoItem.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <span>Buka Tautan Asli</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Global Footer (Preserve reusable global footer) */}
      <GlobalFooter />
    </div>
  );
};
