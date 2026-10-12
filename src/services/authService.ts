/**
 * @license
 * SiEpang - Auth & Session Service (Milestone v1.9.0-rc1)
 * Production Server-Authoritative Passwordless Email OTP & Trusted Device RBAC Manager.
 * No password entry. No Google Identity Services OAuth button.
 * First time: Email -> OTP -> Verified -> Trusted Device -> Session.
 * Next time: Auto-login on Trusted Device without repeated OTP.
 * Role assignment is 100% server-authoritative by SuperAdmin.
 */

import { User, UserRole, TrustedDeviceRecord } from '../types';
import { OfflineEmergencySession } from '../offline/types';
import { apiTransport } from './apiTransport';
import { generateSecureToken, generateDevicePublicId } from '../utils/cryptoSecurity';
import { userManagementService } from './userManagementService';
import { customerInstallationService } from './customerInstallationService';
import { bootstrapService } from './bootstrapService';

export type AuthenticationMode = 'CLOUD' | 'OFFLINE_EMERGENCY';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  role: UserRole;
  effectiveRoles: UserRole[];
  permissions: string[];
  authenticationMode: AuthenticationMode;
  offlineSession: OfflineEmergencySession | null;
  sessionToken: string | null;
  isTrustedDevice: boolean;
  isInitializing: boolean;
}

export interface StoredSessionPayload {
  session_token: string;
  user_id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  effective_roles: UserRole[];
  workspace_id: string;
  event_id?: string;
  expires_at: number;
}

export interface StoredDevicePayload {
  device_public_id: string;
  device_token: string;
  device_name: string;
  browser_family: string;
  platform: string;
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  superadmin: ['all', 'manage_workspaces', 'system_health', 'manage_events', 'audit_logs', 'manage_users', 'manage_branding'],
  workspace_admin: ['manage_workspace', 'manage_events', 'manage_participants', 'manage_contingents', 'manage_branding', 'manage_templates', 'manage_users'],
  event_admin: ['manage_events', 'manage_participants', 'manage_schedule', 'manage_competitions', 'view_reports'],
  kontingen_admin: ['view_contingent', 'submit_participants', 'view_schedule', 'view_qr'],
  registration_officer: ['verify_participant', 'check_in_participant', 'print_id_card'],
  participant: ['view_personal_qr', 'view_schedule', 'vote_digital', 'view_badges', 'give_peer_appreciation', 'view_leaderboard'],
  judge: ['score_competition', 'view_entries', 'lock_scores'],
  attendance_officer: ['scan_attendance', 'log_xp', 'view_attendance_stats'],
  health_officer: ['manage_health_incidents', 'view_medical_records', 'report_emergency'],
  logistic_officer: ['manage_inventory', 'issue_item', 'return_item'],
  viewer: ['view_public_data', 'view_leaderboard', 'view_gallery'],
  committee: ['scan_qr', 'award_points', 'view_schedule', 'broadcast_announcement'],
  ceremony_officer: ['view_ceremony_schedule', 'check_attendance_ceremony'],
  documentation_officer: ['manage_documentation', 'upload_photos', 'manage_videos', 'view_gallery'],
  publication_officer: ['manage_banners', 'manage_sponsors', 'manage_documentation', 'view_gallery'],
};

class AuthService {
  private currentUser: User | null = null;
  private effectiveRoles: UserRole[] = [];
  private authenticationMode: AuthenticationMode = 'CLOUD';
  private offlineSession: OfflineEmergencySession | null = null;
  private sessionToken: string | null = null;
  private sessionExpiresAt: number | null = null;
  private isTrustedDevice: boolean = false;
  private isInitializing: boolean = true;
  private localOtpChallenges = new Map<string, { email: string; otp: string; expiresAt: number }>();
  private listeners: Set<(state: AuthState) => void> = new Set();
  private pendingLoginOtpVerification: Promise<{ success: boolean; user?: User; error?: string }> | null = null;

  constructor() {
    this.initDeviceIdentity();
    this.restoreCachedSession();
  }

