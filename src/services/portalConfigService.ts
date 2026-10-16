/**
 * @license
 * SiEpang - Public Portal Configuration Service
 * Provides canonical section ordering and section visibility for the public event portal.
 * Respects admin configuration, featureControlService, and persistence.
 */

import { apiTransport } from './apiTransport';

export type PortalSectionKey =
  | 'hero'
  | 'announcements'
  | 'schedule'
  | 'leaderboard'
  | 'photo_gallery'
  | 'video_gallery'
  | 'qr_scanner'
  | 'visitor'
  | 'verification'
  | 'sponsors';

export interface PublicPortalConfig {
  section_order: PortalSectionKey[];
  section_visibility: Record<PortalSectionKey, boolean>;
  visitor_hours: string;
}

export const DEFAULT_PORTAL_SECTION_ORDER: PortalSectionKey[] = [
  'hero',
  'announcements',
  'schedule',
  'leaderboard',
  'photo_gallery',
  'video_gallery',
  'qr_scanner',
  'visitor',
  'verification',
  'sponsors',
];

export const DEFAULT_PORTAL_SECTION_VISIBILITY: Record<PortalSectionKey, boolean> = {
  hero: true,
  announcements: true,
  schedule: true,
  leaderboard: true,
  photo_gallery: true,
  video_gallery: true,
  qr_scanner: true,
  visitor: true,
  verification: true,
  sponsors: true,
};

export const DEFAULT_VISITOR_HOURS = '09:00 - 17:00 WIB';

class PortalConfigService {
  private config: PublicPortalConfig = {
    section_order: [...DEFAULT_PORTAL_SECTION_ORDER],
    section_visibility: { ...DEFAULT_PORTAL_SECTION_VISIBILITY },
    visitor_hours: DEFAULT_VISITOR_HOURS,
  };

  private listeners: Set<() => void> = new Set();

  private loaded = false;
  private lastError: string | null = null;

  /** Only GAS/FeatureConfigs is authoritative; never seed operational state from browser storage. */
  public async refreshFromGas(): Promise<void> {
    const result = await apiTransport.send<{ config: PublicPortalConfig | null }>(
      'portal.config.get', {}, { skipAuth: true },
    );
    if (!result.ok) {
      this.lastError = result.error?.message || 'Konfigurasi portal gagal dibaca dari GAS.';
      throw new Error(this.lastError);
    }
    const next = result.data?.config;
    this.config = next ? this.normalize(next) : this.defaults();
    this.loaded = true;
    this.lastError = null;
    this.notify();
  }

  public isLoaded(): boolean { return this.loaded; }
  public getLastError(): string | null { return this.lastError; }

  private defaults(): PublicPortalConfig {
    return { section_order: [...DEFAULT_PORTAL_SECTION_ORDER],
      section_visibility: { ...DEFAULT_PORTAL_SECTION_VISIBILITY },
      visitor_hours: DEFAULT_VISITOR_HOURS };
  }

  private normalize(config: Partial<PublicPortalConfig>): PublicPortalConfig {
    const input = Array.isArray(config?.section_order) ? config.section_order : [];
    const keys = [...new Set(input.filter((k): k is PortalSectionKey => DEFAULT_PORTAL_SECTION_ORDER.includes(k as PortalSectionKey)))];
    return {
      section_order: [...keys, ...DEFAULT_PORTAL_SECTION_ORDER.filter(k => !keys.includes(k))],
      section_visibility: Object.fromEntries(DEFAULT_PORTAL_SECTION_ORDER.map(k =>
        [k, typeof config?.section_visibility?.[k] === 'boolean' ? config.section_visibility[k] : DEFAULT_PORTAL_SECTION_VISIBILITY[k]]
      )) as Record<PortalSectionKey, boolean>,
      visitor_hours: typeof config?.visitor_hours === 'string' && config.visitor_hours.trim()
        ? config.visitor_hours.trim() : DEFAULT_VISITOR_HOURS,
    };
  }

  private async persist(next: PublicPortalConfig): Promise<void> {
    const result = await apiTransport.send<{ config: PublicPortalConfig }>('portal.config.set', { config: next });
    if (!result.ok || !result.data?.config) {
      this.lastError = result.error?.message || 'Konfigurasi gagal disimpan ke GAS.';
      throw new Error(this.lastError);
    }
    this.config = this.normalize(result.data.config);
    this.loaded = true;
    this.lastError = null;
    this.notify();
  }

  public getConfig(): PublicPortalConfig {
    return {
      section_order: [...this.config.section_order],
      section_visibility: { ...this.config.section_visibility },
      visitor_hours: this.config.visitor_hours || DEFAULT_VISITOR_HOURS,
    };
  }

  public getVisitorHours(): string {
    return this.config.visitor_hours || DEFAULT_VISITOR_HOURS;
  }

  public async setVisitorHours(hours: string): Promise<void> {
    await this.persist({ ...this.getConfig(), visitor_hours: hours.trim() || DEFAULT_VISITOR_HOURS });
  }

  public async updateSectionOrder(newOrder: PortalSectionKey[]): Promise<void> {
    await this.persist(this.normalize({ ...this.getConfig(), section_order: newOrder }));
  }

  public async setSectionVisibility(key: PortalSectionKey, visible: boolean): Promise<void> {
    if (!DEFAULT_PORTAL_SECTION_ORDER.includes(key)) throw new Error('Bagian portal tidak dikenal.');
    await this.persist({ ...this.getConfig(), section_visibility: { ...this.config.section_visibility, [key]: visible } });
  }

  public async resetToDefault(): Promise<void> {
    await this.persist(this.defaults());
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch {}
    });
  }
}

export const portalConfigService = new PortalConfigService();
