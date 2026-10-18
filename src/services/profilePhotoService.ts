/**
 * @license
 * SiEpang - Canonical Profile Photo Service (Milestone v1.9 - Requirements 22 - 69)
 * Unified profile photo architecture for:
 * - PARTICIPANT (Peserta)
 * - OFFICIAL (Pembina / Pimpinan Kontingen)
 * - COMMITTEE (Panitia)
 * - JUDGE (Juri)
 *
 * Core Capabilities:
 * 1. Customer-owned Google Drive storage (/SiEpang/Assets/Profile Photos/JAMRAN-2026/)
 * 2. Optimized profile photo (512x512) and thumbnail (128x128)
 * 3. Canonical Drive file IDs (profile_photo_file_id)
 * 4. Verification queue & moderation statuses (NOT_UPLOADED, UPLOADED, VALID, REJECTED, NEEDS_REPLACEMENT)
 * 5. Rejection reasons and re-upload requests
 * 6. Configurable required/optional policies per entity type
 * 7. Configurable approved photo replacement policy (ALLOW, REQUIRE_REAPPROVAL, ADMIN_ONLY)
 * 8. RBAC validation
 * 9. Document Template Studio precheck (missing photo detection before card generation)
 * 10. Zero simulation photos in production and development; strict empty state on empty database.
 */

import {
  ProfilePhotoRecord,
  ProfilePhotoStatus,
  PhotoEntityType,
  PhotoRequiredConfig,
  PhotoRequiredPolicy,
  PhotoReplacementPolicy,
} from '../types';
import { apiTransport } from './apiTransport';

const STORAGE_KEY_PHOTOS = 'siepang_profile_photos_v1';
const STORAGE_KEY_CONFIG = 'siepang_photo_required_config_v1';
const STORAGE_KEY_POLICY = 'siepang_photo_replacement_policy_v1';

// Default configuration
const DEFAULT_REQUIRED_CONFIG: PhotoRequiredConfig = {
  PARTICIPANT: 'REQUIRED',
  OFFICIAL: 'REQUIRED',
  COMMITTEE: 'OPTIONAL',
  JUDGE: 'REQUIRED',
};

const DEFAULT_REPLACEMENT_POLICY: PhotoReplacementPolicy = 'REQUIRE_REAPPROVAL';

