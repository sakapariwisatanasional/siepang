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

  private toPublicMediaItem(item: GalleryUrlRecord): MediaItem {
    if (!item || !item.id || !['PHOTO', 'VIDEO'].includes(item.type) || !/^https:\/\//i.test(item.source_url || '')) {
      throw new Error('Record media dari GAS tidak valid.');
    }
    const source = item.source_url.trim();
    const youtube = /(?:youtube\.com|youtu\.be)/i.test(source);
    const drive = /drive\.google\.com/i.test(source);
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
      thumbnail_url: item.thumbnail_url || (item.type === 'PHOTO' ? source : ''),
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

  // ==================== ALBUM OPERATIONS ====================

  public getAlbums(filterStatus?: MediaPublicationStatus): PhotoAlbum[] {
    let list = Array.from(this.albums.values());
    if (filterStatus) {
      list = list.filter(a => a.publication_status === filterStatus);
    }
    return list.sort((a, b) => a.display_order - b.display_order);
  }

  public getAlbumById(id: string): PhotoAlbum | undefined {
    return this.albums.get(id);
  }

  public createAlbum(data: {
    album_name: string;
    description?: string;
    source_folder_url?: string;
    cover_image_url?: string;
    publication_status?: MediaPublicationStatus;
    createdBy?: string;
  }): PhotoAlbum {
    const id = `alb_${Date.now()}`;
    let accessStatus: MediaAccessStatus = 'ACCESSIBLE';
    let resolvedFolderId = '';

    if (data.source_folder_url) {
      const val = mediaResolverService.validateDriveFolder(data.source_folder_url);
      accessStatus = val.status;
      resolvedFolderId = val.resolvedFolderId || '';
    }

    const album: PhotoAlbum = {
      album_id: id,
      workspace_id: 'ws_active',
      event_id: 'evt_active',
      album_name: data.album_name.trim(),
      description: data.description?.trim(),
      source_folder_url: data.source_folder_url?.trim(),
      cover_image_url: data.cover_image_url || '',
      folder_access_status: accessStatus,
      photo_count: 0,
      display_order: this.albums.size + 1,
      publication_status: data.publication_status || 'PUBLISHED',
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    this.albums.set(id, album);

    // If accessible Google Drive folder, automatically resolve photos (Section 5)
    if (album.source_folder_url && accessStatus === 'ACCESSIBLE') {
      const resolvedPhotos = mediaResolverService.resolveDriveFolderPhotos(
        resolvedFolderId || id,
        album.source_folder_url
      );
      resolvedPhotos.forEach((p, idx) => {
        const pId = `med_p_${Date.now()}_${idx}`;
        const item: MediaItem = {
          media_id: pId,
          workspace_id: 'ws_kwarcab_bwi',
          event_id: 'ev_jamcab_bwi_2026',
          album_id: id,
          media_type: 'PHOTO',
          provider: 'GOOGLE_DRIVE',
          source_type: 'GOOGLE_DRIVE_FOLDER',
          source_url: p.source_url,
          thumbnail_url: p.thumbnail_url,
          provider_resource_id: p.provider_resource_id,
          original_url: p.source_url,
          title: p.title,
          caption: p.caption,
          event_date: p.event_date,
          display_order: idx + 1,
          publication_status: 'PUBLISHED',
          metadata_status: 'ACCESSIBLE',
          download_control: 'ALLOW_ORIGINAL_LINK',
          views_count: 0,
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
          created_by: data.createdBy || 'Google Drive Sync',
        };
        this.mediaItems.set(pId, item);
      });
      album.photo_count = resolvedPhotos.length;
      if (!data.cover_image_url && resolvedPhotos[0]?.thumbnail_url) {
        album.cover_image_url = resolvedPhotos[0].thumbnail_url;
      }
    }

    eventStudioService.addAuditLogEntry(
      'ALBUM_CREATED',
      `Album dokumentasi foto '${album.album_name}' dibuat (${album.photo_count} foto tersinkron).`,
      data.createdBy || 'Admin'
    );

    this.notify();
    return album;
  }

  /**
   * Refreshes / syncs album from Google Drive folder (Section 7)
   * Detects new, removed, or changed photos without creating duplicate records.
   */
  public syncAlbumDriveFolder(albumId: string, syncedBy?: string): {
    addedCount: number;
    updatedCount: number;
    totalCount: number;
    accessStatus: MediaAccessStatus;
    message: string;
  } {
    const album = this.albums.get(albumId);
    if (!album) {
      throw new Error('Album tidak ditemukan.');
    }

    if (!album.source_folder_url) {
      return {
        addedCount: 0,
        updatedCount: 0,
        totalCount: album.photo_count,
        accessStatus: 'INVALID_URL',
        message: 'Album ini belum memiliki tautan Google Drive Folder.',
      };
    }

    const validation = mediaResolverService.validateDriveFolder(album.source_folder_url);
    album.folder_access_status = validation.status;

    if (validation.status !== 'ACCESSIBLE') {
      this.notify();
      return {
        addedCount: 0,
        updatedCount: 0,
        totalCount: album.photo_count,
        accessStatus: validation.status,
        message: validation.message,
      };
    }

    // Resolve photos from Google Drive folder
    const resolved = mediaResolverService.resolveDriveFolderPhotos(
      validation.resolvedFolderId || albumId,
      album.source_folder_url
    );

    let addedCount = 0;
    let updatedCount = 0;

    // Existing photos in this album
    const existingAlbumPhotos = Array.from(this.mediaItems.values()).filter(
      m => m.album_id === albumId
    );
    const existingByResourceId = new Map<string, MediaItem>();
    existingAlbumPhotos.forEach(p => {
      if (p.provider_resource_id) {
        existingByResourceId.set(p.provider_resource_id, p);
      }
    });

    resolved.forEach((item, index) => {
      const match = existingByResourceId.get(item.provider_resource_id);
      if (match) {
        // Update metadata without duplicating
        match.thumbnail_url = item.thumbnail_url;
        match.metadata_status = 'ACCESSIBLE';
        match.title = item.title;
        match.caption = item.caption;
        updatedCount++;
      } else {
        // Add newly discovered photo
        const pId = `med_p_${Date.now()}_${index}`;
        const newPhoto: MediaItem = {
          media_id: pId,
          workspace_id: 'ws_kwarcab_bwi',
          event_id: 'ev_jamcab_bwi_2026',
          album_id: albumId,
          media_type: 'PHOTO',
          provider: 'GOOGLE_DRIVE',
          source_type: 'GOOGLE_DRIVE_FOLDER',
          source_url: item.source_url,
          thumbnail_url: item.thumbnail_url,
          provider_resource_id: item.provider_resource_id,
          original_url: item.source_url,
          title: item.title,
          caption: item.caption,
          event_date: item.event_date,
          display_order: existingAlbumPhotos.length + addedCount + 1,
          publication_status: 'PUBLISHED',
          metadata_status: 'ACCESSIBLE',
          download_control: 'ALLOW_ORIGINAL_LINK',
          views_count: 0,
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
          created_by: syncedBy || 'Sinkronisasi Google Drive',
        };
        this.mediaItems.set(pId, newPhoto);
        addedCount++;
      }
    });

    const totalCount = Array.from(this.mediaItems.values()).filter(
      m => m.album_id === albumId
    ).length;
    album.photo_count = totalCount;
    album.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 16);

    eventStudioService.addAuditLogEntry(
      'ALBUM_SYNCED',
      `Album '${album.album_name}' disinkronkan dengan Google Drive (+${addedCount} baru, ${updatedCount} diperbarui).`,
      syncedBy || 'Admin'
    );

    this.notify();

    return {
      addedCount,
      updatedCount,
      totalCount,
      accessStatus: 'ACCESSIBLE',
      message: `Sinkronisasi berhasil: ${addedCount} foto baru ditambahkan, ${updatedCount} foto diperbarui. Total: ${totalCount} foto.`,
    };
  }

  public updateAlbum(id: string, updates: Partial<PhotoAlbum>, updatedBy?: string): PhotoAlbum {
    const target = this.albums.get(id);
    if (!target) throw new Error('Album tidak ditemukan.');

    if (updates.source_folder_url && updates.source_folder_url !== target.source_folder_url) {
      const val = mediaResolverService.validateDriveFolder(updates.source_folder_url);
      updates.folder_access_status = val.status;
    }

    const updated = {
      ...target,
      ...updates,
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    this.albums.set(id, updated);

    eventStudioService.addAuditLogEntry(
      'ALBUM_UPDATED',
      `Album '${updated.album_name}' diperbarui.`,
      updatedBy || 'Admin'
    );

    this.notify();
    return updated;
  }

  public deleteAlbum(id: string, deletedBy?: string): boolean {
    const target = this.albums.get(id);
    if (!target) return false;

    // Remove album and update associated media
    this.albums.delete(id);
    for (const [mId, item] of this.mediaItems.entries()) {
      if (item.album_id === id) {
        this.mediaItems.delete(mId);
      }
    }

    eventStudioService.addAuditLogEntry(
      'ALBUM_DELETED',
      `Album '${target.album_name}' dan seluruh fotonya dihapus.`,
      deletedBy || 'Admin'
    );

    this.notify();
    return true;
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
