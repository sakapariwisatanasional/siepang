/**
 * SiEpang — navigasi bawah mobile berbasis halaman.
 * Sumber izin fitur: featureControlService (GAS-backed).
 * Seluruh perpindahan halaman diteruskan melalui onTabChange dari App.tsx.
 */
import React, { useEffect, useState } from 'react';
import { Home, CalendarDays, QrCode, Trophy, UserRound, Images, Medal, MoreHorizontal, ClipboardList } from 'lucide-react';
import { featureControlService } from '../../services/featureControlService';
import { MobileMoreMenuSheet } from './MobileMoreMenuSheet';

export type NavTab =
  | 'home' | 'schedule' | 'leaderboard' | 'profile' | 'participants'
  | 'competitions' | 'admin_dashboard' | 'superadmin' | 'organizations'
  | 'users' | 'judge' | 'attendance' | 'health' | 'logistics'
  | 'templates' | 'event_studio' | 'branding_settings'
  | 'database_storage' | 'installation' | 'system_update'
  | 'public_home' | 'public_gallery' | 'bootstrap';

interface MobileNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenScanner: () => void;
  role: string;
  isMoreMenuOpen?: boolean;
  onToggleMoreMenu?: (open: boolean) => void;
  onLogout?: () => void;
}

type NavItem = {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeTab, onTabChange, onOpenScanner, role,
  isMoreMenuOpen: controlledMoreOpen, onToggleMoreMenu, onLogout,
}) => {
  const [internalMoreOpen, setInternalMoreOpen] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    return featureControlService.subscribe(() => setRevision(v => v + 1));
  }, []);

  const isMoreMenuOpen = controlledMoreOpen !== undefined
    ? controlledMoreOpen : internalMoreOpen;
  const setMoreMenuOpen = (open: boolean) => {
    setInternalMoreOpen(open);
    onToggleMoreMenu?.(open);
  };

  const isParticipant = role === 'participant' || role === 'viewer';
  // Feature Control dapat berubah setelah data GAS selesai dimuat.
  void revision;
  const enabled = (key: string) => featureControlService.isFeatureEnabled(key as any);

  const available: NavItem[] = [
    ...(enabled('SCHEDULE') ? [{ id: 'schedule' as NavTab, label: 'Jadwal', icon: CalendarDays }] : []),
    // Bottom-navigation shortcut: replace Lomba with Peringkat / Points.
    // Lomba remains available in MobileMoreMenuSheet.
    ...(enabled('POINTS_XP') ? [{ id: 'leaderboard' as NavTab, label: 'Peringkat', icon: Medal }] : []),
    ...(enabled('PUBLIC_DOCUMENTATION') ? [{ id: 'public_gallery' as NavTab, label: 'Galeri', icon: Images }] : []),
    ...(!isParticipant && enabled('PARTICIPANT_MANAGEMENT')
      ? [{ id: 'participants' as NavTab, label: 'Peserta', icon: ClipboardList }] : []),
  ];
  const primary = available[0] ?? { id: 'profile' as NavTab, label: 'Profil', icon: UserRound };
  const secondary = available.find(item => item.id !== primary.id)
    ?? { id: 'profile' as NavTab, label: 'Profil', icon: UserRound };

  const navigate = (tab: NavTab) => {
    setMoreMenuOpen(false);
    if (tab !== activeTab) onTabChange(tab);
  };

  const navButton = (item: NavItem) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => navigate(item.id)}
        aria-label={`Buka halaman ${item.label}`}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828] ${active
          ? 'bg-red-50 text-[#A61B1B] dark:bg-red-950/40 dark:text-red-200'
          : 'text-slate-500 dark:text-slate-400 hover:text-[#A61B1B]'}`}
      >
        <Icon className="h-5 w-5" />
        <span className="max-w-full truncate text-[10px] font-semibold">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav
        aria-label="Navigasi utama seluler"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.07)] backdrop-blur-xl dark:border-white/10 dark:bg-[#121215]/95"
      >
        <div className="mx-auto grid h-14 max-w-lg grid-cols-5 items-center gap-1">
          {navButton({ id: 'home', label: 'Beranda', icon: Home })}
          {navButton(primary)}
          <button
            type="button"
            onClick={() => { setMoreMenuOpen(false); onOpenScanner(); }}
            aria-label="Buka pemindai QR"
            className="mx-auto flex h-12 w-12 -translate-y-2 items-center justify-center rounded-2xl bg-[#C62828] text-white shadow-lg shadow-red-900/20 transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C62828]"
          >
            <QrCode className="h-6 w-6" />
          </button>
          {navButton(secondary)}
          <button
            type="button"
            onClick={() => setMoreMenuOpen(true)}
            aria-label="Buka menu fitur lainnya"
            aria-expanded={isMoreMenuOpen}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C62828] ${isMoreMenuOpen
              ? 'bg-red-50 text-[#A61B1B] dark:bg-red-950/40 dark:text-red-200'
              : 'text-slate-500 dark:text-slate-400'}`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Lainnya</span>
          </button>
        </div>
      </nav>
      <MobileMoreMenuSheet
        isOpen={isMoreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
        activeTab={activeTab}
        onSelectTab={navigate}
        role={role}
        onLogout={onLogout}
      />
    </>
  );
};
