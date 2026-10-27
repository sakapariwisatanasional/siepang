/**
 * @license
 * SiEpang - Dynamic Customer PWA Manifest & Branding Injector (Req 36 & 37)
 * Replaces static developer manifest with dynamic per-customer branding:
 * app name, short name, theme color, icons, and Apple touch identity.
 */

import { customerBrandingDriveService } from './customerBrandingDriveService';

export interface DynamicManifestConfig {
  name: string;
  short_name: string;
  theme_color: string;
  background_color: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui';
  start_url: string;
}

class DynamicManifestService {
  private currentManifestUrl: string | null = null;
  private initialized = false;

  constructor() {
    this.initDynamicManifest();
  }

  public initDynamicManifest() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (this.initialized) return;
    this.initialized = true;
    this.updateManifest();

    // Listen to customer branding changes
    customerBrandingDriveService.subscribe(() => {
      this.updateManifest();
    });
  }

  public updateManifest(customConfig?: Partial<DynamicManifestConfig>) {
    if (typeof document === 'undefined') return;

    const effective = customerBrandingDriveService.getEffectiveBranding();
    const appLogo = customerBrandingDriveService.getActiveAsset('APP_LOGO');
    const favicon = customerBrandingDriveService.getActiveAsset('FAVICON');

    const appName = customConfig?.name || 'SiEpang - Sistem Informasi Perkemahan Pramuka';
    const shortName = customConfig?.short_name || 'SiEpang';
    const themeColor = customConfig?.theme_color || '#833AB4';
    const bgColor = customConfig?.background_color || '#0b140e';

    const iconUrl = favicon?.public_render_url || effective.faviconUrl || '/icon-192.png';
    const logoUrl = appLogo?.public_render_url || effective.appLogoUrl || '/icon-512.png';

    const manifestData = {
      name: appName,
      short_name: shortName,
      description: 'Sistem Informasi Perkemahan Pramuka modern, mandiri, dan offline-first.',
      id: new URL('/', window.location.origin).href,
      scope: new URL('/', window.location.origin).href,
      start_url: new URL(customConfig?.start_url || '/', window.location.origin).href,
      display: customConfig?.display || 'standalone',
      background_color: bgColor,
      theme_color: themeColor,
      // Bundled PNGs are always valid fallbacks. Absolute URLs are needed
      // because the dynamic manifest itself is served through a blob URL.
      icons: [
        {src:new URL('/icon-192.png', window.location.origin).href, sizes:'192x192', type:'image/png', purpose:'any'},
        {src:new URL('/icon-512.png', window.location.origin).href, sizes:'512x512', type:'image/png', purpose:'any'},
        // Preserve customer branding without claiming unverified dimensions/type.
        ...[...new Set([iconUrl, logoUrl])].filter(url => url && !url.startsWith('/icon-')).map(url => ({src:new URL(url, window.location.origin).href, sizes:'any', purpose:'any'})),
      ],
    };

    // Clean up previous blob URL if any
    if (this.currentManifestUrl && this.currentManifestUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.currentManifestUrl);
    }

    const manifestBlob = new Blob([JSON.stringify(manifestData, null, 2)], {
      type: 'application/json',
    });
    this.currentManifestUrl = URL.createObjectURL(manifestBlob);

    // Update <link rel="manifest">
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = this.currentManifestUrl;

    // Update theme-color meta
    let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = themeColor;

    // Update Apple Mobile Web App Title
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleTitle);
    }
    appleTitle.content = shortName;
  }
}

export const dynamicManifestService = new DynamicManifestService();
