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
    { id: 'profile' as NavTab, label: 'Profil Saya', description: 'Biodata & foto', icon: UserRound, roles: null, feature: null },
    { id: 'schedule' as NavTab, label: 'Jadwal Kegiatan', description: 'Agenda perkemahan', icon: CalendarDays, roles: null, feature: 'SCHEDULE' as const },
    { id: 'competitions' as NavTab, label: 'Lomba', description: 'Cabang & informasi', icon: Trophy, roles: null, feature: 'COMPETITION' as const },
    { id: 'public_home' as NavTab, label: 'Portal Kegiatan', description: 'Informasi publik', icon: Globe2, roles: null, feature: 'PUBLIC_EVENT_PAGE' as const },
    { id: 'public_gallery' as NavTab, label: 'Galeri', description: 'Dokumentasi acara', icon: Images, roles: null, feature: 'PUBLIC_DOCUMENTATION' as const },
    { id: 'participants' as NavTab, label: 'Data Peserta', description: 'Registrasi & verifikasi', icon: UsersRound, roles: registrationRoles, feature: 'PARTICIPANT_MANAGEMENT' as const },
    { id: 'attendance' as NavTab, label: 'Presensi', description: 'Kehadiran peserta', icon: ClipboardList, roles: [...allRoles, 'committee', 'attendance_officer'], feature: 'ATTENDANCE' as const },
    { id: 'event_studio' as NavTab, label: 'Kelola Event', description: 'Denah, kavling & fasilitas', icon: Map, roles: allRoles, feature: null },
    { id: 'users' as NavTab, label: 'Akses Panitia', description: 'Peran & izin akses', icon: ShieldCheck, roles: ['superadmin', 'workspace_admin'], feature: null },
  ].filter(action => (!action.roles || action.roles.includes(role)) && (!action.feature || featureControlService.isFeatureEnabled(action.feature)));

  if (isPublicView) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F7F8] dark:bg-[#0E0E12] text-[#171717] dark:text-slate-100 transition-colors">
        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F8] dark:bg-[#0E0E12] text-[#171717] dark:text-slate-100 transition-colors">
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
              <section aria-label="Akses cepat fitur SiEpang" className="mb-7">
                <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-semibold tracking-widest uppercase text-emerald-700 dark:text-emerald-400 mb-1">Navigasi Cepat</p>
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <LayoutGrid className="w-5 h-5" aria-hidden="true" /> Jelajahi SiEpang
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Akses menu sesuai peran dan fitur yang tersedia.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {actions.map(({ id, label, description, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onTabChange(id)}
                      className="group text-left min-h-[122px] rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#191b23] p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-emerald-300 dark:hover:border-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                          <Icon className="w-5 h-5" aria-hidden="true" />
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-slate-400 opacity-50 group-hover:opacity-100" aria-hidden="true" />
                      </div>
                      <span className="block font-bold text-sm text-slate-900 dark:text-white leading-snug">{label}</span>
                      <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400 leading-snug">{description}</span>
                    </button>
                  ))}
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
