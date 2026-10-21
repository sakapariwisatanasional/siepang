/**
 * @license
 * SiEpang - Official Event Documentation Service (Requirements 1-20, 48, 51, 56, 57, 59, 61, 63)
 * Manages official event photography and video documentation separate from competition submissions.
 * Supports:
 * - Google Drive folders and image links
 * - YouTube and Drive video embeds
 * - Albums with cover images and lazy-load friendly metadata
 * - Publication workflow: DRAFT -> PUBLISHED -> ARCHIVED
 * - Download control: VIEW_ONLY vs ALLOW_ORIGINAL_LINK
 * - Access validation and metadata refresh
 * - Enterprise audit integration
 */

import {
  MediaItem,
  PhotoAlbum,
  MediaPublicationStatus,
  MediaAccessStatus,
  DownloadControlMode,
} from '../types';
import { mediaResolverService } from './mediaResolverService';
import { apiTransport } from './apiTransport';
import { eventStudioService } from './eventStudioService';

export interface GalleryUrlRecord {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  title: string;
  caption?: string;
  source_url: string;
  source_page_url?: string;
  thumbnail_url?: string;
  album_id?: string;
  display_order?: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  created_at?: string;
  updated_at?: string;
}

export interface GalleryPage {
  items: GalleryUrlRecord[];
  total: number;
  offset: number;
  limit: number;
}

class DocumentationService {
  private albums: Map<string, PhotoAlbum> = new Map();
  private mediaItems: Map<string, MediaItem> = new Map();
  private listeners: Set<() => void> = new Set();
  private gasPublishedMedia: MediaItem[] = [];
  private gasGalleryLoaded = false;


  constructor() {
    this.seedDefaultDocumentation();
  }

  private seedDefaultDocumentation(): void {
    // Pure clean runtime: zero dummy media
  }

  // ==================== GAS GALLERY (AUTHORITATIVE) ====================

  /** Read published gallery items from GAS, not browser memory. */
  public async loadPublicGallery(): Promise<MediaItem[]> {
    const all: GalleryUrlRecord[] = [];
    let offset = 0;
    const pageSize = 100;
    // Limit total retrieval defensively; UI can add server-side paging later.
    while (offset < 5000) {
      const response = await apiTransport.send<GalleryPage>(
        'gallery.public.list', { limit: pageSize, offset }, { skipAuth: true }
      );
      if (!response.ok) throw new Error(response.error?.message || 'Gagal mengambil galeri dari GAS.');
      const page = response.data;
      if (!page || !Array.isArray(page.items) || typeof page.total !== 'number') {
        throw new Error('Format data galeri GAS tidak valid.');
      }
      all.push(...page.items);
      if (!page.items.length || all.length >= page.total) break;
      offset += page.items.length;
    }
    this.gasPublishedMedia = all.map(item => this.toPublicMediaItem(item));
    this.gasGalleryLoaded = true;
    this.notify();
    return [...this.gasPublishedMedia];
  }

  /** Published items are sourced only from GAS, never local admin-memory writes. */
  public getPublishedGalleryItems(type?: 'PHOTO' | 'VIDEO'): MediaItem[] {
    return this.gasPublishedMedia
      .filter(item => !type || item.media_type === type)
      .sort((a, b) => a.display_order - b.display_order);
  }

  public hasLoadedPublicGallery(): boolean {
    return this.gasGalleryLoaded;
  }

  /** Requires an authorized session; permissions are enforced by GAS. */
  public async listGalleryForAdmin(type?: 'PHOTO' | 'VIDEO'): Promise<GalleryPage> {
    const result = await apiTransport.send<GalleryPage>('gallery.admin.list', { type: type || '', limit: 100 });
    if (!result.ok || !result.data || !Array.isArray(result.data.items)) {
      throw new Error(result.error?.message || 'Gagal membaca galeri admin.');
    }
    return result.data;
  }

  public async saveGalleryUrl(data: Omit<GalleryUrlRecord, 'created_at' | 'updated_at'>): Promise<void> {
    const result = await apiTransport.send('gallery.admin.save', data);
    if (!result.ok) throw new Error(result.error?.message || 'Gagal menyimpan URL media.');
    await this.loadPublicGallery();
  }

