/**
 * @license
 * SiEpang - Production API Transport Layer
 *
 * Customer-owned Google Apps Script Web App transport.
 * Zero mock/fallback production backend.
 * Avoids circular import with authService.
 */

import { SIEPANG_BACKEND_URL } from '../config/backend';
import { customerInstallationService } from './customerInstallationService';
import { workspaceService } from './workspaceService';
import { eventService } from './eventService';

export interface ApiRequestEnvelope<T = any> {
  action: string;
  installation_id?: string | null;
  workspace_id?: string | null;
  event_id?: string | null;
  session_token: string;
  request_id: string;
  client_version: string;
  timestamp?: string;
  context?: {
    workspace_id: string | null;
    event_id: string | null;
    session_token: string | null;
    device_public_id: string | null;
    installation_id?: string | null;
  };
  payload: T;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponseEnvelope<T = any> {
  ok: boolean;
  request_id: string;
  data: T | null;
  error: ApiErrorPayload | null;
}

export class ApiTransportError extends Error {
  public code: string;
  public details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiTransportError';
    this.code = code;
    this.details = details;
  }
}

interface StoredAuthContext {
  sessionToken: string | null;
  devicePublicId: string | null;
}

class ApiTransport {
  private defaultTimeoutMs = 20000;
  // Same-origin Vercel serverless proxy; GAS remains the authoritative backend.
  private readonly proxyUrl = '/api/gas-proxy';
  private clientVersion = '1.9.1';
  // Hanya berbagi permintaan baca peserta yang masih berlangsung. Tidak menyimpan cache permanen.
  private participantListInFlight = new Map<string, Promise<ApiResponseEnvelope<any>>>();

  private resolveBackendUrl(overrideUrl?: string): string {
    if (overrideUrl?.trim()) return overrideUrl.trim();

    const envUrl = (import.meta as any).env?.VITE_SIEPANG_BACKEND_URL;
    if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim();

    const record = customerInstallationService.getInstallationRecord();
    if (typeof record?.web_app_url === 'string' && record.web_app_url.trim()) {
      return record.web_app_url.trim();
    }

    return SIEPANG_BACKEND_URL.trim();
  }

  private readStoredAuthContext(): StoredAuthContext {
    let sessionToken: string | null = null;
    let devicePublicId: string | null = null;

    try {
      const storedSession = localStorage.getItem('siepang_auth_session');
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        if (typeof parsed?.session_token === 'string' && parsed.session_token.trim()) {
          sessionToken = parsed.session_token.trim();
        }
      }
    } catch {}

    try {
      const storedDevice = localStorage.getItem('siepang_trusted_device');
      if (storedDevice) {
        const parsed = JSON.parse(storedDevice);
        if (
          typeof parsed?.device_public_id === 'string' &&
          parsed.device_public_id.trim()
        ) {
          devicePublicId = parsed.device_public_id.trim();
        }
      }
    } catch {}

