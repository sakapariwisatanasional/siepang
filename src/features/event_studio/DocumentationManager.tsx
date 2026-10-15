/**
 * @license
 * SiEpang - Documentation & Media Management Studio (Sections 5, 6, 7, 11, 12, 15)
 * Admin panel for managing official event photography albums, Google Drive folders, and video highlights.
 */

import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Film,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  Play,
  Layers,
  Sparkles,
  Search,
  Eye,
  Lock,
  Download,
  ShieldCheck,
  X,
  Clock,
  ArrowRight,
  FolderCheck,
  Check,
} from 'lucide-react';
import { documentationService } from '../../services/documentationService';
import { mediaResolverService } from '../../services/mediaResolverService';
import { PhotoAlbum, MediaItem, MediaAccessStatus, MediaPublicationStatus } from '../../types';

export const DocumentationManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'albums' | 'photos' | 'videos' | 'resolver'>('albums');
  const [albums, setAlbums] = useState<PhotoAlbum[]>(documentationService.getAlbums());
  const [photos, setPhotos] = useState<MediaItem[]>(documentationService.getMediaItems({ type: 'PHOTO' }));
  const [videos, setVideos] = useState<MediaItem[]>(documentationService.getMediaItems({ type: 'VIDEO' }));

  // Modal: Add Album State (Section 5 & 6)
  const [showAddAlbumModal, setShowAddAlbumModal] = useState(false);
  const [albumForm, setAlbumForm] = useState({
    album_name: '',
    description: '',
    source_folder_url: '',
    cover_image_url: '',
    publication_status: 'DRAFT' as MediaPublicationStatus,
  });
  const [validationState, setValidationState] = useState<{
    status: MediaAccessStatus;
    message: string;
    resolvedPhotos?: Array<{
      source_url: string;
      thumbnail_url: string;
      title: string;
      caption: string;
      provider_resource_id: string;
    }>;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [albumError, setAlbumError] = useState('');
  const [albumReceipt, setAlbumReceipt] = useState<ReturnType<typeof documentationService.getLastAlbumReceipt>>(null);

  // Modal: Add Photo State
  const [showAddPhotoModal, setShowAddPhotoModal] = useState(false);
  const [photoForm, setPhotoForm] = useState({
    album_id: albums[0]?.album_id || '',
    source_url: '',
    title: '',
    caption: '',
    event_date: new Date().toISOString().slice(0, 10),
    download_control: 'ALLOW_ORIGINAL_LINK' as 'VIEW_ONLY' | 'ALLOW_ORIGINAL_LINK',
  });

  // Modal: Add Video State (Section 11)
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [videoForm, setVideoForm] = useState({
    source_url: '',
    title: '',
    description: '',
    category: 'Highlight Kegiatan',
    event_date: new Date().toISOString().slice(0, 10),
    duration: '03:30',
    thumbnail_override: '',
  });
  const [videoPreviewResult, setVideoPreviewResult] = useState<any>(null);

  // Media Resolver sandbox state (Section 4 & 12)
  const [testUrl, setTestUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [testResult, setTestResult] = useState(mediaResolverService.resolveSource(testUrl));

  // Syncing state for specific albums
  const [syncingAlbumId, setSyncingAlbumId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const reloadData = () => {
    setAlbums(documentationService.getAlbums());
    setPhotos(documentationService.getMediaItems({ type: 'PHOTO' }));
    setVideos(documentationService.getMediaItems({ type: 'VIDEO' }));
  };

  useEffect(() => {
    const unsub = documentationService.subscribe(reloadData);
    return () => unsub();
  }, []);

  // Spreadsheet is authoritative. On every fresh mount, load albums from GAS.
  useEffect(() => {
    let active = true;
    setLoadingAlbums(true);
    void documentationService.loadAlbumsFromGas()
      .then(() => { if (active) setAlbumError(''); })
      .catch(err => { if (active) setAlbumError(err instanceof Error ? err.message : 'Gagal memuat album dari Spreadsheet.'); })
      .finally(() => { if (active) setLoadingAlbums(false); });
    return () => { active = false; };
  }, []);

  // NEVER scan the folder, resolve photos, or populate cover when creating an album.
  const handleValidateDriveUrl = (url: string) => {
    setAlbumForm(prev => ({ ...prev, source_folder_url: url }));
    setValidationState(null);
  };
  const handleRetryValidation = () => {
    showToast('Tautan folder disimpan sebagai metadata; verifikasi akses Drive tidak mengimpor foto.');
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAlbum) return;
    if (!albumForm.album_name.trim()) { setAlbumError('Nama album wajib diisi.'); return; }
    setSavingAlbum(true);
    setAlbumError('');
    setAlbumReceipt(null);
    try {
      const album = await documentationService.createAlbum({
        album_name: albumForm.album_name.trim(),
        description: albumForm.description.trim(),
        source_folder_url: albumForm.source_folder_url.trim(),
        // Explicit cover only; no thumbnails from Drive or fake media.
        cover_image_url: albumForm.cover_image_url.trim(),
        publication_status: albumForm.publication_status,
      });
      const receipt = documentationService.getLastAlbumReceipt();
      if (!receipt || receipt.album_id !== album.album_id || receipt.sheet !== 'DocumentationAlbums') {
        throw new Error('Bukti verifikasi album tidak lengkap. Periksa Spreadsheet sebelum mencoba lagi.');
      }
      await documentationService.loadAlbumsFromGas();
      setAlbumReceipt(receipt);
      setShowAddAlbumModal(false);
      setAlbumForm({ album_name: '', description: '', source_folder_url: '', cover_image_url: '', publication_status: 'DRAFT' });
      showToast(`Album '${album.album_name}' tersimpan di Spreadsheet. Tidak ada foto/video yang dibuat.`);
    } catch (err: any) {
      setAlbumError(err?.message || 'Penyimpanan album belum dapat diverifikasi. Jangan klik Simpan berulang kali.');
    } finally {
      setSavingAlbum(false);
    }
  };

  // Existing media sync only mutates frontend memory: keep unavailable until GAS media persistence exists.
  const handleSyncAlbum = (_album: PhotoAlbum) => {
    showToast('Sinkronisasi media belum tersedia: album tetap kosong sampai media ditambahkan dan disimpan permanen melalui GAS.');
  };

  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoForm.source_url || !photoForm.title) return;

    try {
      documentationService.addPhoto(photoForm);
      setShowAddPhotoModal(false);
      setPhotoForm({
        album_id: albums[0]?.album_id || '',
        source_url: '',
        title: '',
        caption: '',
        event_date: new Date().toISOString().slice(0, 10),
        download_control: 'ALLOW_ORIGINAL_LINK',
      });
      showToast('✓ Foto berhasil ditambahkan ke album.');
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan foto.');
    }
  };

  // Handle Video URL change with live preview (Section 11 & 12)
  const handleVideoUrlChange = (url: string) => {
    setVideoForm(prev => ({ ...prev, source_url: url }));
    if (!url.trim()) {
      setVideoPreviewResult(null);
      return;
    }
    const resolved = mediaResolverService.resolveSource(url);
    setVideoPreviewResult(resolved);
    if (!videoForm.title && resolved.title) {
      setVideoForm(prev => ({ ...prev, title: resolved.title || '' }));
    }
  };

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoForm.source_url || !videoForm.title) return;

    try {
      documentationService.addVideo({
        source_url: videoForm.source_url,
        title: videoForm.title,
        description: videoForm.description ? `[${videoForm.category}] ${videoForm.description}` : `[${videoForm.category}]`,
        event_date: videoForm.event_date,
        duration: videoForm.duration,
        thumbnail_override: videoForm.thumbnail_override || undefined,
      });
      setShowAddVideoModal(false);
      setVideoForm({
        source_url: '',
        title: '',
        description: '',
        category: 'Highlight Kegiatan',
        event_date: new Date().toISOString().slice(0, 10),
        duration: '03:30',
        thumbnail_override: '',
      });
      setVideoPreviewResult(null);
      showToast('✓ Video highlight kegiatan berhasil ditambahkan.');
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan video.');
    }
  };

  const handleRefreshMetadata = () => {
    const res = documentationService.refreshMediaMetadata();
    showToast(`✓ Metadata diperbarui (${res.refreshedCount} media diverifikasi, ${res.brokenCount} perlu perbaikan).`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold flex items-center justify-between shadow-xl animate-in fade-in z-50">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white dark:hover:text-black">✕</button>
        </div>
      )}

      {/* Header Banner with Actions */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Dokumentasi Resmi Event (Cloud & Drive Storage)</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Manajemen Dokumentasi Foto & Video Kegiatan
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            Sinkronkan album Google Drive secara otomatis dan tayangkan video highlight perkemahan tanpa perlu unggah satu per satu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshMetadata}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1.5 border border-black/5 dark:border-white/10 transition-colors"
            title="Periksa ulang akses Google Drive & thumbnail"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Refresh Metadata</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddAlbumModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#208C60] to-[#F47743] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:opacity-90 active:scale-98 transition-all"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Tambah Album Drive</span>
          </button>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-black/5 dark:border-white/10 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('albums')}
          className={`pb-2.5 font-bold transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'albums'
              ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Album Foto ({albums.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('photos')}
          className={`pb-2.5 font-bold transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'photos'
              ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Semua Foto ({photos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('videos')}
          className={`pb-2.5 font-bold transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'videos'
              ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Video Highlight ({videos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resolver')}
          className={`pb-2.5 font-bold transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'resolver'
              ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>MediaResolver Diagnostic</span>
        </button>
      </div>

      {albumError && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 text-rose-800 p-3 text-xs">{albumError}</div>}
      {albumReceipt && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 p-3 text-xs space-y-1">
        <p className="font-bold">Album tersimpan dan terbaca ulang dari Google Sheets — tanpa foto/video otomatis.</p>
        <p>Album ID: {albumReceipt.album_id}</p><p>Sheet: {albumReceipt.sheet} · Baris: {albumReceipt.row}</p>
        <p>Event: {albumReceipt.event_id} · Terverifikasi: {albumReceipt.verified_at}</p>
      </div>}
      {loadingAlbums && <p role="status" className="text-xs text-slate-500">Memuat album dari Spreadsheet...</p>}
      {/* TAB 1: ALBUMS LIST */}
      {activeTab === 'albums' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Total {albums.length} album terdaftar untuk galeri publik kegiatan.
            </span>
            <button
              type="button"
              onClick={() => setShowAddPhotoModal(true)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Foto Tunggal</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {albums.map(album => (
              <div
                key={album.album_id}
                className="rounded-3xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 overflow-hidden shadow-xs flex flex-col justify-between group hover:border-purple-500/40 transition-all duration-300"
              >
                <div className="aspect-[16/9] w-full bg-slate-100 dark:bg-black/40 relative overflow-hidden">
                  <img
                    src={album.cover_image_url || undefined}
                    alt={album.album_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold font-mono">
                    {album.photo_count} Foto
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                      album.publication_status === 'PUBLISHED'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}>
                      {album.publication_status}
                    </span>

                    {album.folder_access_status && (
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                        album.folder_access_status === 'ACCESSIBLE'
                          ? 'bg-purple-600/80 text-white'
                          : 'bg-rose-500 text-white'
                      }`}>
                        {album.folder_access_status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                      {album.album_name}
                    </h3>
                    {album.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {album.description}
                      </p>
                    )}
                    {album.source_folder_url && (
                      <div className="text-[10px] text-purple-600 dark:text-purple-400 font-mono truncate mt-2 flex items-center gap-1">
                        <span>📁</span>
                        <span className="truncate">{album.source_folder_url}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between gap-2">
                    {album.source_folder_url ? (
                      <button
                        type="button"
                        onClick={() => handleSyncAlbum(album)}
                        disabled
                        className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        title="Sinkronisasi ditahan sampai penyimpanan media GAS tersedia"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncingAlbumId === album.album_id ? 'animate-spin' : ''}`} />
                        <span>{'Sinkronisasi belum tersedia'}</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400">Manual Album</span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          const nextStatus: MediaPublicationStatus =
                            album.publication_status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
                          try {
                            await documentationService.updateAlbum(album.album_id, { publication_status: nextStatus });
                            await documentationService.loadAlbumsFromGas();
                            showToast(`Status album terverifikasi di Spreadsheet: ${nextStatus}.`);
                          } catch (err: any) { showToast(err?.message || 'Status gagal disimpan ke GAS.'); }
                        }}
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white px-2 py-1 rounded-md"
                      >
                        {album.publication_status === 'PUBLISHED' ? 'Arsipkan' : 'Publikasikan'}
                      </button>

                      <button type="button" disabled title="Penghapusan dinonaktifkan sampai API GAS menyediakan pengarsipan permanen" className="p-1.5 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PHOTOS LIST */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Total {photos.length} foto resmi terindeks.
            </span>
            <button
              type="button"
              onClick={() => setShowAddPhotoModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Foto Tunggal</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map(photo => (
              <div
                key={photo.media_id}
                className="rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 overflow-hidden shadow-xs flex flex-col justify-between"
              >
                <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-black/40 relative">
                  <img
                    src={photo.thumbnail_url}
                    alt={photo.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2">
                    <span className="px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-purple-300">
                      {photo.download_control === 'ALLOW_ORIGINAL_LINK' ? 'Download ✓' : 'View Only'}
                    </span>
                  </div>
                </div>

                <div className="p-3 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{photo.title}</h4>
                  <div className="text-[10px] text-slate-400 font-mono">{photo.event_date}</div>

                  <div className="pt-2 flex items-center justify-between border-t border-black/5 dark:border-white/5">
                    <a
                      href={photo.original_url || photo.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      <span>Lihat Asli</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Hapus foto '${photo.title}'?`)) {
                          documentationService.deleteMedia(photo.media_id);
                          showToast('Foto dihapus.');
                        }
                      }}
                      className="text-rose-600 dark:text-rose-400 hover:opacity-80 p-1"
                      title="Hapus Foto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: VIDEOS LIST (Section 11) */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Total {videos.length} video highlight resmi perkemahan.
            </span>
            <button
              type="button"
              onClick={() => setShowAddVideoModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#208C60] to-[#F47743] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Video YouTube/Drive</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {videos.map(video => (
              <div
                key={video.media_id}
                className="rounded-3xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 overflow-hidden shadow-xs flex flex-col justify-between group"
              >
                <div className="aspect-video w-full bg-black/60 relative">
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#208C60] to-[#F47743] text-white flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">
                    {video.duration || '03:00'}
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-purple-300 text-[9px] font-mono">
                    {video.provider}
                  </div>
                </div>

                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{video.title}</h4>
                    {video.caption && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {video.caption}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">{video.event_date}</span>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Hapus video '${video.title}'?`)) {
                          documentationService.deleteMedia(video.media_id);
                          showToast('Video dihapus.');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                      title="Hapus Video"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RESOLVER DIAGNOSTIC (Section 4 & 12) */}
      {activeTab === 'resolver' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 space-y-5 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>Shared MediaResolver Pipeline Sandbox</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Verifikasi deteksi URL, thumbnail generation, status akses publik, dan parameter sematan video.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={testUrl}
              onChange={e => {
                setTestUrl(e.target.value);
                setTestResult(mediaResolverService.resolveSource(e.target.value));
              }}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
              placeholder="Masukkan URL YouTube, Google Drive, atau gambar..."
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const u = 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ?usp=sharing';
                setTestUrl(u);
                setTestResult(mediaResolverService.resolveSource(u));
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-purple-600 dark:text-purple-400 text-[11px] font-medium"
            >
              📁 Drive Folder (Public)
            </button>
            <button
              type="button"
              onClick={() => {
                const u = 'https://drive.google.com/drive/folders/secret_restricted_folder?usp=sharing_eip';
                setTestUrl(u);
                setTestResult(mediaResolverService.resolveSource(u));
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-rose-500 text-[11px] font-medium"
            >
              🔒 Drive Folder (Private)
            </button>
            <button
              type="button"
              onClick={() => {
                const u = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
                setTestUrl(u);
                setTestResult(mediaResolverService.resolveSource(u));
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium"
            >
              ▶️ YouTube Video
            </button>
          </div>

          {/* Resolved diagnostics card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/10 space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block">Penyedia:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{testResult.provider}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Tipe Sumber:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">{testResult.sourceType}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Status Akses:</span>
                <span className={`font-bold font-mono ${
                  testResult.accessStatus === 'ACCESSIBLE'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : testResult.accessStatus === 'PRIVATE'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {testResult.accessStatus}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Embed Player:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {testResult.canEmbed ? 'Ya (Embeddable)' : 'Tidak (Link Asli)'}
                </span>
              </div>
            </div>

            {testResult.errorMessage && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>{testResult.errorMessage}</span>
              </div>
            )}

            {testResult.thumbnailUrl && (
              <div className="pt-2">
                <span className="text-[10px] text-slate-400 block mb-1">Pratinjau Thumbnail Ter-resolve:</span>
                <div className="w-48 h-32 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black">
                  <img
                    src={testResult.thumbnailUrl}
                    alt="Resolved thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD ALBUM (Sections 5 & 6) */}
      {showAddAlbumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-[#121215] border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Tambah Album Google Drive</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddAlbumModal(false);
                  setValidationState(null);
                }}
                className="text-slate-400 hover:text-black dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAlbum} className="space-y-3.5 text-xs">
              {albumError && <div role="alert" className="rounded-xl bg-rose-50 text-rose-800 p-2">{albumError}</div>}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Judul Album Kegiatan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Apel Pembukaan & Upacara Adat Buper"
                  value={albumForm.album_name}
                  onChange={e => setAlbumForm({ ...albumForm, album_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Deskripsi Singkat
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat kegiatan dan peserta yang terlibat..."
                  value={albumForm.description}
                  onChange={e => setAlbumForm({ ...albumForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Tautan Google Drive Folder & Live Access Validation (Section 5 & 6) */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Tautan Folder Google Drive (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Opsional: https://drive.google.com/drive/folders/..."
                  value={albumForm.source_folder_url}
                  onChange={e => handleValidateDriveUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                />

                <p className="mt-2 text-[11px] text-slate-500">Opsional. Tautan folder hanya dicatat, tidak dibaca, tidak disinkronkan, dan tidak membuat file/folder Drive otomatis.</p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  URL Cover Album (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Opsional; kosongkan untuk album tanpa cover"
                  value={albumForm.cover_image_url}
                  onChange={e => setAlbumForm({ ...albumForm, cover_image_url: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-black/5 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAlbumModal(false);
                    setValidationState(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAlbum}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#208C60] to-[#F47743] text-white font-bold shadow-xs hover:opacity-90 disabled:opacity-50"
                >
                  {savingAlbum ? 'Menyimpan ke Spreadsheet...' : 'Simpan Album Kosong'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD PHOTO */}
      {showAddPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#121215] border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Tambah Foto Tunggal</span>
              </h3>
              <button onClick={() => setShowAddPhotoModal(false)} className="text-slate-400 hover:text-black dark:hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddPhoto} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Pilih Album *</label>
                <select
                  value={photoForm.album_id}
                  onChange={e => setPhotoForm({ ...photoForm, album_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-bold"
                >
                  {albums.map(a => (
                    <option key={a.album_id} value={a.album_id}>
                      {a.album_name} ({a.photo_count} foto)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Judul Foto *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Apel Pembukaan Kontingen Kwarran"
                  value={photoForm.title}
                  onChange={e => setPhotoForm({ ...photoForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">URL Sumber Foto *</label>
                <input
                  type="text"
                  required
                  placeholder="https://drive.google.com/file/d/... atau https://..."
                  value={photoForm.source_url}
                  onChange={e => setPhotoForm({ ...photoForm, source_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Keterangan / Caption</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat momen foto..."
                  value={photoForm.caption}
                  onChange={e => setPhotoForm({ ...photoForm, caption: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-black/5 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddPhotoModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs"
                >
                  Tambahkan Foto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD VIDEO (Sections 11 & 12) */}
      {showAddVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-[#121215] border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-[#F47743]" />
                <span>Tambah Video Highlight Resmi</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddVideoModal(false);
                  setVideoPreviewResult(null);
                }}
                className="text-slate-400 hover:text-black dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVideo} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Tautan Video (YouTube atau Google Drive) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://www.youtube.com/watch?v=... atau https://drive.google.com/..."
                  value={videoForm.source_url}
                  onChange={e => handleVideoUrlChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#F47743] font-mono text-[11px]"
                />
              </div>

              {/* Live Preview Card */}
              {videoPreviewResult && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-black/10 dark:border-white/10 flex items-center gap-3">
                  <div className="w-24 aspect-video rounded-lg overflow-hidden bg-black shrink-0 relative">
                    {videoPreviewResult.thumbnailUrl ? (
                      <img src={videoPreviewResult.thumbnailUrl} alt="Thumb" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">🎬</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                      Penyedia: {videoPreviewResult.provider}
                    </span>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {videoPreviewResult.title || 'Video terdeteksi'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {videoPreviewResult.canEmbed ? '✓ Mendukung pemutar sematan' : 'ℹ️ Menggunakan tombol buka tautan asli'}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Judul Video *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Highlight Hari Pertama Jambore Cabang 2026"
                  value={videoForm.title}
                  onChange={e => setVideoForm({ ...videoForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Kategori / Album</label>
                  <select
                    value={videoForm.category}
                    onChange={e => setVideoForm({ ...videoForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-bold"
                  >
                    <option value="Highlight Kegiatan">Highlight Kegiatan</option>
                    <option value="Apel & Upacara">Apel & Upacara</option>
                    <option value="Lomba & Prestasi">Lomba & Prestasi</option>
                    <option value="Malam Api Unggun">Malam Api Unggun</option>
                    <option value="Liputan Humas">Liputan Humas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Durasi</label>
                  <input
                    type="text"
                    placeholder="03:45"
                    value={videoForm.duration}
                    onChange={e => setVideoForm({ ...videoForm, duration: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Deskripsi / Catatan Liputan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat rangkaian kegiatan dalam video..."
                  value={videoForm.description}
                  onChange={e => setVideoForm({ ...videoForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Thumbnail Manual (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Biarkan kosong untuk menggunakan thumbnail resmi YouTube / Drive"
                  value={videoForm.thumbnail_override}
                  onChange={e => setVideoForm({ ...videoForm, thumbnail_override: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-black/5 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddVideoModal(false);
                    setVideoPreviewResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#208C60] to-[#F47743] text-white font-bold shadow-xs hover:opacity-90"
                >
                  Simpan Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