export class ProfilePhotoService {
  private records: ProfilePhotoRecord[] = [];
  private requiredConfig: PhotoRequiredConfig = { ...DEFAULT_REQUIRED_CONFIG };
  private replacementPolicy: PhotoReplacementPolicy = DEFAULT_REPLACEMENT_POLICY;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    // Load config from localStorage if available
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (savedConfig) {
        this.requiredConfig = JSON.parse(savedConfig);
      }
      const savedPolicy = localStorage.getItem(STORAGE_KEY_POLICY);
      if (savedPolicy) {
        this.replacementPolicy = savedPolicy as PhotoReplacementPolicy;
      }
    } catch {
      // Fallback to defaults
    }

    // Pure runtime state: always load real stored photos or initialize empty
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PHOTOS);
      if (saved) {
        this.records = JSON.parse(saved);
      } else {
        this.records = [];
      }
    } catch {
      this.records = [];
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(this.records));
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.requiredConfig));
      localStorage.setItem(STORAGE_KEY_POLICY, this.replacementPolicy);
    } catch {}
    this.notify();
  }

  // ==================== CONFIG & POLICY ====================

  public getRequiredConfig(): PhotoRequiredConfig {
    return { ...this.requiredConfig };
  }

  public setRequiredConfig(config: Partial<PhotoRequiredConfig>): void {
    this.requiredConfig = { ...this.requiredConfig, ...config };
    this.persist();
  }

  public isPhotoRequired(entityType: PhotoEntityType): boolean {
    return this.requiredConfig[entityType] === 'REQUIRED';
  }

  public getReplacementPolicy(): PhotoReplacementPolicy {
    return this.replacementPolicy;
  }

  public setReplacementPolicy(policy: PhotoReplacementPolicy): void {
    this.replacementPolicy = policy;
    this.persist();
  }

  public isSubmissionAllowed(entityType: PhotoEntityType, photoStatus?: ProfilePhotoStatus): boolean {
    if (!this.isPhotoRequired(entityType)) return true;
    return photoStatus === 'UPLOADED' || photoStatus === 'VALID';
  }

  // ==================== PHOTO QUERY ====================

  public getPhotoByEntity(entityType: PhotoEntityType, entityId: string): ProfilePhotoRecord | undefined {
    return this.records.find(r => r.entity_type === entityType && r.entity_id === entityId);
  }

  public getPhotoById(id: string): ProfilePhotoRecord | undefined {
    return this.records.find(r => r.id === id);
  }

  public getAllPhotos(filters?: {
    entity_type?: PhotoEntityType;
    status?: ProfilePhotoStatus;
    search?: string;
  }): ProfilePhotoRecord[] {
    let list = [...this.records];
    if (filters?.entity_type) {
      list = list.filter(r => r.entity_type === filters.entity_type);
    }
    if (filters?.status) {
      list = list.filter(r => r.profile_photo_status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(r => r.entity_name.toLowerCase().includes(q) || r.entity_id.toLowerCase().includes(q));
    }
    return list;
  }

  // ==================== UPLOAD / ATTACH ====================

  /**
   * Upload and attach profile photo for an entity.
   * Resolves customer Google Drive path:
   * /SiEpang/Assets/Profile Photos/JAMRAN-2026/[Category]/[filename]
   */
  public async uploadPhoto(params: {
    entity_type: PhotoEntityType;
    entity_id: string;
    entity_name: string;
    data_url: string;
    thumbnail_url?: string;
    width?: number;
    height?: number;
    file_size_bytes?: number;
    uploader_name?: string;
    auto_approve?: boolean;
  }): Promise<ProfilePhotoRecord> {
    const { entity_type, entity_id, entity_name, data_url } = params;
    if (!/^data:image\/(webp|jpeg|png);base64,/.test(data_url)) {
      throw new Error('Foto harus berformat WebP, JPEG, atau PNG.');
    }
    const safeName = entity_name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 48);
    const response = await apiTransport.send<any>('admin.profilePhoto.upload', {
      entity_type,
      entity_id,
      entity_name,
      data_url,
      file_name: `${safeName}_${Date.now()}.webp`,
      width: params.width || 512,
      height: params.height || 512,
      file_size_bytes: params.file_size_bytes || Math.round(data_url.length * .75),
      ...(params.auto_approve ? { auto_approve: true } : {}),
    }, { timeoutMs: 60000 });
    if (!response.ok) throw new Error(response.error?.message || 'Upload ke Google Drive gagal.');
    // GAS currently returns the saved profile-photo record as response.data directly.
    // Accept the wrapped { record } shape as well for transport/backward compatibility.
    const remote = response.data?.record || response.data;
    const url = String(remote?.public_render_url || remote?.profile_photo_url || remote?.drive_url || '');
    const fileId = String(remote?.drive_file_id || remote?.profile_photo_file_id || '');
    if (!url.startsWith('https://') || !fileId) {
      throw new Error('GAS belum mengembalikan URL HTTPS dan ID file Google Drive yang valid.');
    }
    const existingIdx = this.records.findIndex(r => r.entity_type === entity_type && r.entity_id === entity_id);
    const record: ProfilePhotoRecord = {
      id: String(remote.id || `PHT-${Date.now()}`),
      entity_type, entity_id, entity_name,
      profile_photo_file_id: fileId,
      profile_photo_thumbnail_file_id: String(remote.profile_photo_thumbnail_file_id || ''),
      profile_photo_url: url,
      profile_photo_thumbnail_url: String(remote.thumbnail_url || url),
      profile_photo_status: String(remote.profile_photo_status || remote.verification_status || 'UPLOADED') as ProfilePhotoRecord['profile_photo_status'],
      customer_drive_path: String(remote.customer_drive_path || ''),
      width: params.width || 512, height: params.height || 512,
      file_size_bytes: params.file_size_bytes || 0,
      mime_type: 'image/webp', lifecycle_state: 'ATTACHED',
      uploaded_at: new Date().toISOString(),
    };
    if (existingIdx >= 0) this.records[existingIdx] = record;
    else this.records.unshift(record);
    this.persist();
    return record;
  }

  // ==================== MODERATION & VERIFICATION ====================

  public approvePhoto(recordId: string, verifierName: string): ProfilePhotoRecord {
    const record = this.records.find(r => r.id === recordId);
    if (!record) throw new Error('Foto profil tidak ditemukan');

    record.profile_photo_status = 'VALID';
    record.verified_at = new Date().toISOString();
    record.verified_by = verifierName;
    record.photo_rejection_reason = undefined;

    this.persist();
    return record;
  }

  public rejectPhoto(recordId: string, reason: string, verifierName: string): ProfilePhotoRecord {
    const record = this.records.find(r => r.id === recordId);
    if (!record) throw new Error('Foto profil tidak ditemukan');

    record.profile_photo_status = 'REJECTED';
    record.photo_rejection_reason = reason;
    record.verified_at = new Date().toISOString();
    record.verified_by = verifierName;

    this.persist();
    return record;
  }

  public requestReupload(recordId: string, reason: string, verifierName: string): ProfilePhotoRecord {
    const record = this.records.find(r => r.id === recordId);
    if (!record) throw new Error('Foto profil tidak ditemukan');

    record.profile_photo_status = 'NEEDS_REPLACEMENT';
    record.photo_rejection_reason = reason;
    record.verified_at = new Date().toISOString();
    record.verified_by = verifierName;

    this.persist();
    return record;
  }

  public deletePhoto(recordId: string): boolean {
    const idx = this.records.findIndex(r => r.id === recordId);
    if (idx !== -1) {
      this.records.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // ==================== ID CARD MISSING PHOTO PRECHECK (Req 51 & 52) ====================

  /**
   * Prechecks a list of document recipients to identify missing photos
   * before running single or batch ID card generation.
   */
  public checkMissingPhotos(recipients: { id: string; name: string; photoUrl?: string }[]): {
    totalCount: number;
    readyCount: number;
    missingCount: number;
    missingRecipients: { id: string; name: string }[];
  } {
    const missing: { id: string; name: string }[] = [];

    recipients.forEach(r => {
      // Check attached profile photo record or photoUrl
      const record = this.records.find(rec => rec.entity_id === r.id && rec.entity_type === 'PARTICIPANT');
      // A populated URL alone is not proof of approval. Only a verified canonical record qualifies.
      const hasValidPhoto = !!record && record.profile_photo_status === 'VALID' && !!record.profile_photo_file_id;
      if (!hasValidPhoto) {
        missing.push({ id: r.id, name: r.name });
      }
    });

    return {
      totalCount: recipients.length,
      readyCount: recipients.length - missing.length,
      missingCount: missing.length,
      missingRecipients: missing,
    };
  }

  // ==================== FALLBACK PLACEHOLDER ====================

  public getPlaceholderUrl(name: string = 'Peserta'): string {
    const initials = name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'SP';

    // SVG Data URI fallback
    const safeInitials = initials.replace(/[^A-Z0-9]/g, '').slice(0, 2) || 'SP';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="32" fill="#FFF1D6"/><circle cx="100" cy="84" r="60" fill="#C62828" opacity="0.09"/><text x="100" y="117" font-family="Arial,sans-serif" font-size="60" font-weight="bold" fill="#8B1E1E" text-anchor="middle">${safeInitials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // ==================== SUBSCRIPTIONS ====================

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

export const profilePhotoService = new ProfilePhotoService();
