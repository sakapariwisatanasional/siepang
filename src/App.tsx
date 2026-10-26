/**
 * @license
 * SiEpang - Sistem Informasi Perkemahan Pramuka
 * Main Application Orchestrator
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from './app/layout/AppLayout';
import { NavTab } from './components/navigation/MobileNavigation';
import { authService } from './services/authService';
import { RoleHomeRouter } from './features/home/RoleHomeRouter';
import { ParticipantHome } from './features/participants/ParticipantHome';
import { AdminDaerahDashboard } from './features/workspace/AdminDaerahDashboard';
import { SuperAdminDashboard } from './features/superadmin/SuperAdminDashboard';
import { EventSchedule } from './features/events/EventSchedule';
import { ParticipantList } from './features/participants/ParticipantList';
import { ContingentReguDirectory } from './features/participants/ContingentReguDirectory';
import { CompetitionList } from './features/competitions/CompetitionList';
import { JudgeScoringInterface } from './features/judge/JudgeScoringInterface';
import { AttendanceScanner } from './features/attendance/AttendanceScanner';
import { LeaderboardView } from './features/leaderboard/LeaderboardView';
import { IdCardDesigner } from './features/documents/IdCardDesigner';
import { HealthAndIncidents } from './features/health/HealthAndIncidents';
import { LogisticsInventory } from './features/logistics/LogisticsInventory';
import { MyProfile } from './features/profile/MyProfile';
import { EventManagementStudio } from './features/event_studio/EventManagementStudio';
import { PublicEventHomepage } from './features/public/PublicEventHomepage';
import { PublicDocumentationGallery } from './features/documentation/PublicDocumentationGallery';
import { AdminPublicGalleryManager } from './features/documentation/AdminPublicGalleryManager';
import { OrganizationManagement } from './features/organizations/OrganizationManagement';
import { UserManagementView } from './features/users/UserManagementView';
import { AdminBrandingManager } from './features/branding/AdminBrandingManager';
import { BannerSponsorManager } from './features/event_studio/BannerSponsorManager';
import { DatabaseStorageManager } from './features/database/DatabaseStorageManager';
import { AdminInstallationCenter } from './features/installation/AdminInstallationCenter';
import { FirstBootstrapScreen } from './features/installation/FirstBootstrapScreen';
import { SystemUpdateCenter } from './features/system/SystemUpdateCenter';
import { ReauthModal } from './components/layout/ReauthModal';
import { QrScannerModal } from './components/scanner/QrScannerModal';
import { SyncCenterModal } from './features/sync/SyncCenterModal';
import { GlobalFooter } from './components/layout/GlobalFooter';
import { UserRole, SystemFeatureKey } from './types';
import { featureControlService } from './services/featureControlService';
import { canReadInstallation } from './backend/rbac/permissions';
import { bootstrapService } from './services/bootstrapService';
import { Lock, ArrowLeft, ShieldAlert, Globe, UserCheck, AlertCircle, ShieldCheck } from 'lucide-react';

export const PUBLIC_ROUTES: ReadonlyArray<NavTab> = [
  'public_home',
  'public_gallery',
  'bootstrap',
];

const ROLE_ALLOWED_TABS: Record<UserRole, ReadonlyArray<NavTab>> = {
  superadmin: ['home', 'public_home', 'public_gallery', 'gallery_admin', 'admin_dashboard', 'event_studio', 'superadmin', 'branding_settings', 'database_storage', 'installation', 'system_update', 'organizations', 'users', 'schedule', 'participants', 'contingent_regus', 'competitions', 'judge', 'attendance', 'leaderboard', 'profile', 'templates', 'health', 'logistics'],
  workspace_admin: ['home', 'public_home', 'public_gallery', 'gallery_admin', 'admin_dashboard', 'event_studio', 'branding_settings', 'database_storage', 'installation', 'system_update', 'organizations', 'users', 'schedule', 'participants', 'contingent_regus', 'competitions', 'judge', 'attendance', 'leaderboard', 'profile', 'templates', 'health', 'logistics'],
  event_admin: ['home', 'public_home', 'public_gallery', 'gallery_admin', 'admin_dashboard', 'event_studio', 'installation', 'organizations', 'schedule', 'participants', 'contingent_regus', 'competitions', 'judge', 'attendance', 'leaderboard', 'profile', 'templates', 'health', 'logistics'],
  kontingen_admin: ['home', 'public_home', 'public_gallery', 'schedule', 'participants', 'contingent_regus', 'competitions', 'leaderboard', 'profile'],
  registration_officer: ['home', 'public_home', 'public_gallery', 'schedule', 'participants', 'contingent_regus', 'attendance', 'profile', 'templates'],
  attendance_officer: ['home', 'public_home', 'public_gallery', 'schedule', 'attendance', 'participants', 'profile'],
  judge: ['home', 'public_home', 'public_gallery', 'schedule', 'judge', 'competitions', 'profile'],
  health_officer: ['home', 'public_home', 'public_gallery', 'schedule', 'health', 'participants', 'profile'],
  logistic_officer: ['home', 'public_home', 'public_gallery', 'schedule', 'logistics', 'profile'],
  committee: ['home', 'public_home', 'public_gallery', 'schedule', 'attendance', 'participants', 'competitions', 'profile'],
  participant: ['home', 'public_home', 'public_gallery', 'schedule', 'competitions', 'leaderboard', 'profile'],
  ceremony_officer: ['home', 'public_home', 'public_gallery', 'schedule', 'attendance', 'profile'],
  documentation_officer: ['home', 'public_home', 'public_gallery', 'gallery_admin', 'schedule', 'profile'],
  publication_officer: ['home', 'public_home', 'public_gallery', 'gallery_admin', 'schedule', 'profile'],
  viewer: ['home', 'public_home', 'public_gallery'],
};

// Page IDs that can be opened through navigation URLs. GAS remains the source of app data.
const VALID_NAV_TABS = new Set<NavTab>(Object.values(ROLE_ALLOWED_TABS).flat());
const readInternalTab = (): NavTab | null => {
  try {
    const candidate = new URLSearchParams(window.location.search).get('tab') as NavTab | null;
    return candidate && VALID_NAV_TABS.has(candidate) ? candidate : null;
  } catch { return null; }
};

const TAB_FEATURE_REQUIREMENTS: Partial<Record<NavTab, SystemFeatureKey>> = {
  schedule: 'SCHEDULE',
  attendance: 'ATTENDANCE',
  competitions: 'COMPETITION',
  judge: 'JUDGING',
  leaderboard: 'POINTS_XP',
  health: 'HEALTH',
  logistics: 'LOGISTICS',
  public_gallery: 'PUBLIC_DOCUMENTATION',
  gallery_admin: 'PUBLIC_DOCUMENTATION',
  public_home: 'PUBLIC_EVENT_PAGE',
};

import { eventService } from './services/eventService';
import { workspaceService } from './services/workspaceService';
import { customerInstallationService } from './services/customerInstallationService';
import { InstallationState } from './features/public/PublicEventHomepage';

/**
 * Admin hub untuk pengaturan portal publik.
 * Sponsor ditampilkan lebih dahulu agar mudah ditemukan, sementara
 * pengaturan branding lama tetap tersedia dan tidak dihapus.
 */
