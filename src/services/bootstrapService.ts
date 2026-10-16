/**
 * @license
 * SiEpang - First Bootstrap Service
 *
 * Production rules:
 * - GAS backend is the sole authority for bootstrap status/token validation.
 * - No browser-generated bootstrap token.
 * - No production mock/fake installation IDs.
 * - Vercel environment variable is optional, not required.
 * - Canonical GAS URL from src/config/backend.ts is the final fallback.
 */

import { SIEPANG_BACKEND_URL } from '../config/backend';
import { customerInstallationService } from './customerInstallationService';

export interface BootstrapStatus {
  installation_ready: boolean;
  backend_reachable: boolean;
}

export interface BootstrapData {
  installation_ready: boolean;
  installation_id: string;
  workspace_id: string;
  event_id: string;
  superadmin: {
    email: string;
    role: string;
    status: string;
  };
  otp_ready: boolean;
}

export interface BootstrapInitResult {
  success: boolean;
  data?: BootstrapData;
  error?: {
    code: string;
    message: string;
  };
}

class BootstrapService {
  private isReady = false;

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    try {
      this.isReady = localStorage.getItem('siepang_bootstrap_ready') === 'true';
    } catch {
      this.isReady = false;
    }
  }

  /**
   * Resolution order:
   * 1. Optional Vite env override.
   * 2. Existing installation record.
   * 3. Canonical production GAS URL committed with the frontend.
   */
  public getBackendUrl(): string {
    const envUrl = (import.meta as any).env?.VITE_SIEPANG_BACKEND_URL;

    if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
      return envUrl.trim();
    }

    const record = customerInstallationService.getInstallationRecord();

    if (
      typeof record?.web_app_url === 'string' &&
      record.web_app_url.trim().length > 0
    ) {
      return record.web_app_url.trim();
    }

    return SIEPANG_BACKEND_URL.trim();
  }

  public isInstallationReady(): boolean {
    return this.isReady || customerInstallationService.isConfigured();
  }

  public setInstallationReady(ready: boolean): void {
    this.isReady = ready;

    try {
      if (ready) {
        localStorage.setItem('siepang_bootstrap_ready', 'true');
      } else {
        localStorage.removeItem('siepang_bootstrap_ready');
      }
    } catch {
      // Browser storage is only a UI cache, never bootstrap authority.
    }
  }

  private parseStatusResponse(raw: string): BootstrapStatus | null {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.ok !== true || !parsed?.data || parsed.data.reachable !== true) {
        return null;
      }

      // GAS system.health uses `configured`, not `installation_ready`.
      // Do not infer readiness solely from an existing browser session.
      const ready = parsed.data.configured === true;
      if (ready) this.setInstallationReady(true);

      return {
        installation_ready: ready,
        backend_reachable: true,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check the public system.health action supported by the deployed GAS.
   * A healthy response with configured=false is reachable but NOT login-ready.
   */
  public async getStatus(): Promise<BootstrapStatus> {
    const backendUrl = this.getBackendUrl();
    if (!backendUrl) {
      return { installation_ready: false, backend_reachable: false };
    }

    // Prefer the same POST envelope used by the other application API calls.
    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'system.health', payload: {} }),
        redirect: 'follow',
      });
      if (response.ok) {
        const status = this.parseStatusResponse(await response.text());
        if (status) return status;
      }
    } catch {
      // A GET health probe is supported by GAS and can be tried below.
    }

    try {
      const separator = backendUrl.includes('?') ? '&' : '?';
      const response = await fetch(
        `${backendUrl}${separator}action=system.health`,
        { method: 'GET', redirect: 'follow' },
      );
      if (response.ok) {
        const status = this.parseStatusResponse(await response.text());
        if (status) return status;
      }
    } catch {
      // The backend could not be verified.
    }

    return { installation_ready: false, backend_reachable: false };
  }

  /**
   * Endpoint: bootstrap.initialize
   * Frontend never validates the production bootstrap token itself.
   */
  public async initialize(bootstrapToken: string): Promise<BootstrapInitResult> {
    const token = String(bootstrapToken || '').trim();

    if (!token) {
      return {
        success: false,
        error: {
          code: 'INVALID_BOOTSTRAP_TOKEN',
          message: 'Token bootstrap wajib diisi.',
        },
      };
    }

    const backendUrl = this.getBackendUrl();

    console.info('[bootstrap] initialize request start');
    console.info('[bootstrap] backend URL configured:', Boolean(backendUrl));

    if (!backendUrl) {
      return {
        success: false,
        error: {
          code: 'BACKEND_UNREACHABLE',
          message: 'Backend Google Apps Script belum dapat dijangkau.',
        },
      };
    }

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'bootstrap.initialize',
          payload: {
            bootstrap_token: token,
          },
        }),
        redirect: 'follow',
      });

      const text = await response.text();

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        return {
          success: false,
          error: {
            code: 'BACKEND_UNREACHABLE',
            message: 'Respons Google Apps Script bukan JSON yang valid.',
          },
        };
      }

      if (parsed?.ok && parsed?.data) {
        const data = parsed.data as BootstrapData;
        this.completeBootstrapSuccess(data);

        return {
          success: true,
          data,
        };
      }

      const errorCode =
        parsed?.error?.code ||
        (response.ok ? 'BOOTSTRAP_FAILED' : 'BACKEND_UNREACHABLE');

      const errorMessage =
        parsed?.error?.message ||
        (response.ok
          ? 'Inisialisasi awal belum berhasil.'
          : `Server backend merespons dengan HTTP ${response.status}.`);

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'BACKEND_UNREACHABLE',
          message:
            err?.message ||
            'Gagal terhubung ke backend Google Apps Script. Periksa koneksi jaringan.',
        },
      };
    }
  }

  /**
   * Cache/local installation metadata is hydrated only from a successful
   * authoritative GAS response. No installation/workspace/event ID is invented.
   */
  private completeBootstrapSuccess(data: BootstrapData): void {
    this.isReady = true;

    try {
      localStorage.setItem('siepang_bootstrap_ready', 'true');
      localStorage.removeItem('siepang_bootstrap_local_token');
      localStorage.removeItem('siepang_bootstrap_token_used');
    } catch {
      // Cache cleanup only.
    }

    const current = customerInstallationService.getInstallationRecord();

    customerInstallationService.updateInstallationRecord({
      installation_id:
        String(data?.installation_id || '').trim() ||
        String(current?.installation_id || '').trim(),
      workspace_id:
        String(data?.workspace_id || '').trim() ||
        String(current?.workspace_id || '').trim(),
      active_event_id:
        String(data?.event_id || '').trim() ||
        String(current?.active_event_id || '').trim(),
      web_app_url:
        String(current?.web_app_url || '').trim() || this.getBackendUrl(),
      installation_status: 'READY',
      bootstrap_superadmin_email: String(data?.superadmin?.email || '').trim(),
      bootstrap_superadmin_status: String(
        data?.superadmin?.status || 'ACTIVE',
      ).trim(),
    });
  }

  /**
   * Test-only local state reset.
   * Does not alter GAS Script Properties or production bootstrap state.
   */
  public resetForTest(): void {
    this.isReady = false;

    try {
      localStorage.removeItem('siepang_bootstrap_ready');
      localStorage.removeItem('siepang_bootstrap_token_used');
      localStorage.removeItem('siepang_bootstrap_local_token');
    } catch {
      // No-op in non-browser test environments.
    }
  }
}

export const bootstrapService = new BootstrapService();
