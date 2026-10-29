/**
 * @license
 * SiEpang - Categorized Mobile More Menu Bottom Sheet (Requirement 33)
 * Provides organized, clean progressive disclosure for secondary modules on narrow screens.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Trophy,
  Image as ImageIcon,
  Users,
  CreditCard,
  Stethoscope,
  Boxes,
  Globe,
  Sliders,
  UserCheck,
  Database,
  Award,
  LayoutDashboard,
  MonitorPlay,
  Sun,
  Moon,
  Sparkles,
  Zap,
  LogOut,
} from 'lucide-react';
import { NavTab } from './MobileNavigation';
import { featureControlService } from '../../services/featureControlService';
import { brandingService, AppearanceMode } from '../../services/brandingService';

interface MobileMoreMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  role: string;
  onLogout?: () => void;
}

interface MoreMenuItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string;
  adminOnly?: boolean;
  roles?: string[];
}

interface MoreMenuGroup {
  title: string;
  items: MoreMenuItem[];
}

export const MobileMoreMenuSheet: React.FC<MobileMoreMenuSheetProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  role,
  onLogout,
}) => {
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(brandingService.getAppearance());
  const [search, setSearch] = useState('');
  const [, setFeatureRevision] = useState(0);

  useEffect(() => featureControlService.subscribe(() => setFeatureRevision(v => v + 1)), []);
  useEffect(() => {
    if (isOpen) setSearch('');
  }, [isOpen]);

  useEffect(() => {
    const unsub = brandingService.subscribe(mode => {
      setAppearanceMode(mode);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const isParticipant = role === 'participant' || role === 'viewer';
  const isAdminOrStaff = !isParticipant;

  // Participant categorized menu (Requirement 33)
  const participantGroups: MoreMenuGroup[] = [
    {
      title: 'Akun & Identitas',
      items: [
        { id: 'profile', label: 'Profil Saya', icon: Award },
        { id: 'leaderboard', label: 'Peringkat & XP Saya', icon: Zap, feature: 'POINTS_XP' },
      ],
    },
    {
      title: 'Kegiatan & Lomba',
      items: [
        { id: 'schedule', label: 'Jadwal Lengkap Kegiatan', icon: Calendar, feature: 'SCHEDULE' },
        { id: 'competitions', label: 'Cabang Lomba & Voting', icon: Trophy, feature: 'COMPETITION' },
        { id: 'public_gallery', label: 'Galeri Foto Dokumentasi', icon: ImageIcon, feature: 'PUBLIC_DOCUMENTATION' },
      ],
    },
    {
      title: 'Informasi Publik',
      items: [
        { id: 'public_home', label: 'Portal Informasi Event', icon: Globe, feature: 'PUBLIC_EVENT_PAGE' },
      ],
    },
  ];

  // Staff / Admin categorized menu (Requirement 33)
  const staffGroups: MoreMenuGroup[] = [
    {
      title: 'Kegiatan',
      items: [
        { id: 'participants', label: 'Data Peserta & Berkas', icon: Users, feature: 'PARTICIPANT_MANAGEMENT' },
        { id: 'gudep_attendance', label: 'Kehadiran Kontingen / Gudep', icon: Users, roles: ['superadmin', 'workspace_admin', 'event_admin', 'registration_officer', 'kontingen_admin'] },
        { id: 'contingent_regus', label: 'Data Kontingen per Gudep', icon: Users, roles: ['superadmin', 'workspace_admin', 'event_admin', 'registration_officer', 'kontingen_admin'] },
        { id: 'schedule', label: 'Jadwal & Agenda', icon: Calendar, feature: 'SCHEDULE' },
        { id: 'competitions', label: 'Lomba & Penjurian', icon: Trophy, feature: 'COMPETITION' },
      ],
    },
    {
      title: 'Operasional',
      items: [
        { id: 'event_studio', label: 'Pengaturan Event', icon: Sliders, adminOnly: true },
        { id: 'health', label: 'Posko Medis & P3K', icon: Stethoscope, feature: 'HEALTH' },
        { id: 'logistics', label: 'Gudang Logistik', icon: Boxes, feature: 'LOGISTICS' },
      ],
    },
    {
      title: 'Publikasi & Dokumen',
      items: [
        { id: 'public_gallery', label: 'Galeri Liputan', icon: ImageIcon, feature: 'PUBLIC_DOCUMENTATION' },
        { id: 'gallery_admin' as NavTab, label: 'Manajemen Galeri', icon: ImageIcon, feature: 'PUBLIC_DOCUMENTATION' },
        { id: 'templates', label: 'ID Card & Sertifikat', icon: CreditCard, feature: 'ID_CARD' },
      ],
    },
    {
      title: 'Sistem & Konfigurasi',
      items: [
        { id: 'profile', label: 'Profil Saya', icon: Award },
        { id: 'admin_dashboard', label: 'Ringkasan Admin', icon: LayoutDashboard, adminOnly: true },
        { id: 'demo_center' as NavTab, label: 'Pusat Demonstrasi', icon: MonitorPlay, adminOnly: true },
        { id: 'database_storage', label: 'Database Spreadsheet', icon: Database, adminOnly: true },
        { id: 'branding_settings', label: 'Branding & Tampilan', icon: Sparkles, adminOnly: true },
        { id: 'users', label: 'Akses Panitia', icon: UserCheck, adminOnly: true },
      ],
    },
  ];

  const currentGroups = isParticipant ? participantGroups : staffGroups;
  const isStaffAdmin = ['superadmin', 'workspace_admin', 'event_admin'].includes(role);
  const isGalleryManager = [...['superadmin', 'workspace_admin', 'event_admin', 'publication_officer', 'documentation_officer']].includes(role);

  // Filter items through feature control and RBAC permissions
  const filteredGroups = currentGroups
    .map(grp => ({
      ...grp,
      items: grp.items.filter(item => {
        if (item.id === ('gallery_admin' as NavTab) && !isGalleryManager) {
          return false;
        }
        if (item.adminOnly && !isStaffAdmin) {
          return false;
        }
        if (item.roles && !item.roles.includes(role)) {
          return false;
        }
        if (item.feature) {
          return featureControlService.isFeatureEnabled(item.feature as any);
        }
        return true;
      }),
    }))
    .map(grp => ({
      ...grp,
      items: grp.items.filter(item => `${item.label} ${grp.title}`.toLocaleLowerCase('id').includes(search.trim().toLocaleLowerCase('id'))),
    }))
    .filter(grp => grp.items.length > 0);

  const toggleTheme = () => {
    const next = appearanceMode === 'dark' ? 'light' : 'dark';
    brandingService.setAppearance(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm" onClick={onClose} role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Menu fitur SiEpang" onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-[#141418] rounded-t-[28px] border-t border-slate-200 dark:border-white/10 shadow-2xl max-h-[88dvh] flex flex-col">
        {/* Header Handle */}
        <div className="p-4 pb-2 border-b border-[#ECECEF] dark:border-white/10 flex items-center justify-between">
          <div className="w-10 h-1 bg-slate-200 dark:bg-white/20 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2.5" />
          <div>
            <h3 className="text-sm font-black text-[#171717] dark:text-white">Menu Lengkap</h3>
            <p className="text-[11px] text-slate-500">Pilih modul yang ingin diakses</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:text-black dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <label htmlFor="siepang-mobile-menu-search" className="sr-only">Cari fitur</label>
          <input
            id="siepang-mobile-menu-search"
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari halaman atau fitur..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>
        {/* Kategori dan kartu navigasi halaman, bukan anchor scroll. */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(24px,env(safe-area-inset-bottom))] space-y-4">
          {filteredGroups.map(grp => (
            <div key={grp.title} className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                {grp.title}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {grp.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id + item.label}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose();
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={`Buka halaman ${item.label}`}
                      className={`min-h-[96px] p-3 rounded-2xl border text-left flex flex-col justify-between items-start gap-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                        isActive
                          ? 'bg-[#208C60]/10 border-[#208C60]/30 text-[#208C60] dark:text-[#F47743] font-bold'
                          : 'bg-slate-50 dark:bg-white/5 border-[#ECECEF] dark:border-white/5 text-[#171717] dark:text-white hover:border-[#208C60]/30'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                        <Icon className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <span className="text-xs font-semibold leading-snug line-clamp-2">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300" role="status">
              Tidak ada fitur yang sesuai pencarian atau izin akun Anda.
            </div>
          )}
          {/* Theme Switcher Row */}
          <div className="pt-2 border-t border-[#ECECEF] dark:border-white/5 flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Tema Tampilan
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
            >
              {appearanceMode === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-purple-400" />
                  <span>Mode Gelap</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Mode Terang</span>
                </>
              )}
            </button>
          </div>

          {/* Logout Action (Req 15) */}
          {onLogout && (
            <div className="pt-2 border-t border-[#ECECEF] dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200/50 dark:border-rose-900/40 active:scale-98 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 stroke-[2]" />
                <span>Keluar / Ganti Akun</span>
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
