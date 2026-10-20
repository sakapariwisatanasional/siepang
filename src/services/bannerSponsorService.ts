/**
 * @license
 * SiEpang - Hero Banner, Public Information Banner & Sponsor Service (Requirements 21-41, 49, 50, 52-54, 58, 63)
 * Full management of advertising, announcements, and sponsor media.
 */

import {
  BannerItem,
  SponsorItem,
  BannerType,
  BannerPreset,
  BannerFitMode,
  BannerDisplayLocation,
  BannerPriority,
  MediaPublicationStatus,
  SponsorTier,
  BannerRotatorConfig,
  SponsorCarouselConfig,
} from '../types';
import { mediaResolverService } from './mediaResolverService';
import { eventStudioService } from './eventStudioService';
import { eventService } from './eventService';
import { workspaceService } from './workspaceService';
import { apiTransport } from './apiTransport';

class BannerSponsorService {
  private banners: Map<string, BannerItem> = new Map();
  private sponsors: Map<string, SponsorItem> = new Map();
  private rotatorConfig: BannerRotatorConfig = {
    mode: 'AUTO_ROTATE',
    rotationIntervalSeconds: 6,
    showNavigationDots: true,
    enableMobileSwipe: true,
    pauseOnHover: true,
  };
  private carouselConfig: SponsorCarouselConfig = {
    enabled: true,
    direction: 'RIGHT_TO_LEFT',
    carousel_duration_seconds: 30, // Normal 30s, Fast 15s, Slow 60s
    pauseOnHover: true,
    pauseOnTouch: true,
  };
  private listeners: Set<() => void> = new Set();
  private settingsMutation: Promise<void> = Promise.resolve();

  /** Browser storage is never an authoritative settings source. */
  public async refreshSettingsFromGas(): Promise<void> {
    const result = await apiTransport.send<{ settings: { rotator: BannerRotatorConfig; carousel: SponsorCarouselConfig } }>(
      'banner.settings.get', {}, { skipAuth: true });
    if (!result.ok || !result.data?.settings) throw new Error(result.error?.message || 'Pengaturan banner gagal dibaca dari GAS.');
    this.rotatorConfig = { ...result.data.settings.rotator };
    this.carouselConfig = { ...result.data.settings.carousel };
    this.notify();
  }

  private async saveSettings(nextRotator: BannerRotatorConfig, nextCarousel: SponsorCarouselConfig): Promise<void> {
    const result = await apiTransport.send<{ settings: { rotator: BannerRotatorConfig; carousel: SponsorCarouselConfig } }>(
      'banner.settings.set', { settings: { rotator: nextRotator, carousel: nextCarousel } });
    if (!result.ok || !result.data?.settings) throw new Error(result.error?.message || 'Pengaturan gagal disimpan ke GAS.');
    this.rotatorConfig = { ...result.data.settings.rotator };
    this.carouselConfig = { ...result.data.settings.carousel };
    this.notify();
  }

  // ==================== BANNER OPERATIONS ====================

  public getBanners(options?: {
    location?: BannerDisplayLocation;
    type?: BannerType;
    status?: MediaPublicationStatus;
    onlyActiveNow?: boolean;
  }): BannerItem[] {
    let list = Array.from(this.banners.values());

    if (options?.location) {
      list = list.filter(b => b.display_location === options.location);
    }
    if (options?.type) {
      list = list.filter(b => b.banner_type === options.type);
    }
    if (options?.status) {
      list = list.filter(b => b.publication_status === options.status);
    }

    if (options?.onlyActiveNow) {
      const now = new Date().toISOString();
      list = list.filter(b => {
        if (b.publication_status !== 'PUBLISHED') return false;
        if (b.publish_start && b.publish_start > now) return false;
        if (b.publish_end && b.publish_end < now) return false;
        return true;
      });
    }

    // Sort by priority (URGENT first) then display_order
    return list.sort((a, b) => {
      const pMap: Record<BannerPriority, number> = { URGENT: 1, IMPORTANT: 2, NORMAL: 3 };
      if (pMap[a.priority] !== pMap[b.priority]) {
        return pMap[a.priority] - pMap[b.priority];
      }
      return a.display_order - b.display_order;
    });
  }