  /**
   * Generates or loads client-safe device identity (Zero invasive fingerprints)
   */
  public getOrCreateDevicePayload(): StoredDevicePayload {
    try {
      const stored = localStorage.getItem('siepang_trusted_device');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}

    // Derive safe friendly browser & platform
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    let browserFamily = 'Web Browser';
    if (ua.includes('Firefox')) browserFamily = 'Firefox';
    else if (ua.includes('Edg')) browserFamily = 'Edge';
    else if (ua.includes('Chrome')) browserFamily = 'Chrome';
    else if (ua.includes('Safari')) browserFamily = 'Safari';

    let platform = 'Perangkat Web';
    if (ua.includes('iPhone') || ua.includes('iPad')) platform = 'iOS';
    else if (ua.includes('Android')) platform = 'Android';
    else if (ua.includes('Mac OS')) platform = 'macOS';
    else if (ua.includes('Windows')) platform = 'Windows';
    else if (ua.includes('Linux')) platform = 'Linux';

    const devicePayload: StoredDevicePayload = {
      device_public_id: generateDevicePublicId(),
      device_token: generateSecureToken(32),
      device_name: `${browserFamily} · ${platform}`,
      browser_family: browserFamily,
      platform,
    };

    try {
      localStorage.setItem('siepang_trusted_device', JSON.stringify(devicePayload));
    } catch {}

    return devicePayload;
  }

  private initDeviceIdentity(): void {
    const dev = this.getOrCreateDevicePayload();
    this.isTrustedDevice = !!dev.device_public_id;
  }