const AdminBrandingSponsorHub: React.FC = () => {
  const [section, setSection] = useState<'sponsors' | 'branding'>('sponsors');

  const tabClass = (active: boolean) =>
    `min-h-10 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-colors ${
      active
        ? 'bg-white text-emerald-700 shadow-sm dark:bg-[#121215] dark:text-emerald-300'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
    }`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#141418]">
        <div className="mb-2 px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">
            Pengaturan Portal Publik
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Kelola logo sponsor yang tampil di halaman depan atau pengaturan tampilan umum.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-white/5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSection('sponsors')}
            aria-pressed={section === 'sponsors'}
            className={tabClass(section === 'sponsors')}
          >
            Banner & Logo Sponsor
          </button>
          <button
            type="button"
            onClick={() => setSection('branding')}
            aria-pressed={section === 'branding'}
            className={tabClass(section === 'branding')}
          >
            Branding & Tampilan Umum
          </button>
        </div>
      </div>

      {section === 'sponsors' ? (
        <BannerSponsorManager initialTab="sponsors" />
      ) : (
        <AdminBrandingManager />
      )}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    try {
      const path = window.location.pathname;
      const requested = readInternalTab();
      if (requested && authService.isAuthenticated()) return requested;
      if (path === '/bootstrap' || path === '/bootstrap/') {
        return 'bootstrap';
      }
      if (path === '/install' || path === '/install/') {
        // Requirement 2 & 6: Anonymous user opening /install must be redirected to /login
        if (!authService.isAuthenticated()) {
          window.history.replaceState(null, '', '/login');
          return 'home';
        }
        return 'installation';
      }
      if (path === '/login' || path === '/login/') {
        return 'home';
      }
      if (path === '/gallery' || path === '/gallery/') {
        return 'public_gallery';
      }
    } catch {}
    return 'public_home';
  });
  // All grid cards, desktop/mobile menus and feature buttons navigate to one page.
  // Browser history stores only the page ID; sensitive app data always comes from GAS.
  const navigateToTab = (tab: NavTab) => {
    if (tab === activeTab) return;
    try {
      const url = tab === 'public_home' ? '/'
        : tab === 'public_gallery' ? '/gallery'
        : tab === 'bootstrap' ? '/bootstrap'
        : tab === 'installation' ? '/install'
        : `/?tab=${encodeURIComponent(tab)}`;
      window.history.pushState({ siepangTab: tab }, '', url);
    } catch { /* navigation still works if browser history is unavailable */ }
    setActiveTab(tab);
  };

  useEffect(() => {
    // Scroll only on page changes, not whenever GAS refreshes a card.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  const [currentRole, setCurrentRole] = useState<UserRole>(authService.getCurrentUser()?.role || 'viewer');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSyncCenterOpen, setIsSyncCenterOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(authService.isAuthenticated());
  const [ssoEmailInput, setSsoEmailInput] = useState('');
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Authoritative Single-Event Installation State
  const [installationState, setInstallationState] = useState<InstallationState>('LOADING');
  const [isInstallationConfigured, setIsInstallationConfigured] = useState<boolean>(
    customerInstallationService.isConfigured() || eventService.getIsConfigured()
  );
  const [installationError, setInstallationError] = useState<string | null>(
    eventService.getConfigError()
  );
  const [isCheckingInstallation, setIsCheckingInstallation] = useState<boolean>(true);

  // 0. Canonical Single-Event Installation Startup Flow (Asynchronous, Non-blocking)
  const handleCheckInstallation = async () => {
    setIsCheckingInstallation(true);
    setInstallationState('LOADING');
    try {
      const [result] = await Promise.all([
        eventService.loadCurrentInstallationEventWithResult(),
        workspaceService.loadInstallationWorkspace().catch(() => null),
      ]);

      const isRecordConfigured = customerInstallationService.isConfigured();
      const isEvtConfigured = result.state === 'CONFIGURED' || eventService.getIsConfigured();
      const configured = isRecordConfigured && isEvtConfigured;

      setIsInstallationConfigured(configured || result.state === 'CONFIGURED');
      setInstallationError(result.error);
      setInstallationState(result.state);
    } catch (err: any) {
      setIsInstallationConfigured(false);
      setInstallationError(err?.message || 'Gagal terhubung ke backend.');
      setInstallationState('BACKEND_UNREACHABLE');
    } finally {
      setIsCheckingInstallation(false);
    }
  };

  /**
   * Canonical authentication readiness check.
   *
   * The GAS backend is authoritative. This also hydrates the local installation
   * record with the canonical public Web App URL so authService/apiTransport do
   * not depend on a Vercel environment variable or stale browser state.
   */
  const ensureAuthBackendReady = async (): Promise<boolean> => {
    try {
      const status = await bootstrapService.getStatus();

      if (!status.backend_reachable || !status.installation_ready) {
        setIsInstallationConfigured(false);
        setInstallationState(
          status.backend_reachable ? 'NOT_CONFIGURED' : 'BACKEND_UNREACHABLE'
        );
        setAuthError(
          'Sistem autentikasi belum tersedia. Silakan coba kembali setelah administrator menyelesaikan konfigurasi.'
        );
        return false;
      }

      const backendUrl = bootstrapService.getBackendUrl();
      if (!backendUrl) {
        setAuthError('Backend Google Apps Script belum dapat dijangkau.');
        return false;
      }

      customerInstallationService.updateInstallationRecord({
        web_app_url: backendUrl,
        installation_status: 'READY',
      });

      bootstrapService.setInstallationReady(true);
      setIsInstallationConfigured(true);
      setInstallationState('CONFIGURED');
      setInstallationError(null);
      return true;
    } catch {
      setAuthError(
        'Sistem autentikasi belum tersedia. Silakan coba kembali beberapa saat lagi.'
      );
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const syncBootstrapAuthority = async () => {
      try {
        const status = await bootstrapService.getStatus();
        if (!mounted) return;

        if (status.backend_reachable && status.installation_ready) {
          const backendUrl = bootstrapService.getBackendUrl();

          if (backendUrl) {
            customerInstallationService.updateInstallationRecord({
              web_app_url: backendUrl,
              installation_status: 'READY',
            });
          }

          bootstrapService.setInstallationReady(true);
          setIsInstallationConfigured(true);
          setInstallationState('CONFIGURED');
          setInstallationError(null);

          // Bootstrap is one-time only. Once GAS says READY, /bootstrap is no
          // longer a public setup screen and returns the user to canonical login.
          try {
            const path = window.location.pathname;
            if (path === '/bootstrap' || path === '/bootstrap/') {
              window.history.replaceState(null, '', '/login');
              setActiveTab('home');
            }
          } catch {}
        }
      } catch {
        // Do not block the public portal. Login actions will retry authoritatively.
      }
    };

    syncBootstrapAuthority();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Backward compatibility: redirect any legacy /workspace, /w/:code paths to root "/"
    try {
      const path = window.location.pathname;
      if (path.startsWith('/workspace') || path.startsWith('/w/')) {
        window.history.replaceState(null, '', '/');
      }
    } catch {}

    handleCheckInstallation();

    // Listen to popstate for browser navigation (e.g. Back/Forward button)
    const handlePopState = () => {
      try {
        const path = window.location.pathname;
        const internalTab = readInternalTab();
        if (internalTab && authService.isAuthenticated()) {
          setActiveTab(internalTab);
        } else if (path === '/bootstrap' || path === '/bootstrap/') {
          setActiveTab('bootstrap');
        } else if (path === '/install' || path === '/install/') {
          if (!authService.isAuthenticated()) {
            window.history.replaceState(null, '', '/login');
            setActiveTab('home');
          } else {
            setActiveTab('installation');
          }
        } else if (path === '/login' || path === '/login/') {
          setActiveTab('home');
        } else if (path === '/gallery' || path === '/gallery/') {
          setActiveTab('public_gallery');
        } else if (path === '/' || path === '') {
          setActiveTab('public_home');
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);

    const unsubEvent = eventService.subscribe(() => {
      const isEvtConf = eventService.getIsConfigured();
      const isRecConf = customerInstallationService.isConfigured();
      const configured = isRecConf || isEvtConf;
      setIsInstallationConfigured(configured);
      setInstallationError(eventService.getConfigError());
      if (configured) {
        setInstallationState('CONFIGURED');
      }
    });

    const unsubInst = customerInstallationService.subscribe(() => {
      const isEvtConf = eventService.getIsConfigured();
      const isRecConf = customerInstallationService.isConfigured();
      const configured = isRecConf || isEvtConf;
      setIsInstallationConfigured(configured);
      setInstallationError(eventService.getConfigError());
      if (configured) {
        setInstallationState('CONFIGURED');
      }
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      unsubEvent();
      unsubInst();
    };
  }, []);

  // Synchronize browser URL bar with activeTab for /, /install, /gallery, /bootstrap, and /login
  useEffect(() => {
    try {
      const currentPath = window.location.pathname;
      if (activeTab === 'bootstrap') {
        if (currentPath !== '/bootstrap') {
          window.history.pushState(null, '', '/bootstrap');
        }
      } else if (activeTab === 'installation') {
        if (!isLoggedIn) {
          if (currentPath !== '/login') {
            window.history.replaceState(null, '', '/login');
          }
        } else if (currentPath !== '/install') {
          window.history.pushState(null, '', '/install');
        }
      } else if (activeTab === 'public_home' && currentPath !== '/') {
        window.history.pushState(null, '', '/');
      } else if (activeTab === 'public_gallery' && currentPath !== '/gallery') {
        window.history.pushState(null, '', '/gallery');
      }
    } catch {}
  }, [activeTab, isLoggedIn]);

  useEffect(() => {
    const unsub = featureControlService.subscribe(() => setTick(t => t + 1));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = authService.subscribe(state => {
      setIsLoggedIn(state.isAuthenticated);
      if (state.user) {
        setCurrentRole(state.user.role);
      } else {
        setCurrentRole('viewer');
      }
    });
    return () => unsub();
  }, []);

  // =========================================================================
  // APPROVED PASSWORDLESS EMAIL OTP & TRUSTED DEVICE ARCHITECTURE
  // =========================================================================
  type AuthUiMode = 'LOGIN' | 'LOGIN_OTP' | 'REGISTER' | 'REGISTER_OTP';
  const [authMode, setAuthMode] = useState<AuthUiMode>('LOGIN');
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [loginEmail, setLoginEmail] = useState(() => {
    try {
      const search = new URLSearchParams(window.location.search);
      return search.get('loginEmail') || '';
    } catch {
      return '';
    }
  });
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  // Only a challenge ID actually returned by GAS can be used for OTP verification.
  // sessionStorage is tab-scoped; never store the OTP code itself.
  const OTP_CHALLENGE_STORAGE_KEY = 'siepang_login_otp_challenge_v1';
  const OTP_ATTEMPT_STORAGE_KEY = 'siepang_login_otp_attempt_v1';
  const rememberLoginChallenge = (email: string, id: string, cooldownSeconds = 60) => {
    const record = { email, challengeId: id, expiresAt: Date.now() + 10 * 60 * 1000, resendAt: Date.now() + cooldownSeconds * 1000 };
    try { sessionStorage.setItem(OTP_CHALLENGE_STORAGE_KEY, JSON.stringify(record)); } catch { /* blocked storage */ }
  };
  const clearLoginChallenge = () => {
    try {
      sessionStorage.removeItem(OTP_CHALLENGE_STORAGE_KEY);
      sessionStorage.removeItem(OTP_ATTEMPT_STORAGE_KEY);
    } catch { /* blocked storage */ }
  };
  const getSavedLoginChallenge = (email: string): { challengeId: string; resendAt: number } | null => {
    try {
      const raw = sessionStorage.getItem(OTP_CHALLENGE_STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved.email === email && typeof saved.challengeId === 'string' &&
          saved.challengeId && Number(saved.expiresAt) > Date.now()) {
        return { challengeId: saved.challengeId, resendAt: Number(saved.resendAt) || 0 };
      }
    } catch { /* corrupted or blocked storage */ }
    return null;
  };
  const recordOtpAttempt = (email: string) => {
    try { sessionStorage.setItem(OTP_ATTEMPT_STORAGE_KEY, JSON.stringify({ email, until: Date.now() + 60_000 })); } catch { /* blocked storage */ }
  };
  const remainingOtpAttemptSeconds = (email: string): number => {
    try {
      const raw = sessionStorage.getItem(OTP_ATTEMPT_STORAGE_KEY);
      if (!raw) return 0;
      const saved = JSON.parse(raw);
      if (saved.email !== email) return 0;
      return Math.max(0, Math.ceil((Number(saved.until) - Date.now()) / 1000));
    } catch { return 0; }
  };
  useEffect(() => {
    const email = loginEmail.trim().toLowerCase();
    if (!email) return;
    const saved = getSavedLoginChallenge(email);
    if (saved) {
      setChallengeId(saved.challengeId);
      setAuthMode('LOGIN_OTP');
      setResendCooldown(Math.max(0, Math.ceil((saved.resendAt - Date.now()) / 1000)));
      setAuthSuccess('Kode sebelumnya masih dapat digunakan selama belum kedaluwarsa. Masukkan kode terbaru dari email.');
    } else {
      const remain = remainingOtpAttemptSeconds(email);
      if (remain > 0) setResendCooldown(remain);
    }
  // Restore only when this login view is first mounted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronous guard against duplicate submit events before React has time
  // to render the disabled button state.
  const loginOtpRequestLockRef = useRef(false);
  const loginOtpVerifyLockRef = useRef(false);
  const registerOtpVerifyLockRef = useRef(false);

  // 1. Startup Auto-Login Session Validation (Requirement 9 & 10)
  useEffect(() => {
    let isMounted = true;
    const validateStartupSession = async () => {
      try {
        const res = await authService.validateCurrentSession();
        if (isMounted) {
          setIsInitializingAuth(false);
          if (res.valid) {
            setIsLoggedIn(true);
          }
        }
      } catch {
        if (isMounted) setIsInitializingAuth(false);
      }
    };
    validateStartupSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Cooldown timer ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown(c => c - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleStartLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loginOtpRequestLockRef.current || isSubmittingAuth) {
      return;
    }

    const email = loginEmail.trim().toLowerCase();
    if (!email) return;

    // Reuse a confirmed, unexpired challenge rather than requesting another email.
    const savedChallenge = getSavedLoginChallenge(email);
    if (savedChallenge) {
      setChallengeId(savedChallenge.challengeId);
      setAuthMode('LOGIN_OTP');
      setResendCooldown(Math.max(0, Math.ceil((savedChallenge.resendAt - Date.now()) / 1000)));
      setAuthError(null);
      setAuthSuccess('Silakan masukkan kode OTP yang sudah dikirim ke email Anda.');
      return;
    }
    const waitSeconds = remainingOtpAttemptSeconds(email);
    if (waitSeconds > 0) {
      setResendCooldown(waitSeconds);
      setAuthError(`Permintaan kode baru saja dikirim. Periksa email Anda dan tunggu sekitar ${waitSeconds} detik. Jika halaman kode belum muncul, respons GAS mungkin terputus; jangan klik Lanjut berulang kali.`);
      return;
    }

    loginOtpRequestLockRef.current = true;
    setAuthError(null);
    setAuthSuccess(null);
    setIsSubmittingAuth(true);

    try {
      const backendReady = await ensureAuthBackendReady();
      if (!backendReady) {
        return;
      }

      recordOtpAttempt(email);
      const res = await authService.requestLoginOtp(email);

      if (!res.success) {
        const message = res.error || 'Permintaan kode belum berhasil dikonfirmasi.';
        const possiblyDelivered = /fetch|network|jaringan|timeout|waktu|terhubung|dijangkau|detik|tunggu/i.test(message);
        if (possiblyDelivered) {
          setResendCooldown(Math.max(remainingOtpAttemptSeconds(email), 1));
          setAuthError(`Respons pengiriman OTP belum dapat dipastikan: ${message} Jika email sudah masuk, jangan meminta kode lagi sebelum masa tunggu selesai. Halaman verifikasi membutuhkan ID yang diterima dari GAS.`);
        } else {
          setAuthError(message);
          try { sessionStorage.removeItem(OTP_ATTEMPT_STORAGE_KEY); } catch {}
        }
        return;
      }

      if (res.authenticated) {
        setAuthError(null);
        setAuthSuccess(
          res.message || 'Perangkat tepercaya dikenali. Berhasil masuk tanpa OTP.'
        );
        setIsLoggedIn(true);
        setActiveTab('home');
        return;
      }

      const nextChallengeId = String(res.challengeId || '').trim();
      if (!nextChallengeId) {
        setAuthError(
          'Kode OTP berhasil diproses, tetapi ID verifikasi tidak diterima. Silakan coba lagi.'
        );
        return;
      }

      rememberLoginChallenge(email, nextChallengeId);
      setChallengeId(nextChallengeId);
      setAuthMode('LOGIN_OTP');
      setResendCooldown(60);
      setOtpInput('');
      setAuthSuccess(res.message || `Kode verifikasi telah dikirim ke ${email}.`);
    } finally {
      setIsSubmittingAuth(false);
      loginOtpRequestLockRef.current = false;
    }
  };

  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loginOtpVerifyLockRef.current || isSubmittingAuth) {
      return;
    }

    const otp = otpInput.trim();
    if (otp.length !== 6) {
      setAuthError('Masukkan 6 digit kode verifikasi.');
      return;
    }

    if (!challengeId.trim()) {
      setAuthError('ID verifikasi tidak tersedia. Silakan minta kode OTP baru.');
      return;
    }

    loginOtpVerifyLockRef.current = true;
    setAuthError(null);
    setAuthSuccess(null);
    setIsSubmittingAuth(true);

    try {
      const res = await authService.verifyLoginOtp({
        challengeId: challengeId.trim(),
        email: loginEmail.trim().toLowerCase(),
        otp,
      });

      if (!res.success) {
        setAuthError(
          res.error ||
            'Kode verifikasi tidak valid atau telah kedaluwarsa.'
        );
        return;
      }

      setAuthError(null);
      setAuthSuccess(
        '✓ Berhasil masuk. Perangkat terdaftar sebagai perangkat tepercaya.'
      );

      clearLoginChallenge();
      // Authentication state has already been persisted by authService.
      // Move to the dashboard immediately so no second submit can consume
      // the same one-time OTP challenge.
      setIsLoggedIn(true);
      setActiveTab('home');
    } finally {
      setIsSubmittingAuth(false);
      loginOtpVerifyLockRef.current = false;
    }
  };

  const handleStartRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = regName.trim();
    const email = regEmail.trim().toLowerCase();
    if (!name || !email) return;

    setAuthError(null);
    setAuthSuccess(null);
    setIsSubmittingAuth(true);

    const backendReady = await ensureAuthBackendReady();
    if (!backendReady) {
      setIsSubmittingAuth(false);
      return;
    }

    const res = await authService.requestRegisterOtp(name, email);
    setIsSubmittingAuth(false);

    if (!res.success) {
      setAuthError(res.error || 'Gagal mengirim kode verifikasi.');
    } else {
      setChallengeId(res.challengeId || '');
      setDevOtpHint(res.devOtp || null);
      setAuthMode('REGISTER_OTP');
      setResendCooldown(60);
      setOtpInput('');
    }
  };

  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerOtpVerifyLockRef.current || isSubmittingAuth) {
      return;
    }

    const otp = otpInput.trim();
    if (otp.length !== 6) {
      setAuthError('Masukkan 6 digit kode verifikasi.');
      return;
    }

    if (!challengeId.trim()) {
      setAuthError('ID verifikasi tidak tersedia. Silakan minta kode OTP baru.');
      return;
    }

    registerOtpVerifyLockRef.current = true;
    setAuthError(null);
    setAuthSuccess(null);
    setIsSubmittingAuth(true);

    try {
      const res = await authService.verifyRegisterOtp({
        challengeId: challengeId.trim(),
        email: regEmail.trim().toLowerCase(),
        otp,
        name: regName.trim(),
      });

      if (!res.success) {
        setAuthError(
          res.error ||
            'Kode verifikasi tidak valid atau telah kedaluwarsa.'
        );
        return;
      }

      setAuthError(null);
      setAuthSuccess('✓ Email berhasil diverifikasi. Akun SiEpang Anda sudah aktif.');
      setIsLoggedIn(true);
      setActiveTab('home');
    } finally {
      setIsSubmittingAuth(false);
      registerOtpVerifyLockRef.current = false;
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSubmittingAuth) return;
    setAuthError(null);
    setIsSubmittingAuth(true);

    const backendReady = await ensureAuthBackendReady();
    if (!backendReady) {
      setIsSubmittingAuth(false);
      return;
    }

    if (authMode === 'LOGIN_OTP') {
      const res = await authService.requestLoginOtp(loginEmail.trim().toLowerCase());
      setIsSubmittingAuth(false);
      if (res.success && res.challengeId) {
        rememberLoginChallenge(loginEmail.trim().toLowerCase(), res.challengeId);
        recordOtpAttempt(loginEmail.trim().toLowerCase());
        setChallengeId(res.challengeId);
        setDevOtpHint(res.devOtp || null);
        setOtpInput('');
        setAuthError(null);
        setResendCooldown(60);
        setAuthSuccess(`Kode verifikasi baru telah dikirim ke ${loginEmail}. Gunakan kode terbaru dari email.`);
      } else {
        setAuthError(res.error || 'Gagal mengirim ulang kode.');
      }
    } else if (authMode === 'REGISTER_OTP') {
      const res = await authService.requestRegisterOtp(regName.trim(), regEmail.trim().toLowerCase());
      setIsSubmittingAuth(false);
      if (res.success) {
        setChallengeId(res.challengeId || '');
        setDevOtpHint(res.devOtp || null);
        setOtpInput('');
        setAuthError(null);
        setResendCooldown(60);
        setAuthSuccess(`Kode verifikasi baru telah dikirim ke ${regEmail}. Gunakan kode terbaru dari email.`);
      } else {
        setAuthError(res.error || 'Gagal mengirim ulang kode.');
      }
    }
  };

  const handleLogout = () => {
    clearLoginChallenge();
    authService.logout();
    setIsLoggedIn(false);
    setActiveTab('public_home');
    setAuthError(null);
    setAuthSuccess(null);
    setAuthMode('LOGIN');
  };

  // 1. PUBLIC ROUTE ALLOWLIST HANDLING (Requirement 7)
  const isRequestingPublicRoute = PUBLIC_ROUTES.includes(activeTab);

  // 2. TEMPORARY LOADING SCREEN WHILE AUTO-LOGIN IS CHECKED (Requirement 16)
  if (isInitializingAuth && !isRequestingPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F8] dark:bg-[#0E0E12] text-[#171717] dark:text-slate-100 p-6 selection:bg-[#F47743] selection:text-white">
        <img
          src="https://lh3.googleusercontent.com/d/1m9afdNFJjUCCjuUFbDe-v1pa2iqIyqc5=w1000"
          alt="Logo SiEpang"
          className="w-20 h-20 rounded-2xl object-contain animate-pulse"
          referrerPolicy="no-referrer"
        />
        <div className="mt-4 text-center space-y-1">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Memuat SiEpang...
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Memvalidasi sesi perangkat terpercaya
          </p>
        </div>
      </div>
    );
  }

  // 3. UNAUTHENTICATED USERS TRYING PROTECTED ROUTES: PASSWORDLESS OTP UI (Requirements 16 & 17)
  if (!isLoggedIn && !isRequestingPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-[#F7F7F8] dark:bg-[#0E0E12] text-[#171717] dark:text-slate-100 p-4 sm:p-6 selection:bg-[#F47743] selection:text-white">
        <div className="w-full max-w-md mx-auto my-auto space-y-6 bg-white dark:bg-[#141418] p-6 sm:p-8 rounded-[32px] border border-[#ECECEF] dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-gradient-to-tr from-[#208C60] via-[#F47743] to-[#FFD36A] flex items-center justify-center text-3xl sm:text-4xl shadow-lg shadow-pink-500/20 text-white">
              ⚜️
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight font-display">
                {authMode === 'REGISTER' ? 'Buat Akun' : (authMode === 'REGISTER_OTP' || authMode === 'LOGIN_OTP') ? 'Verifikasi Email' : 'SiEpang'}
              </h1>
              {authMode === 'LOGIN' && (
                <p className="text-xs text-[#F47743] font-bold">
                  Sistem Informasi Perkemahan Pramuka
                </p>
              )}
              {(authMode === 'REGISTER_OTP' || authMode === 'LOGIN_OTP') && (
                <p className="text-xs text-[#6B7280] dark:text-slate-400 pt-0.5">
                  Kode dikirim ke: <span className="font-semibold text-slate-800 dark:text-slate-200">{authMode === 'REGISTER_OTP' ? regEmail : loginEmail}</span>
                </p>
              )}
            </div>
          </div>

          {/* Feedback Messages */}
          {authError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block">{authError}</span>
              </div>
            </div>
          )}

          {authSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <div className="w-4 h-4 text-emerald-600 shrink-0 font-bold mt-0.5">✓</div>
              <div className="space-y-0.5">
                <span className="font-bold block">{authSuccess}</span>
              </div>
            </div>
          )}

          {/* Non-production Dev OTP Banner */}
          {!import.meta.env.PROD && devOtpHint && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-[11px] flex items-center justify-between">
              <span>Simulasi Dev OTP:</span>
              <button
                type="button"
                onClick={() => setOtpInput(devOtpHint)}
                className="font-mono font-bold px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 hover:opacity-80 cursor-pointer"
              >
                {devOtpHint} (Isi Otomatis)
              </button>
            </div>
          )}

          {/* VIEW 1: LOGIN (EMAIL INPUT) */}
          {authMode === 'LOGIN' && (
            <form onSubmit={handleStartLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="w-full px-4 py-3 bg-[#F7F7F8] dark:bg-black/20 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-sm text-[#171717] dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth || !loginEmail.trim()}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmittingAuth ? 'Memproses...' : 'Lanjut'}</span>
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Belum punya akun?{' '}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setAuthSuccess(null);
                    setAuthMode('REGISTER');
                  }}
                  className="text-xs font-bold text-[#F47743] hover:underline cursor-pointer"
                >
                  Daftar
                </button>
              </div>

              <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10 space-y-2">
                <button
                  type="button"
                  onClick={() => navigateToTab('public_home')}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#ECECEF] dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-purple-600" />
                  <span>Portal Publik</span>
                </button>

              </div>
            </form>
          )}

          {/* VIEW 2: LOGIN OTP VERIFICATION */}
          {authMode === 'LOGIN_OTP' && (
            <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block text-center">
                  Masukkan 6 Digit Kode OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  autoFocus
                  required
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono font-bold py-3 bg-[#F7F7F8] dark:bg-black/20 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth || otpInput.trim().length !== 6}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmittingAuth ? 'Memverifikasi...' : 'Verifikasi'}</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isSubmittingAuth}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : 'Kirim Ulang Kode'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearLoginChallenge();
                    setAuthError(null);
                    setAuthSuccess(null);
                    setAuthMode('LOGIN');
                  }}
                  className="text-[#F47743] hover:underline font-semibold cursor-pointer"
                >
                  Ganti Email
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: REGISTRATION (NAME & EMAIL INPUT) */}
          {authMode === 'REGISTER' && (
            <form onSubmit={handleStartRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="Nama Lengkap Anda"
                  className="w-full px-4 py-3 bg-[#F7F7F8] dark:bg-black/20 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-sm text-[#171717] dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="w-full px-4 py-3 bg-[#F7F7F8] dark:bg-black/20 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-sm text-[#171717] dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth || !regName.trim() || !regEmail.trim()}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmittingAuth ? 'Mengirim Kode...' : 'Kirim Kode'}</span>
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Sudah punya akun?{' '}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setAuthSuccess(null);
                    setAuthMode('LOGIN');
                  }}
                  className="text-xs font-bold text-[#F47743] hover:underline cursor-pointer"
                >
                  Masuk
                </button>
              </div>

              <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => navigateToTab('public_home')}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#ECECEF] dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-purple-600" />
                  <span>Portal Publik</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW 4: REGISTRATION OTP VERIFICATION */}
          {authMode === 'REGISTER_OTP' && (
            <form onSubmit={handleVerifyRegisterOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block text-center">
                  Masukkan 6 Digit Kode OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  autoFocus
                  required
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono font-bold py-3 bg-[#F7F7F8] dark:bg-black/20 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white focus:outline-none focus:border-[#F47743]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth || otpInput.trim().length !== 6}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmittingAuth ? 'Memverifikasi...' : 'Verifikasi'}</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isSubmittingAuth}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : 'Kirim Ulang Kode'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setAuthSuccess(null);
                    setAuthMode('REGISTER');
                  }}
                  className="text-[#F47743] hover:underline font-semibold cursor-pointer"
                >
                  Ganti Data
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Reusable Footer on Login Page */}
        <GlobalFooter />
      </div>
    );
  }

  // 3. ROLE-BASED ROUTE AUTHORIZATION ENFORCEMENT (Requirement 16 & 24)
  const allowedTabsForRole = ROLE_ALLOWED_TABS[currentRole] || ['public_home', 'public_gallery'];
  const isTabAuthorized =
    allowedTabsForRole.includes(activeTab) ||
    (activeTab === 'installation' && canReadInstallation(currentRole));

  // Check if activeTab requires a feature that is disabled (PART B)
  const requiredFeature = TAB_FEATURE_REQUIREMENTS[activeTab];
  const isFeatureBlocked = requiredFeature && !featureControlService.isFeatureEnabled(requiredFeature);

  return (
    <AppLayout
      activeTab={activeTab}
      onTabChange={navigateToTab}
      role={currentRole}
      onOpenScanner={() => setIsScannerOpen(true)}
      onOpenSyncCenter={() => setIsSyncCenterOpen(true)}
      onLogout={handleLogout}
    >
      {/* Feature Blocked Screen */}
      {isFeatureBlocked ? (
        <div className="p-8 sm:p-12 text-center rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 max-w-lg mx-auto my-12 space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-200/50">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Modul Tidak Aktif
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Fitur <strong>{requiredFeature}</strong> saat ini sedang dinonaktifkan oleh administrator untuk perkemahan ini.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateToTab('home')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#208C60] to-[#F47743] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </button>
        </div>
      ) : !isTabAuthorized && !isRequestingPublicRoute ? (
        /* Unauthorized Protected Route Screen (Requirement 16) */
        <div className="p-8 sm:p-12 text-center rounded-[28px] bg-white dark:bg-[#121215] border border-rose-200 dark:border-rose-900/40 max-w-lg mx-auto my-12 space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-200/50">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Akses Modul Ditolak (403)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Peran Anda (<strong>{currentRole}</strong>) tidak memiliki otorisasi untuk mengakses modul <strong>{activeTab}</strong>. Seluruh akses sistem dicatat pada audit log.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateToTab('home')}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda Resmi</span>
          </button>
        </div>
      ) : (
        <>
          {/* Route Switcher with Role-Based Home Experience */}
          {activeTab === 'home' && (
            <RoleHomeRouter
              role={currentRole}
              onNavigate={navigateToTab}
              onOpenScanner={() => setIsScannerOpen(true)}
              onOpenSyncCenter={() => setIsSyncCenterOpen(true)}
            />
          )}

          {activeTab === 'public_home' && (
            <PublicEventHomepage
              onNavigateToGallery={() => navigateToTab('public_gallery')}
              onNavigateToVisitorRegister={() => navigateToTab('home')}
              onNavigateToSchedule={() => navigateToTab('schedule')}
              onNavigateToLeaderboard={() => navigateToTab('leaderboard')}
              onOpenScanner={() => setIsScannerOpen(true)}
              onNavigateToLogin={(email?: string) => {
                if (typeof email === 'string' && email.trim()) {
                  setLoginEmail(email.trim());
                  setAuthMode('LOGIN');
                  setAuthError(null);
                  setAuthSuccess(null);
                }
                window.history.pushState(null, '', '/login');
                setActiveTab('home');
              }}
              onRetryConnection={handleCheckInstallation}
              installationState={installationState}
              installationError={installationError}
            />
          )}

          {activeTab === 'public_gallery' && (
            <PublicDocumentationGallery
              onBackToHome={() => navigateToTab('public_home')}
            />
          )}

          {activeTab === 'gallery_admin' && <AdminPublicGalleryManager />}

          {activeTab === 'admin_dashboard' && (
            <AdminDaerahDashboard
              onNavigate={navigateToTab}
              onOpenScanner={() => setIsScannerOpen(true)}
              onOpenSyncCenter={() => setIsSyncCenterOpen(true)}
            />
          )}

          {activeTab === 'event_studio' && (
            <EventManagementStudio onNavigateToTab={navigateToTab} />
          )}

          {activeTab === 'superadmin' && <SuperAdminDashboard />}

          {activeTab === 'branding_settings' && <AdminBrandingSponsorHub />}

          {activeTab === 'database_storage' && <DatabaseStorageManager />}

          {activeTab === 'bootstrap' && (
            <FirstBootstrapScreen
              onComplete={(superadminEmail) => {
                setLoginEmail(superadminEmail);
                setAuthError(null);
                setAuthSuccess(null);
                setAuthMode('LOGIN');
                window.history.pushState(null, '', '/login');
                setActiveTab('home');
              }}
              onNavigateToLogin={() => {
                window.history.pushState(null, '', '/login');
                setActiveTab('home');
              }}
            />
          )}

          {activeTab === 'installation' && (
            <AdminInstallationCenter onBackToHome={() => navigateToTab('public_home')} />
          )}

          {activeTab === 'system_update' && <SystemUpdateCenter />}

          {activeTab === 'organizations' && <OrganizationManagement />}

          {activeTab === 'users' && <UserManagementView />}

          {activeTab === 'schedule' && <EventSchedule />}

          {activeTab === 'participants' && <ParticipantList />}
          {activeTab === 'contingent_regus' && <ContingentReguDirectory />}

          {activeTab === 'competitions' && <CompetitionList />}

          {activeTab === 'judge' && <JudgeScoringInterface />}

          {activeTab === 'attendance' && <AttendanceScanner />}

          {activeTab === 'leaderboard' && <LeaderboardView />}

          {activeTab === 'profile' && <MyProfile />}

          {activeTab === 'templates' && <IdCardDesigner />}

          {activeTab === 'health' && <HealthAndIncidents />}

          {activeTab === 'logistics' && <LogisticsInventory />}
        </>
      )}

      {/* Global QR Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />

      {/* Global Sync Center Modal */}
      <SyncCenterModal
        isOpen={isSyncCenterOpen}
        onClose={() => setIsSyncCenterOpen(false)}
      />

      {/* Production Reauthentication Modal (Section 9) */}
      <ReauthModal />
    </AppLayout>
  );
}