  public getBannerById(id: string): BannerItem | undefined {
    return this.banners.get(id);
  }

  public createBanner(data: {
    banner_type: BannerType;
    title: string;
    subtitle?: string;
    image_url: string;
    desktop_preset?: BannerPreset;
    mobile_preset?: BannerPreset;
    mobile_image_url?: string;
    fit_mode?: BannerFitMode;
    focal_x?: number;
    focal_y?: number;
    target_type?: 'NONE' | 'INTERNAL_ROUTE' | 'EXTERNAL_URL';
    target_url?: string;
    cta_label?: string;
    display_location?: BannerDisplayLocation;
    priority?: BannerPriority;
    publish_start?: string;
    publish_end?: string;
    publication_status?: MediaPublicationStatus;
    createdBy?: string;
  }): BannerItem {
    const id = `ban_${Date.now()}`;
    const resolution = mediaResolverService.resolveSource(data.image_url);

    const banner: BannerItem = {
      banner_id: id,
      workspace_id: workspaceService.getCurrentWorkspace().id || '',
      event_id: eventService.getCurrentEvent().id || '',
      banner_type: data.banner_type,
      title: data.title.trim(),
      subtitle: data.subtitle?.trim(),
      image_url: resolution.thumbnailUrl || data.image_url,
      source_type: resolution.sourceType,
      desktop_preset: data.desktop_preset || 'BILLBOARD', // 970x250 default
      mobile_preset: data.mobile_preset || 'LARGE_MOBILE_BANNER', // 320x100 default
      mobile_image_url: data.mobile_image_url?.trim(),
      fit_mode: data.fit_mode || 'COVER',
      focal_x: typeof data.focal_x === 'number' ? data.focal_x : 50,
      focal_y: typeof data.focal_y === 'number' ? data.focal_y : 50,
      target_type: data.target_type || 'NONE',
      target_url: data.target_url?.trim(),
      cta_label: data.cta_label?.trim(),
      display_location: data.display_location || 'PUBLIC_HOME_TOP',
      display_order: this.banners.size + 1,
      priority: data.priority || 'NORMAL',
      publish_start: data.publish_start || new Date().toISOString().replace('T', ' ').slice(0, 16),
      publish_end: data.publish_end,
      publication_status: data.publication_status || 'PUBLISHED',
      click_tracking_enabled: true,
      impressions_count: 0,
      clicks_count: 0,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
      created_by: data.createdBy || 'Event Admin',
    };

    this.banners.set(id, banner);

    eventStudioService.addAuditLogEntry(
      'BANNER_CREATED',
      `Banner '${banner.title}' (${banner.banner_type}) berhasil dibuat.`,
      data.createdBy || 'Admin'
    );

    this.notify();
    return banner;
  }