  /**
   * Restores cached session for immediate display, then triggers background validation
   */
  private restoreCachedSession(): void {
    try {
      // 1. Emergency offline session check
      const storedEmergency = localStorage.getItem('siepang_emergency_session');
      if (storedEmergency) {
        const session: OfflineEmergencySession = JSON.parse(storedEmergency);
        if (new Date(session.expires_at).getTime() > Date.now()) {
          this.offlineSession = session;
          this.authenticationMode = 'OFFLINE_EMERGENCY';
          this.sessionToken = session.token;
          this.currentUser = {
            id: session.user_id,
            name: session.user_name,
            email: `${session.user_id}@buper.local`,
            avatar: '',
            role: session.role_id,
            workspaceId: session.workspace_id,
            eventId: session.event_id,
          };
          this.effectiveRoles = [session.role_id];
          this.isInitializing = false;
          return;
        } else {
          localStorage.removeItem('siepang_emergency_session');
        }
      }

      // 2. Standard persistent session check
      const storedAuth = localStorage.getItem('siepang_auth_session');
      if (storedAuth) {
        const payload: StoredSessionPayload = JSON.parse(storedAuth);
        if (payload.expires_at > Date.now()) {
          this.currentUser = {
            id: payload.user_id,
            name: payload.name,
            email: payload.email,
            avatar: payload.avatar || '',
            role: payload.role,
            workspaceId: payload.workspace_id,
            eventId: payload.event_id,
          };
          this.effectiveRoles = payload.effective_roles || [payload.role];
          this.sessionToken = payload.session_token;
          this.sessionExpiresAt = payload.expires_at;
          this.authenticationMode = 'CLOUD';
        } else {
          localStorage.removeItem('siepang_auth_session');
        }
      }
    } catch (e) {
      console.warn('Gagal membaca sesi lokal:', e);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Asynchronous startup session validation against customer GAS backend (Part 12 Auto-Login)
   */
  public async validateCurrentSession(): Promise<{ valid: boolean; user?: User; error?: string }> {
    if (!this.sessionToken) {
      this.isInitializing = false;
      this.notify();
      return { valid: false };
    }

    const device = this.getOrCreateDevicePayload();
    try {
      const response = await apiTransport.send('auth.session.validate', {
        session_token: this.sessionToken,
        device_public_id: device.device_public_id,
        device_token: device.device_token,
      });

      if (!response.ok || !response.data) {
        const errCode = response.error?.code || 'SESSION_INVALID';
        if (errCode === 'SESSION_INVALID' || errCode === 'SESSION_EXPIRED' || errCode === 'DEVICE_REVOKED' || errCode === 'ACCOUNT_DISABLED') {
          this.logout(false);
        }
        this.isInitializing = false;
        this.notify();
        return { valid: false, error: response.error?.message || 'Sesi tidak valid.' };
      }

      const data = response.data;
      const user: User = {
        id: data.user_id,
        name: data.display_name || 'Pengguna Pramuka',
        email: data.email,
        avatar: data.avatar || '',
        role: data.role as UserRole,
        workspaceId: data.workspace_id,
        eventId: data.event_id,
      };

      const payload: StoredSessionPayload = {
        session_token: this.sessionToken,
        user_id: user.id,
        name: user.name,
        avatar: user.avatar,
        email: user.email,
        role: user.role,
        effective_roles: (data.effective_roles as UserRole[]) || [user.role],
        workspace_id: user.workspaceId,
        event_id: user.eventId,
        expires_at: data.session_expires_at || (Date.now() + 60 * 24 * 60 * 60 * 1000),
      };

      localStorage.setItem('siepang_auth_session', JSON.stringify(payload));

      this.currentUser = user;
      this.effectiveRoles = (data.effective_roles as UserRole[]) || [user.role];
      this.sessionExpiresAt = payload.expires_at;
      this.isTrustedDevice = true;
      this.isInitializing = false;

      this.notify();
      return { valid: true, user };
    } catch (err: any) {
      // In offline conditions, if local session is unexpired, allow session continuation
      if (this.currentUser && this.sessionExpiresAt && this.sessionExpiresAt > Date.now()) {
        this.isInitializing = false;
        this.notify();
        return { valid: true, user: this.currentUser };
      }
      this.isInitializing = false;
      this.notify();
      return { valid: false, error: err.message };
    }
  }

  // =========================================================================
  // PASSWORDLESS EMAIL OTP AUTHENTICATION FLOWS (PARTS 4 - 15)
  // =========================================================================

  /**
   * Request OTP for New Registration
   */
  public async requestRegisterOtp(
    name: string,
    email: string
  ): Promise<{ success: boolean; challengeId?: string; message?: string; error?: string; devOtp?: string }> {
    const backendUrl = bootstrapService.getBackendUrl();

    if (!backendUrl) {
      return {
        success: false,
        error: 'Sistem autentikasi belum tersedia. Backend belum dapat dijangkau.',
      };
    }

    try {
      const res = await apiTransport.send('auth.register.requestOtp', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
      }, {
        timeoutMs: 60000,
        skipAuth: true,
        overrideUrl: backendUrl,
      });

      if (!res.ok || !res.data) {
        if (
          res.error?.code === 'INSTALLATION_NOT_CONFIGURED' ||
          res.error?.code === 'DATABASE_NOT_CONFIGURED' ||
          res.error?.code === 'NETWORK_ERROR' ||
          res.error?.code === 'TIMEOUT'
        ) {
          return {
            success: false,
            error: 'Sistem autentikasi belum tersedia. Silakan coba kembali setelah administrator menyelesaikan konfigurasi.',
          };
        }
        return {
          success: false,
          error: res.error?.message || 'Gagal mengirim kode verifikasi.',
        };
      }

      return {
        success: true,
        challengeId: res.data.challenge_id,
        message: res.data.message || `Kode verifikasi telah dikirim ke ${email}.`,
        devOtp: res.data.dev_otp,
      };
    } catch {
      return {
        success: false,
        error: 'Sistem autentikasi belum tersedia. Silakan coba kembali setelah administrator menyelesaikan konfigurasi.',
      };
    }
  }

  /**
   * Verify Registration OTP & Bind Trusted Device
   */
  public async verifyRegisterOtp(params: {
    challengeId: string;
    email: string;
    otp: string;
    name: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const device = this.getOrCreateDevicePayload();
    const backendUrl = bootstrapService.getBackendUrl();
    if (!backendUrl) {
      return { success: false, error: 'Backend Google Apps Script belum dapat dijangkau.' };
    }

    try {
      const res = await apiTransport.send('auth.register.verifyOtp', {
        challenge_id: params.challengeId,
        email: params.email.trim().toLowerCase(),
        otp: params.otp.trim(),
        name: params.name.trim(),
        device_public_id: device.device_public_id,
        device_token: device.device_token,
        device_name: device.device_name,
        browser_family: device.browser_family,
        platform: device.platform,
      }, {
        timeoutMs: 60000,
        skipAuth: true,
        overrideUrl: backendUrl,
      });

      if (!res.ok || !res.data) {
        return {
          success: false,
          error: res.error?.message || 'Verifikasi kode gagal.',
        };
      }

      return this.handleAuthSuccess(res.data);
    } catch {
      return {
        success: false,
        error: 'Sistem autentikasi belum tersedia. Silakan coba kembali setelah administrator menyelesaikan konfigurasi.',
      };
    }
  }

  /**
   * Request OTP for Existing User Login (e.g., when on a new device or session expired)
   * Strictly Passwordless: Email -> 6-digit OTP (Requirements 34, 35)
   */
  public async requestLoginOtp(
    email: string
  ): Promise<{
    success: boolean;
    authenticated?: boolean;
    user?: User;
    challengeId?: string;
    message?: string;
    error?: string;
    devOtp?: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return {
        success: false,
        error: 'Format alamat email tidak valid.',
      };
    }

    const backendUrl = bootstrapService.getBackendUrl();
    if (!backendUrl) {
      return {
        success: false,
        error: 'Sistem autentikasi belum tersedia. Backend belum dapat dijangkau.',
      };
    }

    try {
      const device = this.getOrCreateDevicePayload();

      const res = await apiTransport.send<any>(
        'auth.login.requestOtp',
        {
          email: cleanEmail,
          device_public_id: device.device_public_id,
          device_token: device.device_token,
          device_name: device.device_name,
          browser_family: device.browser_family,
          platform: device.platform,
        },
        {
          timeoutMs: 60000,
          skipAuth: true,
          overrideUrl: backendUrl,
        }
      );

      if (!res.ok || !res.data) {
        return {
          success: false,
          error: res.error?.message || 'Gagal mengirim kode verifikasi.',
        };
      }

      if ((res.data as any).authenticated === true && (res.data as any).session_token) {
        const loginResult = this.handleAuthSuccess(res.data);
        if (!loginResult.success) {
          return { success: false, error: loginResult.error || 'Sesi perangkat tepercaya tidak lengkap.' };
        }
        return {
          success: true,
          authenticated: true,
          user: loginResult.user,
          message: 'Perangkat tepercaya dikenali. Anda berhasil masuk tanpa OTP.',
        };
      }

      const challengeId = String(
        (res.data as any).challenge_id ??
        (res.data as any).challengeId ??
        ''
      ).trim();

      if (!challengeId) {
        return {
          success: false,
          error: 'Kode berhasil diproses, tetapi ID verifikasi tidak diterima dari server.',
        };
      }

      return {
        success: true,
        challengeId,
        message:
          (res.data as any).message ||
          `Kode verifikasi telah dikirim ke ${cleanEmail}.`,
        devOtp: import.meta.env.PROD ? undefined : (res.data as any).dev_otp,
      };
    } catch (e: any) {
      return {
        success: false,
        error:
          e?.message ||
          'Layanan login SiEpang belum dapat dihubungi. Coba lagi beberapa saat.',
      };
    }
  }

  /**
   * Verify Login OTP & Register Device as Trusted
   * Strictly Passwordless: OTP Verification -> Trusted Device -> Session (Requirements 34, 35)
   */
  public async verifyLoginOtp(params: {
    challengeId: string;
    email: string;
    otp: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    // A single in-flight request per AuthService instance prevents accidental
    // double consumption of a one-time code (including simultaneous callers).
    if (this.pendingLoginOtpVerification) {
      return this.pendingLoginOtpVerification;
    }

    const task = this.performLoginOtpVerification(params);
    this.pendingLoginOtpVerification = task;
    try {
      return await task;
    } finally {
      this.pendingLoginOtpVerification = null;
    }
  }

  private async performLoginOtpVerification(params: {
    challengeId: string;
    email: string;
    otp: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanOtp = params.otp.trim();
    const cleanChallengeId = params.challengeId.trim();

    if (!cleanChallengeId) {
      return { success: false, error: 'ID verifikasi tidak tersedia. Silakan minta kode OTP baru.' };
    }
    if (!/^\d{6}$/.test(cleanOtp)) {
      return { success: false, error: 'Masukkan 6 digit kode verifikasi.' };
    }

    const backendUrl = bootstrapService.getBackendUrl();
    if (!backendUrl) {
      return { success: false, error: 'URL backend Google Apps Script belum tersedia.' };
    }

    // Never automatically retry an OTP verification on a network error:
    // GAS may already have consumed the one-time code.
    try {
      const device = this.getOrCreateDevicePayload();
      const res = await apiTransport.send<any>(
        'auth.login.verifyOtp',
        {
          challenge_id: cleanChallengeId,
          email: cleanEmail,
          otp: cleanOtp,
          device_public_id: device.device_public_id,
          device_token: device.device_token,
          device_name: device.device_name,
          browser_family: device.browser_family,
          platform: device.platform,
        },
        { timeoutMs: 60000, skipAuth: true, overrideUrl: backendUrl }
      );

      if (!res.ok || !res.data) {
        const code = String(res.error?.code || '');
        if (code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code.startsWith('HTTP_') || code === 'INVALID_JSON_RESPONSE') {
          return {
            success: false,
            error: 'Respons verifikasi dari GAS tidak diterima (' + (code || 'jaringan') + '). Kode mungkin sudah diproses. Jangan tekan Verifikasi berulang; periksa apakah sesi telah aktif dengan membuka ulang SiEpang. Jika belum masuk, minta OTP baru.',
          };
        }
        return { success: false, error: res.error?.message || 'Verifikasi kode gagal.' };
      }

      return this.handleAuthSuccess(res.data);
    } catch (e: any) {
      return {
        success: false,
        error: 'Proses verifikasi tidak selesai: ' + (e?.message || 'kesalahan tidak diketahui') + '. Jangan kirim OTP yang sama berulang kali.',
      };
    }
  }

  /**
   * Stores session context and triggers reactive update upon successful authentication
   */
  private handleAuthSuccess(sessionData: any): { success: boolean; user?: User; error?: string } {
    // A backend success flag alone is insufficient to authenticate a user.
    // Require a real session token and a server-assigned identity/role.
    if (
      !sessionData ||
      typeof sessionData.session_token !== 'string' ||
      !sessionData.session_token.trim() ||
      typeof sessionData.user_id !== 'string' ||
      !sessionData.user_id.trim() ||
      typeof sessionData.email !== 'string' ||
      !sessionData.email.trim() ||
      typeof sessionData.role !== 'string' ||
      !sessionData.role.trim()
    ) {
      return {
        success: false,
        error: 'GAS melaporkan berhasil, tetapi data sesi login tidak lengkap. Periksa respons auth.login.verifyOtp dan versi deployment GAS.',
      };
    }

    const user: User = {
      id: sessionData.user_id,
      name: sessionData.display_name || 'Pengguna Pramuka',
      email: sessionData.email,
      avatar: sessionData.avatar || '',
      role: sessionData.role as UserRole,
      workspaceId: sessionData.workspace_id,
      eventId: sessionData.event_id,
    };

    const rawExpiry = sessionData.session_expires_at;
    const parsedExpiry = typeof rawExpiry === 'number'
      ? rawExpiry
      : typeof rawExpiry === 'string'
        ? (Number(rawExpiry) || Date.parse(rawExpiry))
        : NaN;
    const expiresAt = Number.isFinite(parsedExpiry) && parsedExpiry > Date.now()
      ? parsedExpiry
      : Date.now() + 60 * 24 * 60 * 60 * 1000;

    const payload: StoredSessionPayload = {
      session_token: sessionData.session_token,
      user_id: user.id,
      name: user.name,
      avatar: user.avatar,
      email: user.email,
      role: user.role,
      effective_roles: (Array.isArray(sessionData.effective_roles) && sessionData.effective_roles.length
        ? sessionData.effective_roles as UserRole[]
        : [user.role]),
      workspace_id: user.workspaceId,
      event_id: user.eventId,
      expires_at: expiresAt,
    };

    // Persist first, then publish an authenticated state to the UI.
    try {
      localStorage.setItem('siepang_auth_session', JSON.stringify(payload));
    } catch {
      return {
        success: false,
        error: 'Sesi sudah diberikan oleh GAS, tetapi browser tidak dapat menyimpannya. Periksa izin penyimpanan situs pada browser.',
      };
    }

    this.currentUser = user;
    this.effectiveRoles = payload.effective_roles;
    this.sessionToken = payload.session_token;
    this.sessionExpiresAt = payload.expires_at;
    this.authenticationMode = 'CLOUD';
    this.offlineSession = null;
    this.isTrustedDevice = true;

    this.notify();
    return { success: true, user };
  }

  /**
   * One-time Idempotent SuperAdmin Bootstrap
   */
  public async bootstrapSuperAdmin(): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const res = await apiTransport.send('auth.bootstrapSuperAdmin', {});
      if (!res.ok) {
        return {
          success: false,
          message: res.error?.message || 'Bootstrap SuperAdmin gagal.',
          error: res.error?.code,
        };
      }
      return {
        success: true,
        message: 'SuperAdmin berhasil di-bootstrap secara server-authoritative.',
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Gagal mengeksekusi bootstrap.',
      };
    }
  }

  /**
   * Switch between authorized assigned roles for the currently logged in user
   */
  public switchAssignedRole(role: UserRole): boolean {
    if (!this.currentUser) return false;
    if (!this.effectiveRoles.includes(role)) {
      console.warn(`User tidak memiliki penugasan peran: ${role}`);
      return false;
    }

    this.currentUser.role = role;
    const stored = localStorage.getItem('siepang_auth_session');
    if (stored) {
      const payload: StoredSessionPayload = JSON.parse(stored);
      payload.role = role;
      localStorage.setItem('siepang_auth_session', JSON.stringify(payload));
    }

    this.notify();
    return true;
  }


  // =========================================================================
  // DEVICE & LOGOUT ACTIONS (PARTS 21 - 25)
  // =========================================================================

  /**
   * List trusted devices for current user
   */
  public async listTrustedDevices(): Promise<TrustedDeviceRecord[]> {
    if (!this.currentUser) return [];
    const device = this.getOrCreateDevicePayload();
    try {
      const res = await apiTransport.send<TrustedDeviceRecord[]>('auth.devices.list', {
        user_id: this.currentUser.id,
        current_device_public_id: device.device_public_id,
      });
      return res.ok && Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Revoke a specific trusted device
   */
  public async revokeDevice(devicePublicId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await apiTransport.send('auth.devices.revoke', {
        device_public_id: devicePublicId,
      });
      if (!res.ok) {
        return { success: false, error: res.error?.message || 'Gagal mencabut akses perangkat.' };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Gagal menghubungi server.' };
    }
  }

  /**
   * Logout from all devices
   */
  public async logoutAll(): Promise<void> {
    if (this.currentUser) {
      try {
        await apiTransport.send('auth.logoutAll', {
          user_id: this.currentUser.id,
        });
      } catch {}
    }
    this.logout(true);
  }

  /**
   * Logout (Standard vs Forget Device, Part 24)
   * forgetDevice = true: revokes session AND trusted device record.
   * forgetDevice = false: revokes current session only.
   */
  public logout(forgetDevice = false): void {
    const token = this.sessionToken;
    if (token) {
      apiTransport.send('auth.logout', {
        session_token: token,
        forget_device: forgetDevice,
      }).catch(() => {});
    }

    this.currentUser = null;
    this.effectiveRoles = [];
    this.sessionToken = null;
    this.sessionExpiresAt = null;
    this.offlineSession = null;
    this.authenticationMode = 'CLOUD';

    localStorage.removeItem('siepang_auth_session');
    localStorage.removeItem('siepang_emergency_session');

    if (forgetDevice) {
      localStorage.removeItem('siepang_trusted_device');
      this.isTrustedDevice = false;
    }

    sessionStorage.clear();
    this.notify();
  }

  public loginOfflineEmergency(session: any): void {
    if (!session) return;
    this.currentUser = {
      id: session.userId || session.user_id || 'offline_officer',
      name: session.userName || session.user_name || 'Petugas Lapangan (Offline)',
      role: session.role || 'committee',
      email: session.email || 'offline.officer@siepang.lan',
      avatar: '',
      workspaceId: session.workspaceId || '',
      eventId: session.eventId || '',
    };
    this.effectiveRoles = [this.currentUser.role];
    this.authenticationMode = 'OFFLINE_EMERGENCY';
    this.offlineSession = session;
    this.sessionExpiresAt = Date.now() + 4 * 60 * 60 * 1000;
    try {
      localStorage.setItem('siepang_emergency_session', JSON.stringify(session));
    } catch {}
    this.notify();
  }

  public logoutOfflineEmergency(): void {
    this.logout(false);
  }

  /** Refresh the current user's display profile only after GAS confirms persistence. */
  public applyConfirmedProfile(profile: { name: string; avatar?: string }): void {
    if (!this.currentUser || this.authenticationMode !== 'CLOUD') return;
    this.currentUser = { ...this.currentUser, name: profile.name, avatar: profile.avatar || '' };
    try {
      const raw = localStorage.getItem('siepang_auth_session');
      if (raw) {
        const stored: StoredSessionPayload = JSON.parse(raw);
        if (stored.user_id === this.currentUser.id) {
          stored.name = profile.name;
          stored.avatar = profile.avatar || '';
          localStorage.setItem('siepang_auth_session', JSON.stringify(stored));
        }
      }
    } catch { /* Auth state is still updated from the confirmed GAS response. */ }
    this.notify();
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    if (!this.currentUser) return false;
    if (this.sessionExpiresAt && this.sessionExpiresAt < Date.now()) {
      this.logout(false);
      return false;
    }
    return true;
  }

  public getAuthState(): AuthState {
    const isAuth = this.isAuthenticated();
    const effectiveRole: UserRole = isAuth && this.currentUser ? this.currentUser.role : 'viewer';

    const permissions =
      this.authenticationMode === 'OFFLINE_EMERGENCY' && this.offlineSession
        ? this.offlineSession.permission_snapshot
        : ROLE_PERMISSIONS[effectiveRole] || [];

    return {
      user: this.currentUser,
      isAuthenticated: isAuth,
      role: effectiveRole,
      effectiveRoles: this.effectiveRoles.length > 0 ? this.effectiveRoles : [effectiveRole],
      permissions,
      authenticationMode: this.authenticationMode,
      offlineSession: this.offlineSession,
      sessionToken: this.sessionToken,
      isTrustedDevice: this.isTrustedDevice,
      isInitializing: this.isInitializing,
    };
  }

  public hasPermission(permission: string): boolean {
    const permissions = this.getAuthState().permissions;
    return permissions.includes('all') || permissions.includes(permission);
  }

  public subscribe(cb: (state: AuthState) => void) {
    this.listeners.add(cb);
    cb(this.getAuthState());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    const state = this.getAuthState();
    this.listeners.forEach(cb => cb(state));
  }
}

export const authService = new AuthService();
export { ROLE_PERMISSIONS };
