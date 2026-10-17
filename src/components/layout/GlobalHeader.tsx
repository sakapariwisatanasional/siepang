/**
 * @license
 * SiEpang - Global Header Component
 * Shows workspace/event identity, multi-event switcher, connection state, quick role switch, and user profile.
 */

import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Server,
  UserCheck,
  ChevronDown,
  Sparkles,
  Calendar,
  ShieldAlert,
  Clock,
  Sun,
  Moon,
  Globe,
  X,
  MoreHorizontal,
  LogOut,
  Laptop,
  ShieldCheck,
} from 'lucide-react';
import { TrustedDevicesModal } from './TrustedDevicesModal';
import { authService, AuthState } from '../../services/authService';
import { workspaceService } from '../../services/workspaceService';
import { eventService } from '../../services/eventService';
import { brandingService, AppearanceMode } from '../../services/brandingService';
import { customerBrandingDriveService } from '../../services/customerBrandingDriveService';
import { syncQueue } from '../../offline/syncQueue';
import { syncService } from '../../services/syncService';
import { localCampServerService } from '../../services/localCampServerService';
import { NetworkConnectionState, UserRole, ScoutEvent, LocalServerOperationalMode } from '../../types';
import { OfflineEmergencySession } from '../../offline/types';

interface GlobalHeaderProps {
  onOpenSyncCenter: () => void;
  onOpenScanner?: () => void;
  onNavigatePublic?: () => void;
  onOpenMore?: () => void;
  onLogout?: (forgetDevice?: boolean) => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  onOpenSyncCenter,
  onNavigatePublic,
  onOpenMore,
  onLogout,
}) => {
  const [user, setUser] = useState(authService.getCurrentUser());
  const activeUser = user || {
    id: 'guest',
    name: 'Tamu / Pengunjung',
    role: 'viewer' as UserRole,
    email: 'tamu@siepang.id',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    workspaceId: workspaceService.getCurrentWorkspace().id || '',
    eventId: eventService.getCurrentEvent().id || '',
  };
  const [authState, setAuthState] = useState<AuthState>(authService.getAuthState());
  const [workspace, setWorkspace] = useState(workspaceService.getCurrentWorkspace());
  const [currentEvent, setCurrentEvent] = useState<ScoutEvent>(eventService.getCurrentEvent());
  const [connectionState, setConnectionState] = useState<NetworkConnectionState>(syncQueue.getConnectionState());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [operationalMode, setOperationalMode] = useState<LocalServerOperationalMode>(localCampServerService.getOperationalMode());
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(brandingService.getAppearance());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(brandingService.getResolvedTheme());
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showAppearanceMenu, setShowAppearanceMenu] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  useEffect(() => {
    const unsubBranding = brandingService.subscribe((mode, resolved) => {
      setAppearanceMode(mode);
      setResolvedTheme(resolved);
    });
    return () => unsubBranding();
  }, []);

  useEffect(() => {
    const unsubAuth = authService.subscribe(state => {
      setAuthState(state);
      if (state.user) setUser(state.user);
    });
    const unsubWs = workspaceService.subscribe(() => {
      setWorkspace(workspaceService.getCurrentWorkspace());
    });
    const unsubEv = eventService.subscribe(() => {
      setCurrentEvent(eventService.getCurrentEvent());
    });
    const unsubSync = syncQueue.subscribe((state, count) => {
      setConnectionState(state);
      setPendingSyncCount(count);
    });
    const unsubLocal = localCampServerService.subscribe(() => {
      setOperationalMode(localCampServerService.getOperationalMode());
    });
    const unsubBrandingDrive = customerBrandingDriveService.subscribe(() => {
      // Force update
      setWorkspace({ ...workspaceService.getCurrentWorkspace() });
    });

    return () => {
      unsubAuth();
      unsubWs();
      unsubEv();
      unsubSync();
      unsubLocal();
      unsubBrandingDrive();
    };
  }, []);

  const formatRemainingTime = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Kedaluwarsa';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}j ${mins}m`;
  };


  const localStatus = syncService.getLocalCampStatus();
  const effectiveBranding = customerBrandingDriveService.getEffectiveBranding(
    currentEvent.logoUrl,
    workspace.branding?.logoUrl
  );

  const handleRoleSelect = (role: UserRole) => {
    if (authState.effectiveRoles.includes(role)) {
      authService.switchAssignedRole(role);
    }
    setShowRoleMenu(false);
  };

  const toggleConnectionSimulation = () => {
    if (connectionState === 'online') {
      syncQueue.setConnectionState('offline');
    } else {
      syncQueue.setConnectionState('online');
      syncQueue.processQueue();
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white dark:bg-[#121215] border-b border-[#ECECEF] dark:border-white/10 text-[#171717] dark:text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors">
      {/* Visual Warning for Emergency Offline Credential Mode (Section 7) */}
      {authState.authenticationMode === 'OFFLINE_EMERGENCY' && authState.offlineSession && (
        <div className="bg-amber-950/90 border-b border-amber-500/40 px-3.5 sm:px-6 py-1.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
              <ShieldAlert className="w-3 h-3" />
              Offline Emergency Access
            </span>
            <span className="text-[11px] font-medium hidden sm:inline">
              Peran: <strong className="text-amber-100 uppercase">{authState.offlineSession.role_id}</strong> · Perangkat: <span className="font-mono text-[10px] text-amber-300">{authState.offlineSession.device_id.substring(0, 14)}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-amber-300 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Sisa Sesi: {formatRemainingTime(authState.offlineSession.expires_at)}</span>
            </span>
            <span className="flex items-center gap-1">
              {connectionState === 'online' ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Cloud Aktif
                </span>
              ) : (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> Cloud Terputus
                </span>
              )}
            </span>
            <button
              onClick={() => authService.logoutOfflineEmergency()}
              className="px-2.5 py-0.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-100 border border-amber-500/40 rounded-lg text-[10px] font-bold transition-colors"
              title="Keluar dari Sesi Darurat Offline dan kembali ke sesi normal"
            >
              Keluar Mode Darurat
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 px-3.5 sm:px-6 py-2.5">
        {/* Left Zone: fixed installation identity (single-event mode) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-[#A61B1B] via-[#C62828] to-[#E34848] p-[1.5px] shadow-sm flex items-center justify-center shrink-0">
            <div className="w-full h-full rounded-[10px] bg-white dark:bg-[#121215] flex items-center justify-center font-bold text-xs overflow-hidden">
              {effectiveBranding.appLogoUrl ? (
                <img
                  src={`${effectiveBranding.appLogoUrl}?v=${effectiveBranding.version}`}
                  alt="Logo kegiatan"
                  className="w-full h-full object-contain p-0.5"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                '⚜️'
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-[#171717] dark:text-white truncate max-w-[190px] sm:max-w-[280px]">
              {currentEvent.name || workspace.name || 'SiEpang'}
            </div>
            <div className="text-[10px] font-semibold text-[#A61B1B] dark:text-purple-300 truncate max-w-[200px] sm:max-w-[300px]">
              {workspace.organization || workspace.name || currentEvent.shortName}
            </div>
          </div>
        </div>

        {/* Right Zone: Operational Mode, Status Chip, Theme, Role Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Operational Mode Badge (Cloud / Local Buper / Hybrid Edge) - desktop/tablet only */}
          <button
            onClick={onOpenSyncCenter}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
              operationalMode === 'cloud'
                ? 'bg-blue-950/70 text-blue-300 border-blue-500/30 hover:bg-blue-900/50'
                : operationalMode === 'local'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                : 'bg-purple-950/80 text-purple-300 border-purple-500/40 hover:bg-purple-900/60'
            }`}
            title="Mode Operasional SiEpang (Klik untuk ganti atau konfigurasi Server Buper)"
          >
            <Server className="w-3.5 h-3.5" />
            <span className="capitalize">
              {operationalMode === 'cloud' ? '☁️ Cloud' : operationalMode === 'local' ? '💻 Buper LAN' : '⚡ Hybrid'}
            </span>
          </button>

          {/* Connection Chip with Toggle - desktop/tablet only (hidden on mobile <=430px per Req 116, 145) */}
          <button
            onClick={onOpenSyncCenter}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all border ${
              connectionState === 'online'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/60'
                : connectionState === 'offline'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 hover:bg-amber-900/60'
                : connectionState === 'syncing'
                ? 'bg-sky-950/80 text-sky-300 border-sky-500/40 animate-pulse'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
            }`}
            title="Buka Pusat Sinkronisasi & Local Camp Server"
          >
            {connectionState === 'online' && <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
            {connectionState === 'offline' && <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
            {connectionState === 'syncing' && <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />}
            {connectionState === 'sync_error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
            <span className="capitalize">{connectionState}</span>
            {pendingSyncCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] flex items-center justify-center">
                {pendingSyncCount}
              </span>
            )}
          </button>

          {/* Portal Publik Quick Access: Compact Globe Icon on mobile (<768px), Pill on desktop */}
          {onNavigatePublic && (
            <button
              type="button"
              onClick={onNavigatePublic}
              className="flex items-center justify-center w-11 h-11 md:w-auto md:px-3 md:py-1.5 rounded-xl md:rounded-full text-xs font-semibold bg-gradient-to-r from-[#A61B1B] to-[#C62828] text-white hover:opacity-90 shadow-xs transition-opacity shrink-0 min-w-[44px] min-h-[44px] cursor-pointer"
              title="Portal Publik"
              aria-label="Portal Publik"
            >
              <Globe className="w-5 h-5 md:w-3.5 md:h-3.5" />
              <span className="hidden md:inline md:ml-1.5">Portal Publik</span>
            </button>
          )}

          {/* Quick Role Switcher / Profile Button: Avatar-only on mobile */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 p-1 rounded-xl bg-white hover:bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 transition-colors min-h-[44px] min-w-[44px] justify-center cursor-pointer shadow-2xs"
              title={`Profil: ${activeUser.name} (${activeUser.role.replace('_', ' ')})`}
              aria-label="Profil Pengguna & Mode Peran"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-[#ECECEF] dark:border-white/20 shrink-0">
                <img
                  src={activeUser.avatar}
                  alt={activeUser.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="hidden lg:block text-left pr-1">
                <div className="text-xs font-semibold text-[#171717] dark:text-white leading-none max-w-[100px] truncate">{activeUser.name.split(' ')[0]}</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 capitalize">{activeUser.role.replace('_', ' ')}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
            </button>

            {/* Desktop Popover (md+) */}
            {showRoleMenu && (
              <div className="hidden md:block">
                <div className="fixed inset-0 z-40" onClick={() => setShowRoleMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 space-y-2">
                  <div className="px-2 py-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Mode Tampilan Peran</span>
                    </span>
                  </div>

                  {/* Theme Switcher inside Profile Popover (Req 119) */}
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Tema:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => brandingService.setAppearance('light')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          appearanceMode === 'light'
                            ? 'bg-white dark:bg-[#2A2A2E] text-amber-500 shadow-xs'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                        }`}
                        title="Mode Terang"
                        aria-label="Mode Terang"
                      >
                        <Sun className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => brandingService.setAppearance('dark')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          appearanceMode === 'dark'
                            ? 'bg-white dark:bg-[#2A2A2E] text-purple-400 shadow-xs'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                        }`}
                        title="Mode Gelap"
                        aria-label="Mode Gelap"
                      >
                        <Moon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Assigned Multi-Roles List */}
                  {authState.effectiveRoles.length > 1 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                        Pilih Peran Aktif:
                      </div>
                      {authState.effectiveRoles.map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => handleRoleSelect(r)}
                          className={`w-full text-left p-2 rounded-xl transition-colors cursor-pointer ${
                            activeUser.role === r
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-semibold border border-purple-200/50'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="text-xs font-semibold flex items-center justify-between capitalize">
                            <span>{r.replace('_', ' ')}</span>
                            {activeUser.role === r && <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dev Mode Role Simulator - Excluded in Production */}
                  {!import.meta.env.PROD && (
                    <div className="pt-1.5 border-t border-slate-100 dark:border-white/5 space-y-1">
                      <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider px-1">
                        Simulasi Peran Dev:
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-0.5">
                        {[
                          { role: 'participant', label: 'Peserta Kemah' },
                          { role: 'committee', label: 'Panitia Lapangan' },
                          { role: 'judge', label: 'Dewan Juri' },
                          { role: 'registration_officer', label: 'Petugas Registrasi' },
                          { role: 'attendance_officer', label: 'Petugas Presensi' },
                          { role: 'health_officer', label: 'Petugas Medis / P3K' },
                          { role: 'logistic_officer', label: 'Petugas Logistik' },
                          { role: 'event_admin', label: 'Admin Event Buper' },
                          { role: 'workspace_admin', label: 'Admin Kwartir' },
                          { role: 'superadmin', label: 'SuperAdmin Hub' },
                        ].map(item => (
                          <button
                            key={item.role}
                            type="button"
                            onClick={() => handleRoleSelect(item.role as UserRole)}
                            className={`w-full text-left px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                              activeUser.role === item.role
                                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 font-semibold'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                          >
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#ECECEF] dark:border-white/10 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRoleMenu(false);
                        setShowDevicesModal(true);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Laptop className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Keamanan & Perangkat</span>
                      </div>
                      <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    </button>

                    {onLogout && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRoleMenu(false);
                            onLogout(false);
                          }}
                          className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Keluar dari sesi ini namun simpan status perangkat terpercaya"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Keluar (Sesi Ini)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowRoleMenu(false);
                            onLogout(true);
                          }}
                          className="w-full flex items-center justify-center gap-2 p-1.5 rounded-xl text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                          title="Keluar dan cabut status perangkat terpercaya (memerlukan OTP pada login berikutnya)"
                        >
                          <span>Keluar & Lupakan Perangkat</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* More Action Button on Mobile: Ellipsis Icon (Requirements 116, 121, 145, 147, 196) */}
          {onOpenMore && (
            <button
              type="button"
              onClick={onOpenMore}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-white hover:bg-[#FAFAFA] text-[#171717] dark:text-slate-300 dark:bg-white/5 transition-colors border border-[#ECECEF] dark:border-white/10 shrink-0 min-w-[40px] min-h-[40px] cursor-pointer shadow-2xs"
              title="Menu Lainnya"
              aria-label="Menu Lainnya"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Role Switcher & Profile Sheet: BOTTOM SHEET (<md) (Requirements 56-59, 119, 120, 127) */}
      {showRoleMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setShowRoleMenu(false)}
          />

          {/* Bottom Sheet Modal */}
          <div className="relative w-full max-h-[82dvh] bg-white dark:bg-[#1A1A1E] rounded-t-[32px] border-t border-[#ECECEF] dark:border-white/10 shadow-2xl p-4 pb-8 flex flex-col z-50 animate-in slide-in-from-bottom duration-200 safe-bottom text-[#171717]">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-[#ECECEF] dark:border-white/20 shrink-0">
                  <img
                    src={activeUser.avatar}
                    alt={activeUser.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#171717] dark:text-white leading-tight">{activeUser.name}</h3>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 capitalize">{activeUser.role.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleMenu(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Tutup"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Theme Control Bar inside Profile Sheet (Req 119) */}
            <div className="p-2.5 mb-2 rounded-2xl bg-slate-50 dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mode Tema</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => brandingService.setAppearance('light')}
                  className={`p-2 rounded-xl flex items-center gap-1.5 text-xs transition-colors min-h-[36px] ${
                    appearanceMode === 'light'
                      ? 'bg-white dark:bg-[#2A2A2E] text-amber-500 font-bold shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                  title="Mode Terang"
                  aria-label="Mode Terang"
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="text-[11px]">Terang</span>
                </button>
                <button
                  type="button"
                  onClick={() => brandingService.setAppearance('dark')}
                  className={`p-2 rounded-xl flex items-center gap-1.5 text-xs transition-colors min-h-[36px] ${
                    appearanceMode === 'dark'
                      ? 'bg-white dark:bg-[#2A2A2E] text-purple-400 font-bold shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                  title="Mode Gelap"
                  aria-label="Mode Gelap"
                >
                  <Moon className="w-4 h-4 text-purple-400" />
                  <span className="text-[11px]">Gelap</span>
                </button>
              </div>
            </div>

            {/* Assigned Multi-Roles List */}
            {authState.effectiveRoles.length > 1 && (
              <div className="space-y-1.5 mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Pilih Peran Aktif:
                </div>
                {authState.effectiveRoles.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleSelect(r)}
                    className={`w-full text-left p-3 rounded-2xl transition-all border cursor-pointer ${
                      activeUser.role === r
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-500/50 text-purple-900 dark:text-purple-200 shadow-xs'
                        : 'bg-slate-50 dark:bg-white/5 border-[#ECECEF] dark:border-transparent text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between capitalize">
                      <span className="text-xs font-bold">{r.replace('_', ' ')}</span>
                      {activeUser.role === r && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">Aktif</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}


              <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleMenu(false);
                    setShowDevicesModal(true);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white font-bold text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Keamanan & Perangkat</span>
                  </div>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                </button>

                {onLogout && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRoleMenu(false);
                        onLogout(false);
                      }}
                      className="w-full py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar (Sesi Ini)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowRoleMenu(false);
                        onLogout(true);
                      }}
                      className="w-full py-1.5 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      Keluar & Lupakan Perangkat
                    </button>
                  </>
                )}
              </div>

            <button
              type="button"
              onClick={() => setShowRoleMenu(false)}
              className="mt-2 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Trusted Devices Modal */}
      <TrustedDevicesModal
        isOpen={showDevicesModal}
        onClose={() => setShowDevicesModal(false)}
      />
    </header>
  );
};