    return { sessionToken, devicePublicId };
  }

  public send<T = any>(
    action: string,
    payload: any = {},
    options?: {
      timeoutMs?: number;
      overrideUrl?: string;
      overrideInstallationId?: string;
      overrideWorkspaceId?: string;
      skipAuth?: boolean;
    }
  ): Promise<ApiResponseEnvelope<T>> {
    // Jangan menggabungkan operasi tulis, autentikasi, maupun pembacaan yang berparameter.
    if (action !== 'participants.list' ||
        !payload || typeof payload !== 'object' || Array.isArray(payload) ||
        Object.keys(payload).length > 0) {
      return this.sendOnce<T>(action, payload, options);
    }
    const record = customerInstallationService.getInstallationRecord();
    const storedAuth = this.readStoredAuthContext();
    const key = JSON.stringify({
      action,
      url: this.resolveBackendUrl(options?.overrideUrl),
      workspace: options?.overrideWorkspaceId || workspaceService.getCurrentWorkspace()?.id || record.workspace_id || null,
      event: eventService.getCurrentEvent()?.id || record.active_event_id || null,
      installation: options?.overrideInstallationId || record.installation_id || null,
      session: options?.skipAuth ? '' : storedAuth.sessionToken || '',
      timeout: options?.timeoutMs ?? this.defaultTimeoutMs,
    });
    const existing = this.participantListInFlight.get(key);
    if (existing) return existing as Promise<ApiResponseEnvelope<T>>;
    const pending = this.sendOnce<T>(action, payload, options);
    this.participantListInFlight.set(key, pending);
    // Bersihkan hasil sukses maupun gagal; refresh berikutnya harus mengambil data terbaru.
    // Use then(success, failure) instead of a discarded finally() promise.
    void pending.then(
      () => { if (this.participantListInFlight.get(key) === pending) this.participantListInFlight.delete(key); },
      () => { if (this.participantListInFlight.get(key) === pending) this.participantListInFlight.delete(key); },
    );
    return pending;
  }

  private async sendOnce<T = any>(
    action: string,
    payload: any = {},
    options?: {
      timeoutMs?: number;
      overrideUrl?: string;
      overrideInstallationId?: string;
      overrideWorkspaceId?: string;
      skipAuth?: boolean;
    }
  ): Promise<ApiResponseEnvelope<T>> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record = customerInstallationService.getInstallationRecord();
    const targetUrl = this.resolveBackendUrl(options?.overrideUrl);

    if (!targetUrl || !targetUrl.startsWith('https://script.google.com/macros/s/')) {
      return {
        ok: false,
        request_id: requestId,
        data: null,
        error: {
          code: 'INSTALLATION_NOT_CONFIGURED',
          message: 'Backend Google Apps Script belum dikonfigurasi.',
        },
      };
    }

    const currentWorkspace = workspaceService.getCurrentWorkspace();
    const currentEvent = eventService.getCurrentEvent();
    const storedAuth = this.readStoredAuthContext();

    const resolvedInstId =
      options?.overrideInstallationId || record.installation_id || null;
    const resolvedWsId =
      options?.overrideWorkspaceId ||
      currentWorkspace?.id ||
      record.workspace_id ||
      null;
    const resolvedEvtId =
      currentEvent?.id || record.active_event_id || null;

    const sessionToken = options?.skipAuth ? '' : storedAuth.sessionToken || '';

    const envelope: ApiRequestEnvelope = {
      action,
      payload,
      context: {
        workspace_id: resolvedWsId,
        event_id: resolvedEvtId,
        session_token: sessionToken || null,
        device_public_id: storedAuth.devicePublicId,
        installation_id: resolvedInstId,
      },
      installation_id: resolvedInstId,
      workspace_id: resolvedWsId,
      event_id: resolvedEvtId,
      session_token: sessionToken,
      request_id: requestId,
      client_version: this.clientVersion,
      timestamp: new Date().toISOString(),
    };

    // Beri waktu lebih panjang hanya untuk pembacaan daftar peserta.
    // Jangan ubah batas waktu operasi tulis, OTP, maupun tindakan QR.
    const timeout = options?.timeoutMs ?? (action === 'participants.list' ? 45000 : this.defaultTimeoutMs);
    const requestStartedAt = Date.now();
    let requestStage: 'fetch' | 'body' = 'fetch';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // POST must go to our own Vercel origin to avoid browser-to-GAS CORS errors.
      // The server-side proxy owns the upstream GAS URL.
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: JSON.stringify(envelope),
        signal: controller.signal,
        redirect: 'follow',
        credentials: 'same-origin',
        cache: 'no-store',
      });

      // Keep AbortController active until the redirected GAS response body is read.
      // A 200/302 header alone does not mean the request has finished.
      requestStage = 'body';
      const text = await response.text();
      clearTimeout(timeoutId);

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {}

      if (!response.ok) {
        return {
          ok: false,
          request_id: requestId,
          data: null,
          error: {
            code: parsed?.error?.code || `HTTP_${response.status}`,
            message:
              parsed?.error?.message ||
              `Server backend merespons dengan kode status HTTP ${response.status}.`,
            details: parsed?.error?.details,
          },
        };
      }

      if (!parsed) {
        return {
          ok: false,
          request_id: requestId,
          data: null,
          error: {
            code: 'INVALID_JSON_RESPONSE',
            message: 'Respons dari Google Apps Script bukan format JSON yang valid.',
            details: text.slice(0, 200),
          },
        };
      }

      if (typeof parsed.ok === 'boolean') {
        return {
          ok: parsed.ok,
          request_id: parsed.request_id || requestId,
          data: parsed.data ?? null,
          error: parsed.error || null,
        };
      }

      if (typeof parsed.success === 'boolean') {
        return {
          ok: parsed.success,
          request_id: parsed.request_id || requestId,
          data: parsed.data ?? null,
          error: parsed.success
            ? null
            : {
                code:
                  typeof parsed.error === 'object' && parsed.error?.code
                    ? parsed.error.code
                    : 'BACKEND_ERROR',
                message:
                  typeof parsed.error === 'object' && parsed.error?.message
                    ? parsed.error.message
                    : String(parsed.error || 'Operasi backend gagal.'),
              },
        };
      }

      // A successful HTTP response is NOT proof of database persistence.
      // Only a backend envelope with an explicit success flag is accepted.
      // Otherwise HTML, legacy responses, or unexpected JSON must fail closed.
      return {
        ok: false,
        request_id: requestId,
        data: null,
        error: {
          code: 'INVALID_BACKEND_ENVELOPE',
          message: 'Respons GAS tidak memuat status ok/success. Penyimpanan belum dapat dikonfirmasi. Periksa URL dan versi deployment GAS.',
          details: {
            action,
            responseKeys: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).slice(0, 15) : [],
          },
        },
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err?.name === 'AbortError') {
        if (action === 'participants.list') {
          console.warn('[SiEpang] participants.list timeout', { request_id: requestId, stage: requestStage, elapsed_ms: Date.now() - requestStartedAt });
        }
        return {
          ok: false,
          request_id: requestId,
          data: null,
          error: {
            code: 'TIMEOUT',
            message: `Permintaan melalui proxy GAS melampaui batas waktu (${timeout / 1000} detik). Periksa status di GAS sebelum mencoba kembali.`,
            details: { action, stage: requestStage, elapsed_ms: Date.now() - requestStartedAt },
          },
        };
      }

      if (action === 'participants.list') {
        console.warn('[SiEpang] participants.list network error', { request_id: requestId, stage: requestStage, elapsed_ms: Date.now() - requestStartedAt, error: String(err) });
      }
      return {
        ok: false,
        request_id: requestId,
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: err?.message || 'Gagal menghubungi proxy GAS SiEpang.',
          details: String(err),
        },
      };
    }
  }

  public async checkHealth(
    url: string,
    nonce?: string
  ): Promise<{ ok: boolean; data?: any; error?: string }> {
    const checkNonce =
      nonce || `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      const postRes = await this.send(
        'system.health',
        { nonce: checkNonce },
        {
          overrideUrl: url,
          timeoutMs: 12000,
          skipAuth: true,
        }
      );

      if (postRes.ok && postRes.data) {
        return { ok: true, data: postRes.data };
      }

      // Do not silently fall back to cross-origin GET: a passing GET health
      // does not prove that our POST proxy is working.
      return { ok: false, error: postRes.error?.message || 'Pemeriksaan kesehatan melalui proxy gagal.' };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.message || 'Koneksi ke backend Apps Script gagal',
      };
    }
  }
}

export const apiTransport = new ApiTransport();
