/**
 * @license
 * SiEpang - Desktop Compact Sidebar
 * Categorized Navigation (UTAMA, KEGIATAN, LOMBA, OPERASIONAL, PUBLIKASI, DOKUMEN, SISTEM)
 * Collapsible to icon-only with tooltips + strict Feature Control filtering.
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
  Globe,
  Image as ImageIcon,
  Database,
  Sparkles,
  ArrowUpCircle,
  Tent,
  FileText,
  Building2,
  LogOut,
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
          id: 'installation',
          label: 'Konfigurasi Sistem',
          icon: ShieldCheck,
          roles: ['superadmin', 'workspace_admin', 'event_admin'],
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
    .filter(grp => grp.items.length > 0);

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
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#208C60] to-[#F47743] text-white flex items-center justify-center text-sm font-bold shadow-xs shrink-0">
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
          <div className="mx-auto w-8 h-8 rounded-xl bg-gradient-to-tr from-[#208C60] to-[#F47743] text-white flex items-center justify-center text-sm font-bold shadow-xs">
            <Tent className="w-4 h-4 text-white" />
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title={collapsed ? 'Perluas Sidebar' : 'Perkecil Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick Scan Action */}
      <div className="p-3">
        <button
          onClick={onOpenScanner}
          className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Pindai QR"
        >
          <QrCode className="w-4 h-4 shrink-0 stroke-[2.4]" />
          {!collapsed && <span>Pindai QR</span>}
        </button>
      </div>

      {/* Grouped Navigation Menu (Requirement 34, 35) */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-4 no-scrollbar">
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
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer group relative ${
                    isActive
                      ? 'bg-[#208C60]/10 text-[#208C60] dark:text-[#F47743] font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-[#171717] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#208C60] dark:text-[#F47743]' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white'
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
