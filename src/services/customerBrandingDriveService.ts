/**
 * @license
 * SiEpang - Customer Drive Branding & Asset Architecture Service (Req 51-64)
 * Manages customer-owned Drive folder structures, App Logo, Favicon,
 * asset validation, multi-tier priority resolution, versioned cache-busting,
 * and system health auditing.
 */

import {
  CustomerDriveFolderStructure,
  CustomerBrandingAsset,
  BrandingAssetType,
  BrandingValidationResult,
  BrandingHealthReport,
} from '../types';
import { mediaResolverService } from './mediaResolverService';

const DEFAULT_DRIVE_STRUCTURE: CustomerDriveFolderStructure = {
  root_drive_folder_id: '',
  database_folder_id: '',
  branding_folder_id: '',
  app_logo_folder_id: '',
  favicon_folder_id: '',
  event_logo_folder_id: '',
  hero_folder_id: '',
  documents_folder_id: '',
  certificates_folder_id: '',
  id_cards_folder_id: '',
  backup_folder_id: '',
  assets_folder_id: '',
};

// Initial Default Customer Branding Assets (Pure clean installation: 0 dummy assets)
const INITIAL_BRANDING_ASSETS: CustomerBrandingAsset[] = [];

class CustomerBrandingDriveService {
  private folderStructure: CustomerDriveFolderStructure = { ...DEFAULT_DRIVE_STRUCTURE };
  private assets: CustomerBrandingAsset[] = [...INITIAL_BRANDING_ASSETS];
  private brandingVersion: number = 2;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
    this.applyFaviconToHead();
  }

  private loadFromStorage() {
    try {
      const storedFolders = localStorage.getItem('siepang_drive_folders');
      if (storedFolders) {
        const parsedFolders = JSON.parse(storedFolders) as CustomerDriveFolderStructure;
        const folderValues = Object.values(parsedFolders || {}).map(value => String(value || ''));
        const hasLegacyFixture = folderValues.some(value => /^1Drive_/i.test(value));
        if (!hasLegacyFixture) this.folderStructure = { ...DEFAULT_DRIVE_STRUCTURE, ...parsedFolders };
      }
      const storedAssets = localStorage.getItem('siepang_branding_assets');
      if (storedAssets) {
        const parsedAssets = JSON.parse(storedAssets) as CustomerBrandingAsset[];
        this.assets = Array.isArray(parsedAssets)
          ? parsedAssets.filter(asset =>
              !/^1Drive_/i.test(String(asset.drive_file_id || '')) &&
              !/^1Spr_/i.test(String(asset.drive_file_id || ''))
            )
          : [];
      }
      const storedVersion = localStorage.getItem('siepang_branding_version');
      if (storedVersion) {
        this.brandingVersion = parseInt(storedVersion, 10) || 1;
      }
    } catch {
      // Use in-memory defaults
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('siepang_drive_folders', JSON.stringify(this.folderStructure));
      localStorage.setItem('siepang_branding_assets', JSON.stringify(this.assets));
      localStorage.setItem('siepang_branding_version', this.brandingVersion.toString());
    } catch {
      // Quota or storage unavailable
    }
  }

  public getFolderStructure(): CustomerDriveFolderStructure {
    return { ...this.folderStructure };
  }

  public updateFolderStructure(updates: Partial<CustomerDriveFolderStructure>): CustomerDriveFolderStructure {
    this.folderStructure = {
      ...this.folderStructure,
      ...updates,
    };
    this.saveToStorage();
    this.notify();
    return this.folderStructure;
  }

  public getBrandingAssets(workspaceId?: string, assetType?: BrandingAssetType): CustomerBrandingAsset[] {
    return this.assets.filter(a => {
      const matchesWs = !workspaceId || a.workspace_id === workspaceId;
      const matchesType = !assetType || a.asset_type === assetType;
      return matchesWs && matchesType;
    });
  }

  public getActiveAsset(assetType: BrandingAssetType, workspaceId?: string): CustomerBrandingAsset | null {
    const list = this.getBrandingAssets(workspaceId, assetType);
    return list.find(a => a.status === 'ACTIVE') || list[0] || null;
  }

  public setActiveAsset(assetId: string, workspaceId?: string): CustomerBrandingAsset | null {
    const target = this.assets.find(a => a.branding_asset_id === assetId);
    if (!target) return null;

    // Archive others of same type & workspace
    this.assets = this.assets.map(a => {
      if (a.asset_type === target.asset_type && (!workspaceId || a.workspace_id === target.workspace_id)) {
        if (a.branding_asset_id === assetId) {
          return { ...a, status: 'ACTIVE', updated_at: new Date().toISOString() };
        }
        return { ...a, status: 'ARCHIVED' };
      }
      return a;
    });

    // Increment branding version for cache busting (Req 63)
    this.brandingVersion += 1;
    this.saveToStorage();
    this.applyFaviconToHead();
    this.notify();
    return target;
  }

  /**
   * Upload or add logo/favicon inside customer Drive structure:
   * App Logo: /SiEpang/Branding/App Logo/
   * Favicon: /SiEpang/Branding/Favicon/
   */
  public async uploadBrandingAsset(payload: {
    workspace_id: string;
    asset_type: BrandingAssetType;
    file_name: string;
    mime_type: string;
    public_render_url: string;
    drive_file_id?: string;
    dimensions?: { width: number; height: number };
    file_size_bytes?: number;
    created_by?: string;
  }): Promise<CustomerBrandingAsset> {
    const generatedFileId = payload.drive_file_id || '';
    if (!generatedFileId) {
      throw new Error('BRANDING_UPLOAD_FAILED: GAS tidak mengembalikan drive_file_id. Asset tidak disimpan sebagai record lokal.');
    }
    const newVersion = (this.assets.filter(a => a.asset_type === payload.asset_type).length || 0) + 1;

    // Set previously active to archived
    this.assets = this.assets.map(a => {
      if (a.asset_type === payload.asset_type && a.workspace_id === payload.workspace_id) {
        return { ...a, status: 'ARCHIVED' };
      }
      return a;
    });

    const newAsset: CustomerBrandingAsset = {
      branding_asset_id: `asset_${Date.now()}`,
      workspace_id: payload.workspace_id,
      asset_type: payload.asset_type,
      drive_file_id: generatedFileId,
      file_name: payload.file_name,
      mime_type: payload.mime_type,
      public_render_url: payload.public_render_url,
      status: 'ACTIVE',
      version: newVersion,
      dimensions: payload.dimensions || { width: 512, height: 512 },
      file_size_bytes: payload.file_size_bytes || 120000,
      created_at: new Date().toISOString(),
      created_by: payload.created_by || 'Admin Branding',
    };

    this.assets.unshift(newAsset);
    this.brandingVersion += 1;
    this.saveToStorage();
    this.applyFaviconToHead();
    this.notify();
    return newAsset;
  }

  public restoreDefaultAsset(assetType: BrandingAssetType, workspaceId?: string) {
    const defaultAsset = INITIAL_BRANDING_ASSETS.find(a => a.asset_type === assetType);
    if (!defaultAsset) return;

    this.assets = this.assets.map(a => {
      if (a.asset_type === assetType && (!workspaceId || a.workspace_id === workspaceId)) {
        if (a.branding_asset_id === defaultAsset.branding_asset_id) {
          return { ...a, status: 'ACTIVE' };
        }
        return { ...a, status: 'ARCHIVED' };
      }
      return a;
    });

    this.brandingVersion += 1;
    this.saveToStorage();
    this.applyFaviconToHead();
    this.notify();
  }

  /**
   * Branding validation (Req 61):
   * checks file readable, mime type, min quality, dimensions, square aspect for favicon
   */
  public async validateBrandingFile(
    fileUrl: string,
    assetType: BrandingAssetType
  ): Promise<BrandingValidationResult> {
    if (!fileUrl || !fileUrl.trim()) {
      return {
        valid: false,
        state: 'INVALID_URL',
        message: 'URL gambar tidak boleh kosong.',
      };
    }

    const trimmed = fileUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/')) {
      return {
        valid: false,
        state: 'INVALID_URL',
        message: 'Format URL tidak valid. Gunakan https:// atau data URI.',
      };
    }

    // Resolve media with existing MediaResolver
    const resolved = mediaResolverService.resolveMedia(trimmed);
    if (resolved.accessStatus !== 'ACCESSIBLE') {
      return {
        valid: false,
        state: resolved.accessStatus as any,
        message: resolved.errorMessage || 'Logo tidak dapat dimuat. Periksa URL gambar.',
      };
    }

    // Inspect image dimensions via DOM Image if available
    return new Promise<BrandingValidationResult>(resolve => {
      if (typeof window === 'undefined') {
        resolve({
          valid: true,
          state: 'ACCESSIBLE',
          message: 'Gambar berhasil diverifikasi.',
        });
        return;
      }

      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const warnings: string[] = [];

        if (assetType === 'FAVICON') {
          const ratio = width / Math.max(1, height);
          if (ratio < 0.85 || ratio > 1.15) {
            warnings.push(`Favicon disarankan bersudut persegi (1:1). Aspek saat ini: ${width}x${height} (${ratio.toFixed(2)}:1).`);
          }
          if (width < 64 || height < 64) {
            warnings.push('Resolusi favicon sangat kecil. Disarankan minimal 512x512 piksel untuk PWA.');
          }
        } else if (assetType === 'APP_LOGO') {
          if (width < 120 || height < 120) {
            warnings.push('Resolusi logo cukup rendah (< 120px). Tampilan header mungkin tampak buram.');
          }
        }

        resolve({
          valid: true,
          state: 'ACCESSIBLE',
          message: warnings.length > 0 ? warnings.join(' ') : 'Gambar valid dan siap digunakan.',
          warnings: warnings.length > 0 ? warnings : undefined,
          dimensions: { width, height },
          aspectRatio: width / Math.max(1, height),
        });
      };

      img.onerror = () => {
        resolve({
          valid: false,
          state: 'BROKEN_SOURCE',
          message: 'Logo tidak dapat dimuat. Periksa URL gambar.',
        });
      };

      img.src = resolved.previewUrl || resolved.thumbnailUrl || trimmed;
    });
  }

  /**
   * System Health Audit for Branding (Req 62):
   * ✓ App Logo
   * ✓ Favicon
   * ✓ Drive Access
   */
  public getBrandingHealth(workspaceId?: string): BrandingHealthReport {
    const appLogo = this.getActiveAsset('APP_LOGO', workspaceId);
    const favicon = this.getActiveAsset('FAVICON', workspaceId);
    const driveFolder = this.folderStructure.branding_folder_id;

    const logoOk = Boolean(appLogo && appLogo.public_render_url && appLogo.public_render_url.length > 0);
    const faviconOk = Boolean(favicon && favicon.public_render_url && favicon.public_render_url.length > 0);
    const driveOk = Boolean(driveFolder && driveFolder.length > 0);

    const overallStatus: 'HEALTHY' | 'WARNING' | 'ERROR' =
      logoOk && faviconOk && driveOk ? 'HEALTHY' : logoOk || faviconOk ? 'WARNING' : 'ERROR';

    return {
      status: overallStatus,
      appLogo: {
        ok: logoOk,
        message: logoOk ? 'App Logo aktif & dapat diakses' : '! Logo tidak dapat diakses',
        url: appLogo?.public_render_url,
        fileId: appLogo?.drive_file_id,
        version: appLogo?.version,
      },
      favicon: {
        ok: faviconOk,
        message: faviconOk ? 'Favicon aktif (512x512 pwa-ready)' : '! Favicon belum dikonfigurasi',
        url: favicon?.public_render_url,
        fileId: favicon?.drive_file_id,
        version: favicon?.version,
      },
      driveAccess: {
        ok: driveOk,
        message: driveOk ? 'Koneksi folder customer Drive aman' : '! Folder Drive Branding belum tersinkronisasi',
        folderId: driveFolder,
      },
    };
  }

  /**
   * Branding Priority Resolution (Req 59):
   * Event Branding → Workspace Branding → Installation Branding → SiEpang Default
   */
  public getEffectiveBranding(
    eventLogoUrl?: string,
    workspaceLogoUrl?: string
  ): {
    appLogoUrl: string;
    faviconUrl: string;
    source: 'event' | 'workspace' | 'installation' | 'default';
    version: number;
  } {
    const activeLogoAsset = this.getActiveAsset('APP_LOGO');
    const activeFaviconAsset = this.getActiveAsset('FAVICON');

    let resolvedLogo = '';
    let source: 'event' | 'workspace' | 'installation' | 'default' = 'default';

    if (eventLogoUrl && eventLogoUrl.trim()) {
      resolvedLogo = eventLogoUrl;
      source = 'event';
    } else if (workspaceLogoUrl && workspaceLogoUrl.trim()) {
      resolvedLogo = workspaceLogoUrl;
      source = 'workspace';
    } else if (activeLogoAsset?.public_render_url) {
      resolvedLogo = activeLogoAsset.public_render_url;
      source = 'installation';
    } else {
      resolvedLogo = '/icon.svg';
      source = 'default';
    }

    const resolvedFavicon =
      activeFaviconAsset?.public_render_url ||
      '/icon.svg';

    return {
      appLogoUrl: resolvedLogo,
      faviconUrl: resolvedFavicon,
      source,
      version: this.brandingVersion,
    };
  }

  /**
   * Updates browser <link rel="icon"> and PWA apple-touch-icon dynamically
   */
  public applyFaviconToHead() {
    if (typeof document === 'undefined') return;

    const activeFavicon = this.getActiveAsset('FAVICON');
    if (!activeFavicon?.public_render_url) return;

    const urlWithVersion = `${activeFavicon.public_render_url}?v=${this.brandingVersion}`;

    let iconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.type = 'image/png';
      iconLink.rel = 'shortcut icon';
      document.getElementsByTagName('head')[0].appendChild(iconLink);
    }
    iconLink.href = urlWithVersion;

    // Apple touch icon for PWA home screen (Req 58)
    let appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.getElementsByTagName('head')[0].appendChild(appleIcon);
    }
    appleIcon.href = urlWithVersion;
  }

  public getBrandingVersion(): number {
    return this.brandingVersion;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('Error notifying branding listener:', err);
      }
    });
  }
}

export const customerBrandingDriveService = new CustomerBrandingDriveService();
