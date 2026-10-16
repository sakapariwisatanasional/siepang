/**
 * SiEpang — Desktop Sidebar
 * Struktur navigasi dipisahkan menjadi:
 * 1. Peserta
 * 2. Kepanitiaan
 *
 * Catatan:
 * - Tidak mengubah data service, GAS, API, feature control, atau route ID.
 * - Hanya mengatur struktur/label/sidebar desktop.
 * - Role yang tidak dikenal diperlakukan sebagai kepanitiaan agar akses admin
 *   existing tidak hilang secara tidak sengaja.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
  UserCheck,
  UserRound,
  Globe,
  Image as ImageIcon,
  Database,
  Sparkles,
  MonitorPlay,
  Tent,
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

const PARTICIPANT_ROLES = new Set([
  'participant',
  'peserta',
]);

const PARTICIPANT_GROUPS: NavGroup[] = [
  {
    id: 'peserta_utama',
    label: 'Peserta',
    items: [
      {
        id: 'home',
        label: 'Beranda',
        icon: LayoutDashboard,
        roles: ['all'],
      },
      {
        id: 'profile',
        label: 'Profil Saya',
        icon: UserRound,
        roles: ['all'],
      },
      {
        id: 'schedule',
        label: 'Jadwal Kegiatan',
        icon: Calendar,
        roles: ['all'],
        featureKey: 'SCHEDULE',
      },
      {
        id: 'competitions',
        label: 'Unjuk Karya',
        icon: Trophy,
        roles: ['all'],
        featureKey: 'COMPETITION',
      },
      {
        id: 'leaderboard',
        label: 'Peringkat & XP',
        icon: Zap,
        roles: ['all'],
        featureKey: 'POINTS_XP',
      },
      {
        id: 'public_gallery',
        label: 'Photo & Video',
        icon: ImageIcon,
        roles: ['all'],
        featureKey: 'PUBLIC_DOCUMENTATION',
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
];

const COMMITTEE_GROUPS: NavGroup[] = [
  {
    id: 'kepanitiaan_utama',
    label: 'Kepanitiaan',
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
    id: 'kepanitiaan_kegiatan',
    label: 'Kegiatan',
    items: [
      {
        id: 'participants',
        label: 'Data Peserta',
        icon: Users,
        roles: [
          'workspace_admin',
          'event_admin',
          'kontingen_admin',
          'registration_officer',
          'superadmin',
        ],
        featureKey: 'PARTICIPANT_MANAGEMENT',
      },
      {
        id: 'schedule',
        label: 'Jadwal Kegiatan',
        icon: Calendar,
        roles: ['all'],
        featureKey: 'SCHEDULE',
      },
      {
        id: 'attendance',
        label: 'Presensi Scan',
        icon: QrCode,
        roles: [
          'attendance_officer',
          'workspace_admin',
          'event_admin',
          'committee',
          'superadmin',
        ],
        featureKey: 'ATTENDANCE',
      },
    ],
  },
  {
    id: 'kepanitiaan_unjuk_karya',
    label: 'Unjuk Karya & Prestasi',
    items: [
      {
        id: 'competitions',
        label: 'Unjuk Karya',
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
    id: 'kepanitiaan_operasional',
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
    id: 'kepanitiaan_publikasi',
    label: 'Photo & Video',
    items: [
      {
        id: 'public_gallery',
        label: 'Photo & Video',
        icon: ImageIcon,
        roles: ['all'],
        featureKey: 'PUBLIC_DOCUMENTATION',
      },
      {
        id: 'gallery_admin' as NavTab,
        label: 'Kelola Photo & Video',
        icon: ImageIcon,
        roles: [
          'superadmin',
          'workspace_admin',
          'event_admin',
          'publication_officer',
          'documentation_officer',
        ],
        featureKey: 'PUBLIC_DOCUMENTATION',
      },
    ],
  },
  {
    id: 'kepanitiaan_dokumen',
    label: 'Dokumen',
    items: [
      {
        id: 'templates',
        label: 'ID Card & Sertifikat',
        icon: CreditCard,
        roles: [
          'workspace_admin',
          'event_admin',
          'registration_officer',
          'superadmin',
        ],
        featureKey: 'ID_CARD',
      },
    ],
  },
  {
    id: 'kepanitiaan_akun',
    label: 'Akun',
    items: [
      {
        id: 'profile',
        label: 'Profil Saya',
        icon: UserRound,
        roles: ['all'],
      },
    ],
  },
  {
    id: 'kepanitiaan_sistem',
    label: 'Sistem',
    items: [
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

  // tick intentionally participates in this memo so the sidebar reacts
  // immediately when a feature is enabled/disabled elsewhere.
  const navGroups = useMemo<NavGroup[]>(() => {
    const normalizedRole = String(role || '').trim().toLowerCase();
    const isParticipant = PARTICIPANT_ROLES.has(normalizedRole);
    return isParticipant ? PARTICIPANT_GROUPS : COMMITTEE_GROUPS;
  }, [role, tick]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id');

    return navGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => {
          const roleMatches =
            item.roles.includes('all') || item.roles.includes(role);

          if (!roleMatches) return false;

          if (item.featureKey) {
            return featureControlService.isFeatureEnabled(item.featureKey);
          }

          return true;
        }),
      }))
      .map(group => ({
        ...group,
        items: query
          ? group.items.filter(item =>
              `${item.label} ${group.label}`
                .toLocaleLowerCase('id')
                .includes(query),
            )
          : group.items,
      }))
      .filter(group => group.items.length > 0);
  }, [navGroups, role, search, tick]);

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 border-r border-[#ECECEF] dark:border-white/10 bg-white dark:bg-[#0E0E12] transition-all duration-200 relative select-none ${
        collapsed ? 'w-20' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#ECECEF] dark:border-white/10">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#D71920] to-[#EF4444] text-white flex items-center justify-center text-sm font-bold shadow-xs shrink-0">
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
          <div className="mx-auto w-8 h-8 rounded-xl bg-gradient-to-tr from-[#D71920] to-[#EF4444] text-white flex items-center justify-center text-sm font-bold shadow-xs">
            <Tent className="w-4 h-4 text-white" />
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed(value => !value)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title={collapsed ? 'Perluas Sidebar' : 'Perkecil Sidebar'}
          aria-label={collapsed ? 'Perluas Sidebar' : 'Perkecil Sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Quick pages */}
      {!collapsed && (
        <div className="px-3 pt-3 grid grid-cols-2 gap-2">
          {[
            {
              id: 'home' as NavTab,
              label: 'Beranda',
              icon: LayoutDashboard,
            },
            {
              id: 'profile' as NavTab,
              label: 'Profil Saya',
              icon: UserRound,
            },
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`rounded-2xl border px-2 py-3 flex flex-col items-center gap-1.5 transition-colors text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
                  active
                    ? 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
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
          type="button"
          onClick={onOpenScanner}
          className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r from-[#D71920] via-[#EF4444] to-[#F04A4A] hover:opacity-95 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Pindai QR"
        >
          <QrCode className="w-4 h-4 shrink-0 stroke-[2.4]" />
          {!collapsed && <span>Pindai QR</span>}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <label htmlFor="siepang-sidebar-search" className="sr-only">
            Cari menu
          </label>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2.5 focus-within:ring-2 focus-within:ring-red-500/30">
            <Search
              className="w-4 h-4 text-slate-400 shrink-0"
              aria-hidden="true"
            />

            <input
              id="siepang-sidebar-search"
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Cari fitur..."
              autoComplete="off"
              className="min-w-0 w-full py-2 bg-transparent outline-none text-xs text-slate-800 dark:text-white placeholder:text-slate-400"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                title="Hapus pencarian"
                aria-label="Hapus pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div
        className="flex-1 overflow-y-auto px-3 py-1 space-y-3 no-scrollbar"
        aria-label="Menu SiEpang"
      >
        {filteredGroups.length === 0 && !collapsed && (
          <p className="p-3 text-xs text-slate-500">
            Tidak ada menu yang cocok.
          </p>
        )}

        {filteredGroups.map(group => (
          <div key={group.id} className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
                    isActive
                      ? 'bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300 font-bold ring-1 ring-red-200 dark:ring-red-800/50'
                      : 'text-slate-600 dark:text-slate-300 hover:text-[#171717] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-[#D71920] dark:text-[#EF4444]'
                        : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white'
                    }`}
                    aria-hidden="true"
                  />

                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Logout */}
      {onLogout && (
        <div className="px-3 py-1.5 border-t border-[#ECECEF] dark:border-white/10">
          <button
            type="button"
            onClick={onLogout}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer ${
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