  public async archiveGalleryUrl(id: string): Promise<void> {
    const result = await apiTransport.send('gallery.admin.archive', { id });
    if (!result.ok) throw new Error(result.error?.message || 'Gagal mengarsipkan media.');
    await this.loadPublicGallery();
  }

  private deriveGalleryThumbnail(source: string, type: 'PHOTO' | 'VIDEO'): string {
    try {
      const u = new URL(source);
      if (u.protocol !== 'https:') return '';
      const host = u.hostname.toLowerCase();
      if (type === 'VIDEO') {
        let id = '';
        if (host === 'youtu.be' || host === 'www.youtu.be') id = u.pathname.split('/')[1] || '';
        else if (['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))
          id = u.searchParams.get('v') || u.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)?.[1] || '';
        if (/^[A-Za-z0-9_-]{11}$/.test(id)) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        if (host === 'drive.google.com') {
          id = u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1] || u.searchParams.get('id') || '';
          if (/^[A-Za-z0-9_-]{10,}$/.test(id)) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600`;
        }
      }
      if (type === 'PHOTO' && /\.(?:png|jpe?g|webp|gif|avif)(?:$|\?)/i.test(source)) return source;
    } catch {}
    return '';
  }

  private toPublicMediaItem(item: GalleryUrlRecord): MediaItem {
    if (!item || !item.id || !['PHOTO', 'VIDEO'].includes(item.type) || !/^https:\/\//i.test(item.source_url || '')) {
      throw new Error('Record media dari GAS tidak valid.');
    }
    const source = item.source_url.trim();
    const youtube = /(?:youtube\.com|youtu\.be)/i.test(source);
    const drive = /drive\.google\.com/i.test(source);
    const derivedThumbnail = this.deriveGalleryThumbnail(source, item.type);
    const thumbnail = String(item.thumbnail_url || '').trim() || derivedThumbnail;
    const provider: MediaItem['provider'] = youtube ? 'YOUTUBE' : drive ? 'GOOGLE_DRIVE' : 'EXTERNAL';
    return {
      media_id: item.id,
      workspace_id: '',
      event_id: '',
      album_id: item.album_id || undefined,
      media_type: item.type,
      provider,
      source_type: item.type === 'PHOTO' ? 'PUBLIC_IMAGE_URL' : 'PUBLIC_VIDEO_URL',
      source_url: source,
      thumbnail_url: thumbnail || (item.type === 'PHOTO' ? source : ''),
      original_url: source,
      title: item.title || 'Tanpa judul',
      caption: item.caption || '',
      event_date: '',
      display_order: Number(item.display_order || 0),
      publication_status: 'PUBLISHED',
      metadata_status: 'ACCESSIBLE',
      download_control: 'VIEW_ONLY',
      views_count: 0,
      created_at: item.created_at || '',
      created_by: '',
    };
  }

  // ==================== PERSISTENT ALBUM OPERATIONS ====================

  private albumReceipt: { album_id: string; event_id: string; sheet: string; row: number; verified_at: string } | null = null;

  public getLastAlbumReceipt() { return this.albumReceipt ? { ...this.albumReceipt } : null; }

  private mapGasAlbum(row: Record<string, unknown>): PhotoAlbum {
    if (!row || !String(row.album_id || '') || !String(row.event_id || '')) {
      throw new Error('Record album dari GAS tidak valid.');
    }
    return {
      album_id: String(row.album_id),
      workspace_id: '',
      event_id: String(row.event_id),
      album_name: String(row.album_name || ''),
      description: String(row.description || ''),
      source_folder_url: String(row.source_folder_url || ''),
      cover_image_url: String(row.cover_image_url || ''),
      folder_access_status: 'ACCESSIBLE',
      photo_count: 0, // Album metadata never creates media. Count requires a separate persisted media endpoint.
      display_order: Number(row.display_order || 0),
      publication_status: (['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(String(row.publication_status))
        ? row.publication_status : 'DRAFT') as MediaPublicationStatus,
      created_at: String(row.created_at || ''),
      updated_at: String(row.updated_at || ''),
    };
  }

  public async loadAlbumsFromGas(): Promise<PhotoAlbum[]> {
    const result = await apiTransport.send<{ items: Record<string, unknown>[]; total: number }>(
      'documentation.album.list', {}
    );
    if (!result.ok || !result.data || !Array.isArray(result.data.items)) {
      throw new Error(result.error?.message || 'Gagal membaca album dari Spreadsheet.');
    }
    const rows = result.data.items.map(row => this.mapGasAlbum(row));
    this.albums = new Map(rows.map(row => [row.album_id, row]));
    this.notify();
    return this.getAlbums();
  }

  public getAlbums(filterStatus?: MediaPublicationStatus): PhotoAlbum[] {
    let list = Array.from(this.albums.values());
    if (filterStatus) list = list.filter(a => a.publication_status === filterStatus);
    return list.sort((a, b) => a.display_order - b.display_order);
  }

  public getAlbumById(id: string): PhotoAlbum | undefined { return this.albums.get(id); }

  /** Creates only an empty album record. Never scans Drive or inserts photo/video. */
  public async createAlbum(data: {
    album_name: string;
    description?: string;
    source_folder_url?: string;
    cover_image_url?: string;
    publication_status?: MediaPublicationStatus;
    createdBy?: string;
  }): Promise<PhotoAlbum> {
    const title = String(data.album_name || '').trim();
    if (!title) throw new Error('Nama album wajib diisi.');
    this.albumReceipt = null;
    const payload = {
      album_name: title,
      description: String(data.description || '').trim(),
      source_folder_url: String(data.source_folder_url || '').trim(),
      // No automatic first-photo cover, thumbnails, placeholder, or default media.
      cover_image_url: String(data.cover_image_url || '').trim(),
      publication_status: data.publication_status || 'DRAFT',
      display_order: this.albums.size + 1,
    };
    const response = await apiTransport.send<{
      saved: boolean; verified: boolean; item: Record<string, unknown>;
      receipt: { album_id: string; event_id: string; sheet: string; row: number; verified_at: string };
    }>('documentation.album.save', payload);
    if (!response.ok || !response.data?.saved || !response.data?.verified || !response.data?.receipt?.album_id) {
      throw new Error(response.error?.message || 'GAS belum membuktikan album tersimpan di Spreadsheet.');
    }
    const saved = this.mapGasAlbum(response.data.item);
    if (saved.album_id !== response.data.receipt.album_id || saved.album_name !== title) {
      throw new Error('Bukti simpan album tidak cocok dengan data yang dikirim.');
    }
    // Verify that a fresh GET endpoint finds the exact album, not only POST success.
    const check = await apiTransport.send<{ item: Record<string, unknown> }>(
      'documentation.album.get', { album_id: saved.album_id }
    );
    if (!check.ok || !check.data?.item || String(check.data.item.album_name) !== title) {
      throw new Error('Album mungkin tersimpan, tetapi pembacaan ulang belum dapat memverifikasinya. Jangan klik Simpan berulang kali.');
    }
    this.albums.set(saved.album_id, saved);
    this.albumReceipt = response.data.receipt;
    this.notify();
    return saved;
  }

  /**
   * Refreshes / syncs album from Google Drive folder (Section 7)
   * Detects new, removed, or changed photos without creating duplicate records.
   */
  public syncAlbumDriveFolder(albumId: string, syncedBy?: string): {
    addedCount: number; updatedCount: number; totalCount: number;
    accessStatus: MediaAccessStatus; message: string;
  } {
    throw new Error('Sinkronisasi album ke Drive dinonaktifkan sampai tersedia API media permanen di GAS. Tidak ada media yang ditambahkan.');
  }

  public async updateAlbum(id: string, updates: Partial<PhotoAlbum>, updatedBy?: string): Promise<PhotoAlbum> {
    const old = this.albums.get(id);
    if (!old) throw new Error('Album tidak ditemukan. Muat ulang data dari GAS.');
    const response = await apiTransport.send<{
      saved: boolean; verified: boolean; item: Record<string, unknown>;
      receipt: { album_id: string; event_id: string; sheet: string; row: number; verified_at: string };
    }>('documentation.album.save', {
      album_id: id,
      album_name: updates.album_name ?? old.album_name,
      description: updates.description ?? old.description ?? '',
      source_folder_url: updates.source_folder_url ?? old.source_folder_url ?? '',
      cover_image_url: updates.cover_image_url ?? old.cover_image_url ?? '',
      publication_status: updates.publication_status ?? old.publication_status,
      display_order: updates.display_order ?? old.display_order,
    });
    if (!response.ok || !response.data?.saved || !response.data?.verified) {
      throw new Error(response.error?.message || 'Perubahan album belum terverifikasi di Spreadsheet.');
    }
    const updated = this.mapGasAlbum(response.data.item);
    this.albums.set(id, updated);
    this.albumReceipt = response.data.receipt;
    this.notify();
    return updated;
  }

  public deleteAlbum(id: string, deletedBy?: string): boolean {
    // No server-side delete/archive action exists in DocumentationAlbumApi.gs yet.
    // Never present local-only deletion as a successful persisted mutation.
    throw new Error('Hapus album belum tersedia di GAS. Data tidak diubah.');
  }

  // ==================== MEDIA ITEM OPERATIONS (PHOTOS & VIDEOS) ====================

  public getMediaItems(options?: {
    type?: 'PHOTO' | 'VIDEO';
    albumId?: string;
    publicationStatus?: MediaPublicationStatus;
  }): MediaItem[] {
    let list = Array.from(this.mediaItems.values());

    if (options?.type) {
      list = list.filter(m => m.media_type === options.type);
    }
    if (options?.albumId) {
      list = list.filter(m => m.album_id === options.albumId);
    }
    if (options?.publicationStatus) {
      list = list.filter(m => m.publication_status === options.publicationStatus);
    }

    return list.sort((a, b) => a.display_order - b.display_order);
  }

  public getMediaById(id: string): MediaItem | undefined {
    return this.mediaItems.get(id);
  }

  /**
   * Adds photo item with automatic MediaResolver parsing
   */
  public addPhoto(data: {
    album_id: string;
    source_url: string;
    title: string;
    caption?: string;
    event_date?: string;
    thumbnail_override?: string;
    download_control?: DownloadControlMode;
    publication_status?: MediaPublicationStatus;
    createdBy?: string;
  }): MediaItem {
    const resolution = mediaResolverService.resolveSource(data.source_url);
    const id = `med_p_${Date.now()}`;

    const item: MediaItem = {
      media_id: id,
      workspace_id: 'ws_kwarcab_bwi',
      event_id: 'ev_jamcab_bwi_2026',
      album_id: data.album_id,
      media_type: 'PHOTO',
      provider: resolution.provider,
      source_type: resolution.sourceType,
      source_url: data.source_url,
      provider_resource_id: resolution.providerResourceId,
      thumbnail_url: data.thumbnail_override || resolution.thumbnailUrl,
      original_url: data.source_url,
      title: data.title.trim(),
      caption: data.caption?.trim(),
      event_date: data.event_date || '2026-10-05',
      display_order: this.mediaItems.size + 1,
      publication_status: data.publication_status || 'PUBLISHED',
      metadata_status: resolution.accessStatus,
      download_control: data.download_control || 'ALLOW_ORIGINAL_LINK',
      views_count: 0,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
      created_by: data.createdBy || 'Panitia Dokumentasi',
    };

    this.mediaItems.set(id, item);

    // Update album photo count
    const album = this.albums.get(data.album_id);
    if (album) {
      album.photo_count = Array.from(this.mediaItems.values()).filter(
        m => m.album_id === data.album_id
      ).length;
    }

    eventStudioService.addAuditLogEntry(
      'PHOTO_ADDED',
      `Foto '${item.title}' ditambahkan ke album '${album?.album_name || data.album_id}'.`,
      data.createdBy || 'Admin'
    );

    this.notify();
    return item;
  }

  /**
   * Adds video entry with automatic YouTube/Drive detection
   */
  public addVideo(data: {
    source_url: string;
    title: string;
    description?: string;
    event_date?: string;
    thumbnail_override?: string;
    duration?: string;
    publication_status?: MediaPublicationStatus;
    createdBy?: string;
  }): MediaItem {
    const resolution = mediaResolverService.resolveSource(data.source_url);
    const id = `med_v_${Date.now()}`;

    const item: MediaItem = {
      media_id: id,
      workspace_id: 'ws_kwarcab_bwi',
      event_id: 'ev_jamcab_bwi_2026',
      media_type: 'VIDEO',
      provider: resolution.provider,
      source_type: resolution.sourceType,
      source_url: data.source_url,
      provider_resource_id: resolution.providerResourceId,
      thumbnail_url: data.thumbnail_override || resolution.thumbnailUrl,
      original_url: data.source_url,
      title: data.title.trim(),
      caption: data.description?.trim(),
      event_date: data.event_date || '2026-10-05',
      display_order: this.mediaItems.size + 1,
      publication_status: data.publication_status || 'PUBLISHED',
      metadata_status: resolution.accessStatus,
      download_control: 'VIEW_ONLY',
      duration: data.duration || '03:00',
      can_embed: resolution.canEmbed,
      embed_url: resolution.embedUrl,
      plays_count: 0,
      views_count: 0,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
      created_by: data.createdBy || 'Panitia Dokumentasi',
    };

    this.mediaItems.set(id, item);

    eventStudioService.addAuditLogEntry(
      'VIDEO_ADDED',
      `Video resmi '${item.title}' (${resolution.provider}) berhasil ditambahkan.`,
      data.createdBy || 'Admin'
    );

    this.notify();
    return item;
  }

  public updateMedia(id: string, updates: Partial<MediaItem>, updatedBy?: string): MediaItem {
    const target = this.mediaItems.get(id);
    if (!target) throw new Error('Item media tidak ditemukan.');

    const updated = {
      ...target,
      ...updates,
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    this.mediaItems.set(id, updated);

    eventStudioService.addAuditLogEntry(
      'MEDIA_UPDATED',
      `Media '${updated.title}' diperbarui.`,
      updatedBy || 'Admin'
    );

    this.notify();
    return updated;
  }

  public deleteMedia(id: string, deletedBy?: string): boolean {
    const target = this.mediaItems.get(id);
    if (!target) return false;

    this.mediaItems.delete(id);

    // Update album count if belongs to album
    if (target.album_id) {
      const album = this.albums.get(target.album_id);
      if (album) {
        album.photo_count = Math.max(0, album.photo_count - 1);
      }
    }

    eventStudioService.addAuditLogEntry(
      'MEDIA_DELETED',
      `Media '${target.title}' dihapus.`,
      deletedBy || 'Admin'
    );

    this.notify();
    return true;
  }

  /**
   * Refreshes metadata for all or specific media (Requirement 18)
   */
  public refreshMediaMetadata(mediaId?: string): { refreshedCount: number; brokenCount: number } {
    let list = mediaId ? [this.mediaItems.get(mediaId)].filter(Boolean) as MediaItem[] : Array.from(this.mediaItems.values());
    let broken = 0;

    for (const item of list) {
      const resolution = mediaResolverService.resolveSource(item.source_url);
      item.metadata_status = resolution.accessStatus;
      if (resolution.accessStatus !== 'ACCESSIBLE') {
        broken++;
      }
      if (resolution.thumbnailUrl) {
        item.thumbnail_url = resolution.thumbnailUrl;
      }
      if (resolution.embedUrl) {
        item.embed_url = resolution.embedUrl;
        item.can_embed = resolution.canEmbed;
      }
    }

    // Also refresh album folder statuses
    for (const album of this.albums.values()) {
      if (album.source_folder_url) {
        const val = mediaResolverService.validateDriveFolder(album.source_folder_url);
        album.folder_access_status = val.status;
      }
    }

    this.notify();
    return { refreshedCount: list.length, brokenCount: broken };
  }

  /**
   * Records media view or video play analytics (Requirement 59)
   */
  public recordMediaInteraction(id: string, type: 'VIEW' | 'PLAY'): void {
    const item = this.mediaItems.get(id);
    if (!item) return;

    if (type === 'VIEW') {
      item.views_count = (item.views_count || 0) + 1;
    } else if (type === 'PLAY') {
      item.plays_count = (item.plays_count || 0) + 1;
      item.views_count = (item.views_count || 0) + 1;
    }
  }

  // ==================== SUBSCRIPTION ====================

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    this.listeners.forEach(cb => cb());
  }
}

export const documentationService = new DocumentationService();
