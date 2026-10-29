/**
 * SiEpang — Desktop Sidebar with Demo Center
 * Route demo_center is enabled only for superadmin/workspace_admin/event_admin.
 * Builds upon the latest Galeri Admin sidebar; no changes to data services or GAS.
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Trophy,
  Zap,
  Medal,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Boxes,
  QrCode,
  Sliders,
  FolderTree,
  UserCheck,
  UserRound,
  Globe,
  Image as ImageIcon,
  Database,
  Sparkles,
  MonitorPlay,
  ArrowUpCircle,
  Tent,
  FileText,
  Building2,
  LogOut,
  Search,
  X,
} from 'lucide-react';
import { NavTab } from './MobileNavigation';
import { GlobalFooter } from '../layout/GlobalFooter';
import { featureControlService } from '../../services/featureControlService';
import { SystemFeatureKey } from '../../types';

interface DesktopSidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  role: string;
  onOpenScanner: () => void;
  onLogout?: () => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  featureKey?: SystemFeatureKey;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
  role,
  onOpenScanner,
  onLogout,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = featureControlService.subscribe(() => setTick(t => t + 1));
    return () => unsub();
  }, []);

  const navGroups: NavGroup[] = [
    {
      id: 'utama',
      label: 'Utama',
      items: [
        {
          id: 'home',
          label: 'Dashboard Event',
          icon: LayoutDashboard,
          roles: ['all'],
        },
        {
          id: 'public_home',
          label: 'Portal Publik',
          icon: Globe,
          roles: ['all'],
          featureKey: 'PUBLIC_EVENT_PAGE',
        },
      ],
    },
    {
      id: 'kegiatan',
      label: 'Kegiatan',
      items: [
        {
          id: 'participants',
          label: 'Data Peserta',
          icon: Users,
          roles: ['workspace_admin', 'event_admin', 'kontingen_admin', 'registration_officer', 'superadmin'],
          featureKey: 'PARTICIPANT_MANAGEMENT',
        },
        {
          id: 'contingent_regus' as NavTab,
          label: 'Data Kontingen per Gudep',
          icon: Users,
          roles: ['superadmin', 'workspace_admin', 'event_admin', 'registration_officer', 'kontingen_admin'],
        },
        {
          id: 'schedule',
          label: 'Jadwal Giat',
          icon: Calendar,
          roles: ['all'],
          featureKey: 'SCHEDULE',
        },
        {
          id: 'attendance',
          label: 'Presensi Scan',
          icon: QrCode,
          roles: ['attendance_officer', 'workspace_admin', 'event_admin', 'committee', 'superadmin'],
          featureKey: 'ATTENDANCE',
        },
      ],
    },
    {
      id: 'lomba',
      label: 'Lomba & Prestasi',
      items: [
        {
          id: 'competitions',
          label: 'Cabang Lomba',
          icon: Trophy,
          roles: ['all'],
          featureKey: 'COMPETITION',
        },
        {
          id: 'judge',
          label: 'Penjurian Juri',
          icon: Medal,
          roles: ['judge', 'workspace_admin', 'event_admin', 'superadmin'],
          featureKey: 'JUDGING',
        },
        {
          id: 'leaderboard',
          label: 'Peringkat & XP',
          icon: Zap,
          roles: ['all'],
          featureKey: 'POINTS_XP',
        },
      ],
    },
    {
      id: 'operasional',
      label: 'Operasional',
      items: [
        {
          id: 'event_studio',
          label: 'Pengaturan Event',
          icon: Sliders,
          roles: ['workspace_admin', 'event_admin', 'superadmin'],
        },
        {
          id: 'health',
          label: 'Posko Medis',
          icon: Stethoscope,
          roles: ['health_officer', 'workspace_admin', 'superadmin'],
          featureKey: 'HEALTH',
        },
        {
          id: 'logistics',
          label: 'Logistik Tenda',
          icon: Boxes,
          roles: ['logistic_officer', 'workspace_admin', 'superadmin'],
          featureKey: 'LOGISTICS',
        },
      ],
    },
    {
      id: 'publikasi',
      label: 'Publikasi',
      items: [
        {
          id: 'public_gallery',
          label: 'Galeri Liputan',
          icon: ImageIcon,
          roles: ['all'],
          featureKey: 'PUBLIC_DOCUMENTATION',
        },
        {
          id: 'gallery_admin' as NavTab,
          label: 'Manajemen Galeri',
          icon: ImageIcon,
          roles: ['superadmin', 'workspace_admin', 'event_admin', 'publication_officer', 'documentation_officer'],
          featureKey: 'PUBLIC_DOCUMENTATION',
        },
      ],
    },
    {
      id: 'dokumen',
      label: 'Dokumen',
      items: [
        {
          id: 'templates',
          label: 'ID Card & Sertifikat',
          icon: CreditCard,
          roles: ['workspace_admin', 'event_admin', 'registration_officer', 'superadmin'],
          featureKey: 'ID_CARD',
        },
      ],
    },
    {
      id: 'sistem',
      label: 'Sistem',
      items: [
        {
          id: 'profile',
          label: 'Profil Saya / Edit Biodata',
          icon: UserRound,
          roles: ['all'],
        },
        {
          id: 'demo_center' as NavTab,
          label: 'Pusat Demonstrasi',
          icon: MonitorPlay,
          roles: ['superadmin', 'workspace_admin', 'event_admin'],
        },
        {
          id: 'database_storage',
          label: 'Database Spreadsheet',
          icon: Database,
          roles: ['superadmin', 'workspace_admin'],
        },
        {
          id: 'branding_settings',
          label: 'Branding & Tampilan',
          icon: Sparkles,
          roles: ['superadmin', 'workspace_admin'],
        },
        {
          id: 'users',
          label: 'Akses Panitia',
          icon: UserCheck,
          roles: ['superadmin', 'workspace_admin'],
        },
        {
          id: 'superadmin',
          label: 'SuperAdmin Hub',
          icon: ShieldCheck,
          roles: ['superadmin'],
        },
      ],
    },
  ];

  // Filter groups: keep only items where role matches AND feature is enabled
  const filteredGroups = navGroups
    .map(grp => ({
      ...grp,
      items: grp.items.filter(item => {
        const roleMatches = item.roles.includes('all') || item.roles.includes(role);
        if (!roleMatches) return false;
        if (item.featureKey) {
          return featureControlService.isFeatureEnabled(item.featureKey);
        }
        return true;
      }),
    }))
    .map(grp => ({
      ...grp,
      items: grp.items.filter(item =>
        `${item.label} ${grp.label}`.toLocaleLowerCase('id').includes(search.trim().toLocaleLowerCase('id'))
      ),
    }))
    .filter(grp => grp.items.length > 0);

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 border-r border-[#ECECEF] dark:border-white/10 bg-white dark:bg-[#0E0E12] transition-all duration-200 relative select-none ${
        collapsed ? 'w-[4.5rem]' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-[4.25rem] flex items-center justify-between px-4 border-b border-[#ECECEF] dark:border-white/10 bg-white/95 dark:bg-[#0E0E12]/95">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#A61B1B] to-[#E34848] text-white flex items-center justify-center text-sm font-bold shadow-xs shrink-0">
              <Tent className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black text-[#171717] dark:text-white tracking-tight truncate">
                SiEpang
              </div>
              <div className="text-[10px] text-slate-400 font-medium truncate">
                Sistem Perkemahan
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-8 h-8 rounded-xl bg-gradient-to-tr from-[#A61B1B] to-[#E34848] text-white flex items-center justify-center text-sm font-bold shadow-xs">
            <Tent className="w-4 h-4 text-white" />
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="min-w-9 min-h-9 shrink-0 flex items-center justify-center p-1.5 rounded-xl text-slate-500 hover:text-red-700 dark:text-slate-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          aria-label={collapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
          title={collapsed ? 'Perluas Sidebar' : 'Perkecil Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick pages: page navigation, not scroll-to-section */}
      {!collapsed && (
        <div className="px-3 pt-3 grid grid-cols-2 gap-2">
          {[{ id: 'home' as NavTab, label: 'Beranda', icon: LayoutDashboard }, { id: 'profile' as NavTab, label: 'Profil Saya', icon: UserRound }].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button key={item.id} type="button" onClick={() => onTabChange(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`min-h-[76px] rounded-2xl border px-2.5 py-3 flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-sm text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${active ? 'border-red-500/40 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300' : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Quick Scan Action */}
      <div className="p-3">
        <button
          onClick={onOpenScanner}
          className={`min-h-11 w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r from-[#A61B1B] via-[#C62828] to-[#E34848] hover:brightness-105 text-white font-bold text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Pindai QR"
        >
          <QrCode className="w-4 h-4 shrink-0 stroke-[2.4]" />
          {!collapsed && <span>Pindai QR</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-3">
          <label htmlFor="siepang-sidebar-search" className="sr-only">Cari menu</label>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2.5 focus-within:ring-2 focus-within:ring-red-500/40">
            <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input id="siepang-sidebar-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari fitur..." autoComplete="off"
              className="min-w-0 w-full py-2 bg-transparent outline-none text-xs text-slate-800 dark:text-white placeholder:text-slate-400" />
            {search && <button type="button" onClick={() => setSearch('')} title="Hapus pencarian" aria-label="Hapus pencarian"><X className="w-4 h-4" /></button>}
          </div>
        </div>
      )}

      {/* Grouped Navigation Menu (Requirement 34, 35) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-4 no-scrollbar" aria-label="Menu SiEpang">
        {filteredGroups.length === 0 && !collapsed && <p className="p-3 text-xs text-slate-500">Tidak ada menu yang cocok.</p>}
        {filteredGroups.map(group => (
          <div key={group.id} className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.12em]">
                {group.label}
              </div>
            )}
            {collapsed && <div className="h-2" />}

            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id + item.label}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer group relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                    isActive
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 font-bold ring-1 ring-red-200/90 dark:ring-red-800/60 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-[#C62828]'
                      : 'text-slate-600 dark:text-slate-300 hover:text-[#171717] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive ? 'text-[#C62828] dark:text-red-300' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Logout Action (Req 15) */}
      {onLogout && (
        <div className="px-3 py-2 border-t border-[#ECECEF] dark:border-white/10">
          <button
            type="button"
            onClick={onLogout}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Keluar / Ganti Akun"
          >
            <LogOut className="w-4 h-4 shrink-0 stroke-[2]" />
            {!collapsed && <span>Keluar / Ganti Akun</span>}
          </button>
        </div>
      )}

      {/* Sidebar Footer */}
      {!collapsed ? (
        <GlobalFooter variant="sidebar" />
      ) : (
        <div className="p-3 text-center border-t border-[#ECECEF] dark:border-white/10 text-[10px] text-slate-400 font-mono">
          ⚜️
        </div>
      )}
    </aside>
  );
};
