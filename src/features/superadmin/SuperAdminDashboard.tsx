/**
 * @license
 * SiEpang - SuperAdmin Hub & Multi-Workspace Dashboard
 */

import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Plus,
  Server,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  Database,
  ExternalLink,
  Search,
  FolderTree,
  Users,
  FileCheck2,
  ArrowUpCircle,
} from 'lucide-react';
import { workspaceService } from '../../services/workspaceService';
import { WorkspaceWizardModal } from './WorkspaceWizardModal';
import { Workspace } from '../../types';
import { OrganizationManagement } from '../organizations/OrganizationManagement';
import { UserManagementView } from '../users/UserManagementView';
import { DatabaseStorageManager } from '../database/DatabaseStorageManager';
import { AdminBrandingManager } from '../branding/AdminBrandingManager';
import { SystemUpdateCenter } from '../system/SystemUpdateCenter';

export const SuperAdminDashboard: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(workspaceService.getWorkspaces());
  const [showWizard, setShowWizard] = useState(false);
  const [preselectedOrgId, setPreselectedOrgId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [subTab, setSubTab] = useState<'workspaces' | 'organizations' | 'users' | 'database' | 'branding' | 'system_update' | 'audit'>('workspaces');

  const auditLogs = workspaceService.getAuditLogs();

  const filteredWorkspaces = workspaces.filter(
    w =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 sm:p-6 rounded-[28px] shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF0F4] border border-[#FFE0E8] text-xs font-semibold text-[#F47743] mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SuperAdmin Console</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#171717] dark:text-white tracking-tight">
            Konsol Pengendali Kwartir Nasional & Daerah
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
            Kelola instans workspace perkemahan, hirarki silsilah organisasi, dan otorisasi RBAC se-Indonesia.
          </p>
        </div>

        <div className="px-3.5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs font-medium max-w-sm">
          <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300 mb-0.5">
            <span>⚜️ 1 Instalasi = 1 Kegiatan</span>
          </div>
          Instalasi SiEpang ini terikat pada satu kegiatan. Buat instalasi SiEpang baru untuk kegiatan lainnya.
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEF] dark:border-white/10 pb-2">
        <button
          onClick={() => setSubTab('workspaces')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px] cursor-pointer ${
            subTab === 'workspaces'
              ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs'
              : 'text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Workspaces Kwartir ({workspaces.length})</span>
        </button>

        <button
          onClick={() => setSubTab('organizations')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px] cursor-pointer ${
            subTab === 'organizations'
              ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs'
              : 'text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Struktur Organisasi (Kwarnas → Gudep)</span>
        </button>

        <button
          onClick={() => setSubTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px] cursor-pointer ${
            subTab === 'users'
              ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs'
              : 'text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Pengguna & RBAC</span>
        </button>

        <button
          onClick={() => setSubTab('database')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px] cursor-pointer ${
            subTab === 'database'
              ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs'
              : 'text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database & Storage (v1.5)</span>
        </button>

        <button
          onClick={() => setSubTab('branding')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px] cursor-pointer ${
            subTab === 'branding'
              ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs'
              : 'text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Branding & Drive Customer</span>
        </button>


        <button
          onClick={() => setSubTab('system_update')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px] cursor-pointer ${
            subTab === 'system_update'
              ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs'
              : 'text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <ArrowUpCircle className="w-4 h-4" />
          <span>Update & Versi</span>
        </button>

        <button
          onClick={() => setSubTab('audit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px] cursor-pointer ${
            subTab === 'audit'
              ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717] shadow-xs'
              : 'text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Log Audit & Provisioning</span>
        </button>
      </div>

      {/* SUB-TAB: DATABASE & STORAGE */}
      {subTab === 'database' && <DatabaseStorageManager />}

      {/* SUB-TAB: BRANDING & CUSTOMER DRIVE */}
      {subTab === 'branding' && <AdminBrandingManager />}


      {/* SUB-TAB: SYSTEM UPDATE */}
      {subTab === 'system_update' && <SystemUpdateCenter />}

      {/* SUB-TAB: ORGANIZATIONS */}
      {subTab === 'organizations' && (
        <OrganizationManagement
          onNavigateToWorkspace={(wsId) => {
            workspaceService.setWorkspace(wsId);
            setSubTab('workspaces');
          }}
          onOpenWorkspaceWizard={(orgId) => {
            setPreselectedOrgId(orgId);
            setShowWizard(true);
          }}
        />
      )}

      {/* SUB-TAB: USERS */}
      {subTab === 'users' && <UserManagementView />}

      {/* SUB-TAB: WORKSPACES */}
      {subTab === 'workspaces' && (
        <>
          {/* High-Level Platform Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 shadow-2xs space-y-1">
              <div className="text-xs text-[#6B7280] dark:text-slate-400">Total Kwartir (Workspaces)</div>
              <div className="text-2xl font-black text-[#171717] dark:text-white font-mono">{workspaces.length}</div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>100% Aktif & Terisolasi</span>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 shadow-2xs space-y-1">
              <div className="text-xs text-[#6B7280] dark:text-slate-400">Event Perkemahan</div>
              <div className="text-2xl font-black text-[#208C60] dark:text-purple-400 font-mono">14 Event</div>
              <div className="text-[11px] text-[#6B7280] dark:text-slate-400">Termasuk Jamcab & Raida</div>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 shadow-2xs space-y-1">
              <div className="text-xs text-[#6B7280] dark:text-slate-400">Status Skema DB</div>
              <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">v2.4.0</div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">✓ Selaras & Tervalidasi</div>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 shadow-2xs space-y-1">
              <div className="text-xs text-[#6B7280] dark:text-slate-400">Local Camp Mesh Nodes</div>
              <div className="text-2xl font-black text-[#F47743] dark:text-pink-400 font-mono">3 Online</div>
              <div className="text-[11px] text-[#6B7280] dark:text-slate-400">Edge Buper Selogiri</div>
            </div>
          </div>

          {/* Workspace List Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm font-bold text-[#171717] dark:text-white uppercase tracking-wider">
                Daftar Workspace Terdaftar
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari kwartir atau kode..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/10 rounded-xl text-base sm:text-xs text-[#171717] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#F47743]"
                />
              </div>
            </div>

            {/* Workspace Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredWorkspaces.map(ws => (
                <div
                  key={ws.id}
                  className="p-5 rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-[#F47743]/40 transition-all space-y-3.5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm shrink-0"
                        style={{ backgroundColor: ws.branding.primaryColor }}
                      >
                        ⚜️
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-[#171717] dark:text-white truncate max-w-[160px]">{ws.name}</h3>
                        <div className="text-[11px] text-[#6B7280] dark:text-slate-400">{ws.region}</div>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30">
                      {ws.status}
                    </span>
                  </div>

                  {/* Specs & Health Chips */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-[#FAFAFA] dark:bg-white/5 p-2 rounded-xl border border-[#ECECEF] dark:border-white/5 flex items-center gap-1.5 text-[#171717] dark:text-slate-300">
                      <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="truncate">DB Connected</span>
                    </div>
                    <div className="bg-[#FAFAFA] dark:bg-white/5 p-2 rounded-xl border border-[#ECECEF] dark:border-white/5 flex items-center gap-1.5 text-[#171717] dark:text-slate-300">
                      <HardDrive className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span className="truncate">Drive Auto-sync</span>
                    </div>
                  </div>

                  {/* Admin & Domain Info */}
                  <div className="text-[11px] text-[#6B7280] dark:text-slate-400 space-y-1 pt-1 border-t border-[#ECECEF] dark:border-white/5">
                    <div className="flex justify-between">
                      <span>Admin:</span>
                      <span className="font-medium text-[#171717] dark:text-slate-200">{ws.adminName.split(',')[0]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Domain:</span>
                      <span className="font-mono text-[#208C60] dark:text-purple-400">{ws.customDomain || 'default.siepang.id'}</span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="w-full py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold border border-emerald-200/50 dark:border-emerald-800/40 text-center">
                    Workspace Aktif Instalasi Ini
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* SUB-TAB: AUDIT LOGS */}
      {subTab === 'audit' && (
        <div className="rounded-3xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 space-y-3 shadow-2xs">
          <div className="text-xs font-bold text-[#171717] dark:text-white uppercase tracking-wider">
            Log Audit & Aktivitas Provisioning Multi-Workspace
          </div>

          <div className="space-y-2">
            {auditLogs.map(log => (
              <div
                key={log.id}
                className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-[#ECECEF] dark:border-white/5 flex items-center justify-between text-xs gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#171717] dark:text-white">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                  </div>
                  <div className="text-[11px] text-[#208C60] dark:text-purple-400 truncate mt-0.5">{log.target}</div>
                </div>

                <div className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{log.actorName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Creation Wizard Modal */}
      <WorkspaceWizardModal
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          setPreselectedOrgId(undefined);
        }}
        preselectedOrgId={preselectedOrgId}
        onSuccess={() => setWorkspaces(workspaceService.getWorkspaces())}
      />
    </div>
  );
};
