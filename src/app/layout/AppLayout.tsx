/**
 * @license
 * SiEpang - Main Responsive App Layout Shell
 * Integrates GlobalHeader, DesktopSidebar, MobileNavigation, and GlobalFooter.
 */

import React from 'react';
import { CalendarDays, ClipboardList, Globe2, Map, ShieldCheck, UserRound, UsersRound, Trophy, Images, LayoutGrid, ArrowUpRight } from 'lucide-react';
import { featureControlService } from '../../services/featureControlService';
import { GlobalHeader } from '../../components/layout/GlobalHeader';
import { DesktopSidebar } from '../../components/navigation/DesktopSidebar';
import { MobileNavigation, NavTab } from '../../components/navigation/MobileNavigation';
import { GlobalFooter } from '../../components/layout/GlobalFooter';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  role: string;
  onOpenScanner: () => void;
  onOpenSyncCenter: () => void;
  onLogout?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  role,
  onOpenScanner,
  onOpenSyncCenter,
  onLogout,
}) => {
  const [isMobileMoreOpen, setIsMobileMoreOpen] = React.useState(false);
  const isPublicView = activeTab === 'public_home' || activeTab === 'public_gallery';

  // Navigation cards are shortcuts, never an authorization boundary.
  // Preserve existing App.tsx route guards, and do not expose disabled features.
  const allRoles = ['superadmin', 'workspace_admin', 'event_admin'];
  const registrationRoles = [...allRoles, 'registration_officer', 'kontingen_admin'];
  const actions = [
    { id: 'profile' as NavTab, group: 'Akun & akses', label: 'Profil Saya', description: 'Biodata & foto', icon: UserRound, roles: null, feature: null },
    { id: 'schedule' as NavTab, group: 'Kegiatan & informasi', label: 'Jadwal Kegiatan', description: 'Agenda perkemahan', icon: CalendarDays, roles: null, feature: 'SCHEDULE' as const },
    { id: 'competitions' as NavTab, group: 'Kegiatan & informasi', label: 'Lomba', description: 'Cabang & informasi', icon: Trophy, roles: null, feature: 'COMPETITION' as const },
    { id: 'public_home' as NavTab, group: 'Kegiatan & informasi', label: 'Portal Kegiatan', description: 'Informasi publik', icon: Globe2, roles: null, feature: 'PUBLIC_EVENT_PAGE' as const },
    { id: 'public_gallery' as NavTab, group: 'Kegiatan & informasi', label: 'Galeri', description: 'Dokumentasi acara', icon: Images, roles: null, feature: 'PUBLIC_DOCUMENTATION' as const },
    { id: 'participants' as NavTab, group: 'Operasional perkemahan', label: 'Data Peserta', description: 'Registrasi & verifikasi', icon: UsersRound, roles: registrationRoles, feature: 'PARTICIPANT_MANAGEMENT' as const },
    { id: 'attendance' as NavTab, group: 'Operasional perkemahan', label: 'Presensi', description: 'Kehadiran peserta', icon: ClipboardList, roles: [...allRoles, 'committee', 'attendance_officer'], feature: 'ATTENDANCE' as const },
    { id: 'event_studio' as NavTab, group: 'Operasional perkemahan', label: 'Kelola Event', description: 'Denah, kavling & fasilitas', icon: Map, roles: allRoles, feature: null },
    { id: 'users' as NavTab, group: 'Akun & akses', label: 'Akses Panitia', description: 'Peran & izin akses', icon: ShieldCheck, roles: ['superadmin', 'workspace_admin'], feature: null },
  ].filter(action => (!action.roles || action.roles.includes(role)) && (!action.feature || featureControlService.isFeatureEnabled(action.feature)));

  if (isPublicView) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FFF8F7] dark:bg-[#0E0E12] text-[#1F1F1F] dark:text-slate-100 transition-colors">
        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF8F7] dark:bg-[#0E0E12] text-[#1F1F1F] dark:text-slate-100 transition-colors">
      {/* Top Header */}
      <GlobalHeader
        onOpenScanner={onOpenScanner}
        onOpenSyncCenter={onOpenSyncCenter}
        onNavigateProfile={() => onTabChange('profile')}
        onNavigatePublic={() => onTabChange('public_home')}
        onOpenMore={() => setIsMobileMoreOpen(true)}
        onLogout={onLogout}
      />

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 flex w-full">
        {/* Desktop Collapsible Sidebar */}
        <DesktopSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          role={role}
          onOpenScanner={onOpenScanner}
          onLogout={onLogout}
        />

        {/* Primary Content Viewport */}
        <main className="flex-1 flex flex-col min-w-0 p-3 sm:p-5 lg:p-8 pb-24 md:pb-8 overflow-x-hidden">
          <div className="flex-1 w-full max-w-7xl mx-auto min-w-0">
            {activeTab === 'home' && (
              <section aria-label="Akses cepat fitur SiEpang" className="mb-7 space-y-5">
                <div className="relative isolate min-h-[218px] sm:min-h-[250px] overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#8F1515] via-[#C62828] to-[#E34848] px-5 py-6 sm:px-8 sm:py-8 text-white shadow-lg shadow-red-900/15">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.10]">
                    <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white" />
                    <div className="absolute right-24 -bottom-24 h-52 w-52 rounded-full border-[18px] border-white" />
                  </div>
                  <img
                    src="/assets/si-epang-maskot.png"
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-3 -bottom-7 hidden h-[275px] w-auto select-none object-contain drop-shadow-xl sm:block md:right-5 md:h-[300px]"
                  />
                  <img
                    src="/assets/si-epang-maskot.png"
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-8 bottom-[-18px] h-[174px] w-auto select-none object-contain opacity-35 drop-shadow-lg sm:hidden"
                  />
                  <div className="relative z-10 max-w-[min(100%,34rem)] pr-10 sm:pr-36 md:pr-40">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-red-100">Sistem Informasi Perkemahan dan Kegiatan</p>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Halo, Pramuka!</h1>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold leading-tight text-white">Satu Semangat, Satu Perkemahan, Sejuta Pengalaman.</p>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-red-50">Kelola pendaftaran, data peserta, penempatan kavling, dan operasional kegiatan dari satu tempat.</p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                      <span className="h-2 w-2 rounded-full bg-white" /> Menu tampil sesuai hak akses Anda
                    </div>
                  </div>
                </div>
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold tracking-[0.14em] uppercase text-[#B91C1C] dark:text-red-300 mb-1">Mulai dari sini</p>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <LayoutGrid className="w-5 h-5 text-[#C62828]" aria-hidden="true" /> Menu SiEpang
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Pilih salah satu kartu. Menu yang tersedia menyesuaikan peran dan akses Anda.</p>
                  </div>
                </div>
                <div className="space-y-6">
                  {(['Operasional perkemahan', 'Kegiatan & informasi', 'Akun & akses'] as const).map((group) => {
                    const groupActions = actions.filter((action) => action.group === group);
                    if (groupActions.length === 0) return null;
                    return (
                      <section key={group} aria-label={group} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{group}</h3>
                          <span className="h-px flex-1 bg-red-100 dark:bg-white/10" />
                          <span className="text-[11px] font-semibold text-slate-400">{groupActions.length} menu</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {groupActions.map(({ id, label, description, icon: Icon }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => onTabChange(id)}
                              className="group flex min-h-[96px] items-center gap-3 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#191b23] p-4 text-left shadow-sm hover:border-red-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C62828] transition-all"
                            >
                              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40 text-[#B91C1C] dark:text-red-300 ring-1 ring-red-100 dark:ring-red-900/40">
                                <Icon className="h-5 w-5" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-bold text-sm text-slate-900 dark:text-white leading-snug">{label}</span>
                                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400 leading-snug">{description}</span>
                              </span>
                              <ArrowUpRight className="h-4 w-4 shrink-0 text-[#C62828] opacity-45 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </section>
            )}
            {children}
          </div>

          {/* Reusable Global Footer */}
          <div className="hidden md:block mt-8">
            <GlobalFooter />
          </div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (Part 7, 8, 9) */}
      <MobileNavigation
        activeTab={activeTab}
        onTabChange={onTabChange}
        onOpenScanner={onOpenScanner}
        role={role}
        isMoreMenuOpen={isMobileMoreOpen}
        onToggleMoreMenu={setIsMobileMoreOpen}
        onLogout={onLogout}
      />
    </div>
  );
};