  public updateBanner(id: string, updates: Partial<BannerItem>, updatedBy?: string): BannerItem {
    const target = this.banners.get(id);
    if (!target) throw new Error('Banner tidak ditemukan.');

    const updated: BannerItem = {
      ...target,
      ...updates,
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    this.banners.set(id, updated);

    eventStudioService.addAuditLogEntry(
      'BANNER_UPDATED',
      `Banner '${updated.title}' diperbarui.`,
      updatedBy || 'Admin'
    );

    this.notify();
    return updated;
  }

  public deleteBanner(id: string, deletedBy?: string): boolean {
    const target = this.banners.get(id);
    if (!target) return false;

    this.banners.delete(id);

    eventStudioService.addAuditLogEntry(
      'BANNER_DELETED',
      `Banner '${target.title}' dihapus.`,
      deletedBy || 'Admin'
    );

    this.notify();
    return true;
  }

  public recordBannerImpression(id: string): void {
    const b = this.banners.get(id);
    if (b && b.click_tracking_enabled) {
      b.impressions_count = (b.impressions_count || 0) + 1;
    }
  }

  public recordBannerClick(id: string): void {
    const b = this.banners.get(id);
    if (b && b.click_tracking_enabled) {
      b.clicks_count = (b.clicks_count || 0) + 1;
      this.notify();
    }
  }

  /** Read sponsor records from the authoritative GAS entity API. */
  public async refreshSponsorsFromGas(): Promise<void> {
    const result = await apiTransport.send<{ records: any[] }>(
      'admin.entity.list', { entity: 'sponsors', filters: {} });
    if (!result.ok || !Array.isArray(result.data?.records)) {
      throw new Error(result.error?.message || 'Daftar sponsor gagal dibaca dari GAS.');
    }
    this.sponsors.clear();
    result.data.records.forEach((raw: any) => {
      const item = this.normalizeSponsorRecord_(raw);
      if (item.sponsor_id) this.sponsors.set(item.sponsor_id, item);
    });
    this.notify();
  }

  /** Public endpoint returns only active and published sponsor metadata. */
  public async refreshPublicSponsorsFromGas(): Promise<void> {
    const result = await apiTransport.send<{ sponsors: any[] }>(
      'sponsor.public.list', {}, { skipAuth: true });
    if (!result.ok || !Array.isArray(result.data?.sponsors)) {
      throw new Error(result.error?.message || 'Logo sponsor publik gagal dimuat.');
    }
    this.sponsors.clear();
    result.data.sponsors.forEach((raw: any) => {
      const item = this.normalizeSponsorRecord_(raw);
      if (item.sponsor_id) this.sponsors.set(item.sponsor_id, item);
    });
    this.notify();
  }

  private normalizeSponsorRecord_(raw: any): SponsorItem {
    const logo = String(raw.logo_url || '').trim();
    return {
      sponsor_id: String(raw.sponsor_id || raw.id || ''),
      workspace_id: String(raw.workspace_id || workspaceService.getCurrentWorkspace().id || ''),
      event_id: String(raw.event_id || eventService.getCurrentEvent().id || ''),
      sponsor_name: String(raw.sponsor_name || 'Mitra Sponsor'),
      sponsor_tier: raw.sponsor_tier || 'PARTNER',
      logo_url: logo,
      target_url: String(raw.target_url || raw.website_url || ''),
      website_url: String(raw.website_url || raw.target_url || ''),
      banner_id: raw.banner_id || undefined,
      display_order: Number(raw.display_order || 0),
      status: String(raw.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      publication_status: String(raw.publication_status || 'PUBLISHED').toUpperCase() as MediaPublicationStatus,
      created_at: String(raw.created_at || new Date().toISOString()),
      created_by: String(raw.created_by || 'Admin'),
      updated_at: String(raw.updated_at || ''),
      updated_by: String(raw.updated_by || ''),
    };
  }

  public async uploadSponsorLogo(fileName: string, dataUrl: string): Promise<string> {
    const result = await apiTransport.send<{ logo_url: string; drive_file_id: string }>(
      'admin.sponsor.logo.upload', { file_name: fileName, data_url: dataUrl });
    if (!result.ok || !result.data?.logo_url) {
      throw new Error(result.error?.message || 'Upload logo sponsor gagal.');
    }
    return result.data.logo_url;
  }

  public async createSponsorPersisted(data: {
    sponsor_name?: string; sponsor_tier?: SponsorTier; logo_url: string;
    target_url?: string; website_url?: string; status?: 'ACTIVE' | 'INACTIVE';
    banner_id?: string; publication_status?: MediaPublicationStatus; createdBy?: string;
  }): Promise<SponsorItem> {
    const current = this.getSponsors();
    const active = data.status !== 'INACTIVE';
    const record: any = {
      sponsor_id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspace_id: workspaceService.getCurrentWorkspace().id || '',
      event_id: eventService.getCurrentEvent().id || '',
      sponsor_name: data.sponsor_name?.trim() || 'Mitra Sponsor',
      sponsor_tier: data.sponsor_tier || 'PARTNER',
      logo_url: data.logo_url.trim(),
      target_url: (data.target_url || data.website_url || '').trim(),
      website_url: (data.target_url || data.website_url || '').trim(),
      banner_id: data.banner_id || '',
      display_order: current.length ? Math.max(...current.map(s => Number(s.display_order) || 0)) + 1 : 1,
      status: data.status || 'ACTIVE',
      publication_status: data.publication_status || (active ? 'PUBLISHED' : 'ARCHIVED'),
      created_at: new Date().toISOString(),
      created_by: data.createdBy || 'Admin',
    };
    const result = await apiTransport.send<{ record: any }>('admin.entity.upsert', { entity: 'sponsors', record });
    if (!result.ok || !result.data?.record) throw new Error(result.error?.message || 'Sponsor gagal disimpan ke GAS.');
    const saved = this.normalizeSponsorRecord_(result.data.record);
    this.sponsors.set(saved.sponsor_id, saved);
    this.notify();
    return saved;
  }

  public async updateSponsorPersisted(id: string, updates: Partial<SponsorItem>): Promise<SponsorItem> {
    const current = this.sponsors.get(id);
    if (!current) throw new Error('Sponsor tidak ditemukan. Muat ulang daftar sponsor.');
    const record = { ...current, ...updates, sponsor_id: id, updated_at: new Date().toISOString() };
    const result = await apiTransport.send<{ record: any }>('admin.entity.upsert', { entity: 'sponsors', record });
    if (!result.ok || !result.data?.record) throw new Error(result.error?.message || 'Perubahan sponsor gagal disimpan ke GAS.');
    const saved = this.normalizeSponsorRecord_(result.data.record);
    this.sponsors.set(id, saved);
    this.notify();
    return saved;
  }

  public async deleteSponsorPersisted(id: string): Promise<void> {
    const current = this.sponsors.get(id);
    if (!current) return;
    await this.updateSponsorPersisted(id, { status: 'INACTIVE', publication_status: 'ARCHIVED', updated_at: new Date().toISOString() });
  }

  public async reorderSponsorPersisted(id: string, direction: 'UP' | 'DOWN'): Promise<void> {
    const list = this.getSponsors().filter(s => s.publication_status !== 'ARCHIVED');
    const index = list.findIndex(s => s.sponsor_id === id);
    const otherIndex = direction === 'UP' ? index - 1 : index + 1;
    if (index < 0 || otherIndex < 0 || otherIndex >= list.length) return;
    const current = list[index], other = list[otherIndex];
    const oldOrder = current.display_order, otherOrder = other.display_order;
    await this.updateSponsorPersisted(current.sponsor_id, { display_order: otherOrder });
    await this.updateSponsorPersisted(other.sponsor_id, { display_order: oldOrder });
  }

  public async toggleSponsorStatusPersisted(id: string): Promise<SponsorItem> {
    const current = this.sponsors.get(id);
    if (!current) throw new Error('Sponsor tidak ditemukan.');
    const publish = current.publication_status !== 'PUBLISHED' || current.status === 'INACTIVE';
    return this.updateSponsorPersisted(id, {
      status: publish ? 'ACTIVE' : 'INACTIVE',
      publication_status: publish ? 'PUBLISHED' : 'ARCHIVED',
      updated_at: new Date().toISOString(),
    });
  }

  // ==================== SPONSOR OPERATIONS ====================

  public getSponsors(filterStatus?: MediaPublicationStatus): SponsorItem[] {
    let list = Array.from(this.sponsors.values());
    if (filterStatus) {
      list = list.filter(s => s.publication_status === filterStatus);
    }
    return list.sort((a, b) => a.display_order - b.display_order);
  }

  public getSponsorById(id: string): SponsorItem | undefined {
    return this.sponsors.get(id);
  }

  public createSponsor(data: {
    sponsor_name?: string;
    sponsor_tier?: SponsorTier;
    logo_url: string;
    target_url?: string;
    website_url?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    banner_id?: string;
    publication_status?: MediaPublicationStatus;
    createdBy?: string;
  }): SponsorItem {
    const id = `sp_${Date.now()}`;
    const targetLink = (data.target_url || data.website_url)?.trim();
    const isActive = data.status ? data.status === 'ACTIVE' : true;

    const sponsor: SponsorItem = {
      sponsor_id: id,
      workspace_id: workspaceService.getCurrentWorkspace().id || '',
      event_id: eventService.getCurrentEvent().id || '',
      sponsor_name: data.sponsor_name?.trim() || 'Mitra Sponsor',
      sponsor_tier: data.sponsor_tier || 'PARTNER',
      logo_url: data.logo_url.trim(),
      target_url: targetLink,
      website_url: targetLink,
      banner_id: data.banner_id,
      display_order: this.sponsors.size + 1,
      status: data.status || (isActive ? 'ACTIVE' : 'INACTIVE'),
      publication_status: data.publication_status || (isActive ? 'PUBLISHED' : 'ARCHIVED'),
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
      created_by: data.createdBy || 'Admin',
    };

    this.sponsors.set(id, sponsor);

    eventStudioService.addAuditLogEntry(
      'SPONSOR_CREATED',
      `Sponsor logo '${sponsor.sponsor_name}' ditambahkan.`,
      data.createdBy || 'Admin'
    );

    this.notify();
    return sponsor;
  }

  public updateSponsor(id: string, updates: Partial<SponsorItem>, updatedBy?: string): SponsorItem {
    const target = this.sponsors.get(id);
    if (!target) throw new Error('Sponsor tidak ditemukan.');

    const updated = {
      ...target,
      ...updates,
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    this.sponsors.set(id, updated);

    eventStudioService.addAuditLogEntry(
      'SPONSOR_UPDATED',
      `Sponsor '${updated.sponsor_name}' diperbarui.`,
      updatedBy || 'Admin'
    );

    this.notify();
    return updated;
  }

  public deleteSponsor(id: string, deletedBy?: string): boolean {
    const target = this.sponsors.get(id);
    if (!target) return false;

    this.sponsors.delete(id);

    eventStudioService.addAuditLogEntry(
      'SPONSOR_DELETED',
      `Sponsor '${target.sponsor_name}' dihapus.`,
      deletedBy || 'Admin'
    );

    this.notify();
    return true;
  }

  public reorderSponsor(id: string, direction: 'UP' | 'DOWN'): boolean {
    const list = this.getSponsors();
    const index = list.findIndex(s => s.sponsor_id === id);
    if (index === -1) return false;
    if (direction === 'UP' && index === 0) return false;
    if (direction === 'DOWN' && index === list.length - 1) return false;

    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    const current = list[index];
    const target = list[targetIdx];

    const currentOrder = current.display_order;
    current.display_order = target.display_order;
    target.display_order = currentOrder;

    this.sponsors.set(current.sponsor_id, { ...current });
    this.sponsors.set(target.sponsor_id, { ...target });

    this.notify();
    return true;
  }

  public toggleSponsorStatus(id: string, updatedBy?: string): SponsorItem {
    const sponsor = this.sponsors.get(id);
    if (!sponsor) throw new Error('Sponsor tidak ditemukan.');

    const nextStatus = sponsor.publication_status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    sponsor.publication_status = nextStatus;
    sponsor.status = nextStatus === 'PUBLISHED' ? 'ACTIVE' : 'INACTIVE';
    sponsor.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 16);
    sponsor.updated_by = updatedBy || 'Admin';

    this.sponsors.set(id, sponsor);
    this.notify();
    return sponsor;
  }

  // ==================== SPONSOR CAROUSEL SETTINGS (Section 11 & 12) ====================

  public getCarouselConfig(): SponsorCarouselConfig {
    return { ...this.carouselConfig };
  }

  public async updateCarouselConfig(updates: Partial<SponsorCarouselConfig>, _eventId: string = ''): Promise<SponsorCarouselConfig> {
    const operation = this.settingsMutation.catch(() => {}).then(() =>
      this.saveSettings(this.rotatorConfig, { ...this.carouselConfig, ...updates }));
    this.settingsMutation = operation;
    await operation;
    return this.getCarouselConfig();
  }

  // ==================== ROTATOR SETTINGS ====================

  public getRotatorConfig(): BannerRotatorConfig {
    return { ...this.rotatorConfig };
  }

  public async updateRotatorConfig(updates: Partial<BannerRotatorConfig>): Promise<BannerRotatorConfig> {
    const operation = this.settingsMutation.catch(() => {}).then(() =>
      this.saveSettings({ ...this.rotatorConfig, ...updates }, this.carouselConfig));
    this.settingsMutation = operation;
    await operation;
    return this.getRotatorConfig();
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

export const bannerSponsorService = new BannerSponsorService();
