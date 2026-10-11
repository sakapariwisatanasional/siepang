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
  private clientVersion = '1.9.1';

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

  public async send<T = any>(
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

    const timeout = options?.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(envelope),
        signal: controller.signal,
        redirect: 'follow',
      });

      // Keep AbortController active until the redirected GAS response body is read.
      // A 200/302 header alone does not mean the request has finished.
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
        return {
          ok: false,
          request_id: requestId,
          data: null,
          error: {
            code: 'TIMEOUT',
            message: `Permintaan ke Google Apps Script melampaui batas waktu (${timeout / 1000} detik).`,
          },
        };
      }

      return {
        ok: false,
        request_id: requestId,
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: err?.message || 'Gagal terhubung ke Google Apps Script.',
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

      const separator = url.includes('?') ? '&' : '?';
      const getUrl = `${url}${separator}action=system.health&nonce=${encodeURIComponent(checkNonce)}`;

      const res = await fetch(getUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const json = await res.json();

      if (json.success || json.ok) {
        return { ok: true, data: json.data };
      }

      return {
        ok: false,
        error:
          json.error?.message ||
          json.error ||
          'Health check mengembalikan status gagal',
      };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.message || 'Koneksi ke backend Apps Script gagal',
      };
    }
  }
}

export const apiTransport = new ApiTransport();
