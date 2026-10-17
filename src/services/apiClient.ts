/**
 * @license
 * SiEpang - Centralized API Client Abstraction
 * Frontend never accesses Google Spreadsheets or databases directly;
 * all communication goes through this service layer into the SiEpang Backend API
 * and customer-owned Google Apps Script Web App over HTTPS.
 */

import { syncQueue } from '../offline/syncQueue';
import { siepangBackendApi } from '../backend/api/siepangBackendApi';
import { localCampServerService } from './localCampServerService';
import { authService } from './authService';
import { workspaceService } from './workspaceService';
import { eventService } from './eventService';
import { apiTransport } from './apiTransport';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;

  error?: {
    code: string;
    message: string;
    details?: unknown;
  } | any;

  meta?: {
    requestId?: string;
    timestamp?: string;
    syncVersion?: number;
    idempotency?: string;
    edgeNodeId?: string;
    operationalMode?: 'cloud' | 'local' | 'hybrid';
  };

  message?: string;
  statusCode?: number;
  source?: 'cloud' | 'local_server' | 'offline_queue' | 'cache';
}

class ApiClient {
  /**
   * Translates legacy endpoints to canonical action names
   */
  private endpointToAction(endpoint: string): string {
    const clean = endpoint.replace(/^\/api\//, '');
    const map: Record<string, string> = {
      'system/health': 'system.health',
      'events/get': 'events.get',
      'events/update': 'events.update',
      'events/list': 'events.list',
      'participants/list': 'participants.list',
      'participants/checkin': 'participants.checkin',
      'users/list': 'users.list',
      'users/create': 'users.create',
      'users/assignRole': 'users.assignRole',
      'auth/google': 'auth.google',
      'auth/bootstrapSuperAdmin': 'auth.bootstrapSuperAdmin',
      'points/transact': 'points.transact',
      'database/provision_schema_v16': 'database.provision_schema_v19',
      'database/provision_schema_v19': 'database.provision_schema_v19',
      'bootstrap/status': 'bootstrap.status',
      'bootstrap/initialize': 'bootstrap.initialize',
    };
    return map[clean] || clean.replace(/\//g, '.');
  }

  public async request<T>(endpoint: string, options?: { data?: any; useCache?: boolean }): Promise<ApiResponse<T>> {
    const isOffline = typeof syncQueue !== 'undefined' && syncQueue?.getConnectionState ? syncQueue.getConnectionState() === 'offline' : false;
    const operationalMode = localCampServerService.getOperationalMode();
    const serverConfig = localCampServerService.getConfig();

    // Build Request Security Context
    const currentUser = authService.getCurrentUser();
    const localSession = localCampServerService.getLocalSession();
    const currentWorkspace = workspaceService.getCurrentWorkspace();
    const currentEvent = eventService.getCurrentEvent();

    const securityContext = {
      userId: currentUser?.id || '',
      userRole: currentUser?.role || 'viewer',
      workspaceId: currentWorkspace?.id || null,
      eventId: currentEvent?.id || null,
      authToken: authService.getAuthState().sessionToken || '',
    };

    // Strict production policy: all application data requests go directly through GAS.
    // No offline queue, local edge server, browser cache, or hybrid response may be reported as authoritative.
    if (isOffline) {
      return {
        success: false,
        error: { code: 'GAS_UNAVAILABLE_OFFLINE', message: 'Koneksi internet/GAS tidak tersedia. Data belum dibaca atau disimpan; coba kembali saat online.' },
        message: 'Operasi dibatalkan agar tidak menghasilkan status sukses dari penyimpanan lokal.',
        statusCode: 503,
        source: 'cloud',
        meta: { requestId: `req_gas_offline_${Date.now()}`, timestamp: new Date().toISOString(), operationalMode: 'cloud' },
      };
    }

    // 4. CLOUD MODE: Real Network Requests via ApiTransport over HTTPS to Customer GAS Web App
    const action = this.endpointToAction(endpoint);
    const transportRes = await apiTransport.send<T>(action, options?.data);

    if (!transportRes.ok) {
      const errCode = transportRes.error?.code || 'REQUEST_FAILED';
      const errMsg = transportRes.error?.message || 'Operasi cloud gagal.';

      return {
        data: undefined,
        success: false,
        error: transportRes.error || { code: errCode, message: errMsg },
        message: errMsg,
        statusCode: 400,
        source: 'cloud',
        meta: {
          requestId: transportRes.request_id,
          timestamp: new Date().toISOString(),
          operationalMode: 'cloud',
        },
      };
    }

    return {
      data: transportRes.data as T,
      success: true,
      statusCode: 200,
      source: 'cloud',
      meta: {
        requestId: transportRes.request_id,
        timestamp: new Date().toISOString(),
        operationalMode: 'cloud',
      },
    };
  }
}

export const apiClient = new ApiClient();
