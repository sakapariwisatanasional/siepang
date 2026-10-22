/**
 * @license
 * SiEpang - Admin Daerah & Event Admin Dashboard
 * UX Refactored: Fast to understand without training, visually calm, progressive disclosure.
 * Adheres to Requirements 8-29, 36, 40, 56.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  Tent,
  Trophy,
  QrCode,
  Calendar,
  Globe,
  Sliders,
  Database,
  Cloud,
  Sparkles,
  Cpu,
  Activity,
  ArrowUpCircle,
  FileText,
  ShieldCheck,
  Stethoscope,
  Boxes,
  MapPin,
  Search,
  Pin,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Clock,
  Layers,
  Image as ImageIcon,
  CreditCard,
  Building2,
  CheckSquare,
  HelpCircle,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { eventService } from '../../services/eventService';
import { participantService } from '../../services/participantService';
import { databaseStorageService } from '../../services/databaseStorageService';
import { visitorManagementService } from '../../services/visitorManagementService';
import { featureControlService } from '../../services/featureControlService';
import { authService } from '../../services/authService';
import { pointService } from '../../services/pointService';
import { XPTransaction, SystemFeatureKey } from '../../types';
import { canReadInstallation } from '../../backend/rbac/permissions';
import { customerInstallationService } from '../../services/customerInstallationService';
import { NavTab } from '../../components/navigation/MobileNavigation';
import {
  MetricCard,
  AttentionList,
  AttentionItem,
  SearchBar,
  ModuleGroup,
  ModuleItem,
  PinnedActionsBar,
  PinnedActionItem,
  RecentActivityList,
  ActivityRecord,
} from '../../components/common/GlobalUxComponents';

interface AdminDaerahDashboardProps {
  onNavigate: (tab: NavTab) => void;
  onOpenScanner: () => void;
  onOpenSyncCenter: () => void;
}

/** Per-channel XP controls. The same keys are enforced by backend GAS before XP writes. */
const XP_CHANNEL_CONTROLS: {
  key: SystemFeatureKey;
  title: string;
  detail: string;
  match: (tx: XPTransaction) => boolean;
}[] = [
  { key: 'XP_PEER_APPRECIATION', title: 'Apresiasi sesama peserta', detail: 'Poin peer-to-peer untuk perilaku positif', match: tx => tx.category === 'peer_appreciation' || tx.sourceType === 'peer_appreciation' },
  { key: 'XP_ATTENDANCE_REWARD', title: 'Absensi kegiatan / QR agenda', detail: 'Reward kehadiran pada agenda dan check-in', match: tx => tx.category === 'attendance' || ['attendance','checkin','check_in'].includes(String(tx.sourceType || '')) },
  { key: 'XP_CHECKPOINT_REWARD', title: 'Aktivitas & checkpoint', detail: 'Reward aktivitas, eksplorasi, dan checkpoint', match: tx => tx.category === 'activity' || ['activity','checkpoint'].includes(String(tx.sourceType || '')) },
  { key: 'XP_COMPETITION_REWARD', title: 'Prestasi lomba', detail: 'Poin juara atau hasil kompetisi', match: tx => (tx.category === 'competition' || tx.sourceType === 'competition') && !/vote/i.test(tx.reason) },
  { key: 'XP_VOTING_REWARD', title: 'Voting karya publik', detail: 'Poin partisipasi voting karya', match: tx => (tx.category === 'competition' || tx.sourceType === 'competition') && /vote/i.test(tx.reason) },
  { key: 'XP_USER_AWARD', title: 'Reward pengguna aplikasi', detail: 'Reward yang secara eksplisit bersumber dari user_award', match: tx => ['user_award','app_user','user_activity','user'].includes(String(tx.sourceType || '').toLowerCase()) || /pengguna aplikasi|user award/i.test(tx.reason) },
  { key: 'XP_COMMITTEE_AWARD', title: 'Reward panitia', detail: 'Poin yang diberikan panitia melalui committee_award', match: tx => ['committee_award','committee'].includes(String(tx.sourceType || '').toLowerCase()) || /panitia|committee/i.test(tx.reason) },
  { key: 'XP_MANUAL_AWARD', title: 'Poin manual / penyesuaian admin', detail: 'Bonus dan penyesuaian manual yang dicatat di ledger', match: tx => (tx.category === 'bonus' || ['manual','manual_award'].includes(String(tx.sourceType || '').toLowerCase())) && !['committee_award','committee','user_award','app_user','user_activity','user'].includes(String(tx.sourceType || '').toLowerCase()) && !/panitia|committee|pengguna aplikasi|user award/i.test(tx.reason) },
];

export const AdminDaerahDashboard: React.FC<AdminDaerahDashboardProps> = ({
  onNavigate,
  onOpenScanner,
  onOpenSyncCenter,
}) => {
  const event = eventService.getCurrentEvent();
  const participants = participantService.getParticipants();
  const contingents = participantService.getContingents();
  const visitors = visitorManagementService.getVisitors();
  const isDbConnected = databaseStorageService.isConnected();

  // XP ledger is loaded from the authoritative GAS PointTransactions sheet.
  const [xpTransactions, setXpTransactions] = useState<XPTransaction[]>([]);
  const [xpLoading, setXpLoading] = useState(true);
  const [xpError, setXpError] = useState('');
  const [xpLastUpdated, setXpLastUpdated] = useState('');
  const [xpFeatureEnabled, setXpFeatureEnabled] = useState(() => featureControlService.isFeatureEnabled('POINTS_XP'));
  const [xpFeatureSaving, setXpFeatureSaving] = useState(false);
  const [xpFeatureError, setXpFeatureError] = useState('');
  const [xpChannelStates, setXpChannelStates] = useState<Record<string, boolean>>({});
  const [xpChannelSaving, setXpChannelSaving] = useState<string | null>(null);
  const [xpChannelError, setXpChannelError] = useState('');

  const syncXpFeatureStates = useCallback(() => {
    setXpFeatureEnabled(featureControlService.isFeatureEnabled('POINTS_XP'));
    setXpChannelStates(Object.fromEntries(
      XP_CHANNEL_CONTROLS.map(channel => [channel.key, featureControlService.isFeatureEnabled(channel.key)])
    ));
  }, []);

  useEffect(() => {
    const unsubscribe = featureControlService.subscribe(syncXpFeatureStates);
    void featureControlService.refreshAllFromSpreadsheet()
      .then(syncXpFeatureStates)
      .catch(error => setXpFeatureError(error instanceof Error ? error.message : 'Status fitur XP gagal dimuat dari GAS.'));
    return unsubscribe;
  }, [syncXpFeatureStates]);

  const refreshXpLedger = useCallback(async () => {
    setXpLoading(true);
    setXpError('');
    try {
      const rows = await pointService.refreshTransactions();
      setXpTransactions([...rows].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))));
      setXpLastUpdated(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      setXpError(error instanceof Error ? error.message : 'Riwayat XP gagal dimuat dari GAS.');
    } finally {
      setXpLoading(false);
    }
  }, []);

  const toggleXpFeature = useCallback(async () => {
    setXpFeatureSaving(true);
    setXpFeatureError('');
    try {
      const enabled = await featureControlService.toggleEventFeature('POINTS_XP');
      setXpFeatureEnabled(enabled);
      await refreshXpLedger();
    } catch (error) {
      setXpFeatureError(error instanceof Error ? error.message : 'Pengaturan fitur XP gagal disimpan.');
    } finally {
      setXpFeatureSaving(false);
    }
  }, [refreshXpLedger]);

  const toggleXpChannel = useCallback(async (key: SystemFeatureKey) => {
    setXpChannelSaving(key);
    setXpChannelError('');
    try {
      await featureControlService.toggleEventFeature(key);
      syncXpFeatureStates();
    } catch (error) {
      setXpChannelError(error instanceof Error ? error.message : 'Pengaturan channel XP gagal disimpan.');
    } finally {
      setXpChannelSaving(null);
    }
  }, [syncXpFeatureStates]);

  useEffect(() => {
    void refreshXpLedger();
  }, [refreshXpLedger]);

  // Metrics
  const checkedInCount = participants.filter(p => p.checkedIn).length;
  const unverifiedCount = participants.filter(p => !p.checkedIn).length;
  const visitorCount = visitors.length;

  // Search feature menu state (Requirement 14)
  const [searchQuery, setSearchQuery] = useState('');

  // Pinned / favorite actions state (Requirement 15, max 4-6)
  const [pinnedModules, setPinnedModules] = useState<NavTab[]>([
    'participants',
    'schedule',
    'attendance',
    'competitions',
    'templates',
  ]);

  const pinnedItems: PinnedActionItem[] = useMemo(() => {
    const iconMap: Partial<Record<NavTab, { label: string; icon: any }>> = {
      participants: { label: 'Data Peserta', icon: Users },
      schedule: { label: 'Jadwal Giat', icon: Calendar },
      attendance: { label: 'Presensi Scan', icon: QrCode },
      competitions: { label: 'Lomba', icon: Trophy },
      templates: { label: 'Dokumen', icon: CreditCard },
      event_studio: { label: 'Studio Buper', icon: Tent },
      health: { label: 'Posko Medis', icon: Stethoscope },
      logistics: { label: 'Logistik', icon: Boxes },
    };
    return pinnedModules
      .filter(id => iconMap[id])
      .map(id => ({
        id,
        title: iconMap[id]!.label,
        icon: iconMap[id]!.icon,
        onClick: () => onNavigate(id),
      }));
  }, [pinnedModules, onNavigate]);

  const recentActivities: ActivityRecord[] = useMemo(() => [
    {
      id: 'act-1',
      title: 'Check-in 12 Peserta Kwarran Cimanggis',
      actor: 'Petugas Gerbang (Gate 1)',
      time: '10 mnt lalu',
      badge: 'Presensi',
      icon: CheckCircle2,
    },
    {
      id: 'act-2',
      title: 'Penilaian Lomba Pionering Regu Garuda disahkan',
      actor: 'Juri Kak Suryo',
      time: '25 mnt lalu',
      badge: 'Nilai 88',
      icon: Trophy,
    },
    {
      id: 'act-3',
      title: 'Pencadangan Spreadsheet otomatis berhasil',
      actor: 'Sistem Cloud Drive',
      time: '1 jam lalu',
      badge: 'v1.5 Sync',
      icon: Database,
    },
    {
      id: 'act-4',
      title: 'Distribusi 4 Tenda Dome ke Regu Melati',
      actor: 'Petugas Logistik',
      time: '2 jam lalu',
      badge: 'Logistik',
      icon: Boxes,
    },
    {
      id: 'act-5',
      title: 'Penanganan 1 peserta lelah di Pos Medis Utama',
      actor: 'Tim Medis P3K',
      time: '3 jam lalu',
      badge: 'Selesai',
      icon: Stethoscope,
    },
  ], []);

  // Collapsible category expansion states (Requirement 12, 13: smart default expansion)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    kegiatan: true, // Only KEGIATAN expanded by default
    operasional: false,
    publikasi: false,
    dokumen: false,
    sistem: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 1. Actionable Needs Attention items (Requirements 23, 24)
  const attentionItems: AttentionItem[] = useMemo(() => {
    const list: AttentionItem[] = [];

    if (unverifiedCount > 0) {
      list.push({
        id: 'unverified_participants',
        title: `${unverifiedCount} peserta terdaftar belum melakukan check-in`,
        count: unverifiedCount,
        type: 'warning',
        actionLabel: 'Verifikasi',
        onClick: () => onNavigate('participants'),
      });
    }

    if (!isDbConnected) {
      list.push({
        id: 'db_not_connected',
        title: 'Database Google Spreadsheet belum terhubung untuk pencadangan',
        type: 'urgent',
        actionLabel: 'Koneksikan',
        onClick: () => onNavigate('database_storage'),
      });
    }

    return list;
  }, [unverifiedCount, isDbConnected, onNavigate]);

  // 2. All Features catalog for search (Requirement 14)
  const allFeatures = useMemo(() => {
    return [
      { id: 'participants' as NavTab, title: 'Data Peserta & Kontingen', category: 'Kegiatan', icon: Users, keywords: 'peserta biodata verifikasi kta' },
      { id: 'schedule' as NavTab, title: 'Jadwal & Agenda Kegiatan', category: 'Kegiatan', icon: Calendar, keywords: 'jadwal waktu sesi apel upacara' },
      { id: 'attendance' as NavTab, title: 'Pemindai Presensi Scan', category: 'Kegiatan', icon: QrCode, keywords: 'presensi hadir scan barcode gate' },
      { id: 'competitions' as NavTab, title: 'Lomba & Giat Prestasi', category: 'Kegiatan', icon: Trophy, keywords: 'lomba juara ranking voting' },
      { id: 'event_studio' as NavTab, title: 'Tata Ruang Buper & Kavling', category: 'Operasional', icon: Tent, keywords: 'tenda buper peta kavling lokasi' },
      { id: 'health' as NavTab, title: 'Posko Kesehatan & P3K', category: 'Operasional', icon: Stethoscope, keywords: 'medis dokter obat ambulans sakit alergi' },
      { id: 'logistics' as NavTab, title: 'Gudang Logistik & Tenda', category: 'Operasional', icon: Boxes, keywords: 'alat logistik tenda pinjam barang' },
      { id: 'public_home' as NavTab, title: 'Buku Tamu & Pengunjung', category: 'Operasional', icon: Globe, keywords: 'pengunjung tamu registrasi publik' },
      { id: 'public_gallery' as NavTab, title: 'Galeri Foto Dokumentasi', category: 'Publikasi', icon: ImageIcon, keywords: 'foto galeri dokumentasi media' },
      { id: 'event_studio' as NavTab, title: 'Banner & Publikasi Media', category: 'Publikasi', icon: Sparkles, keywords: 'banner hero pengumuman publikasi sponsor' },
      { id: 'templates' as NavTab, title: 'ID Card & Piagam Sertifikat', category: 'Dokumen', icon: CreditCard, keywords: 'id card cetak sertifikat piagam template kartu' },
      { id: 'database_storage' as NavTab, title: 'Database & Penyimpanan', category: 'Sistem', icon: Database, keywords: 'database spreadsheet drive backup sinkronisasi' },
      { id: 'branding_settings' as NavTab, title: 'Branding & Tampilan Kwartir', category: 'Sistem', icon: Sparkles, keywords: 'logo branding warna identitas kop surat' },
      { id: 'users' as NavTab, title: 'Kelola Akun & Hak Akses (RBAC)', category: 'Sistem', icon: ShieldCheck, keywords: 'user rbac panitia petugas admin password' },
      { id: 'system_update' as NavTab, title: 'Pembaruan & Status Sistem', category: 'Sistem', icon: ArrowUpCircle, keywords: 'update versi rilis kesehatan sistem' },
    ];
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allFeatures.filter(
      f =>
        f.title.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.keywords.includes(q)
    );
  }, [searchQuery, allFeatures]);

  // Quick Actions (Max 5, Requirement 10)
  const quickActions = [
    { id: 'participants', label: 'Peserta', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30', onClick: () => onNavigate('participants') },
    { id: 'schedule', label: 'Jadwal', icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', onClick: () => onNavigate('schedule') },
    { id: 'attendance', label: 'Presensi', icon: QrCode, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', onClick: () => onNavigate('attendance') },
    { id: 'competitions', label: 'Lomba', icon: Trophy, color: 'text-[#E1306C]', bgColor: 'bg-pink-50 dark:bg-pink-950/30', onClick: () => onNavigate('competitions') },
    { id: 'templates', label: 'Dokumen', icon: CreditCard, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', onClick: () => onNavigate('templates') },
    { id: 'event_studio', label: 'Studio Buper', icon: Sliders, color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30', onClick: () => onNavigate('event_studio') },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* =========================================================================
          SECTION 1: ADMIN TOP AREA (First Viewport Requirement 9)
          Contains ONLY: Active Event, Status, Primary Actions, max 4 statistics.
          No 15+ module cards above the fold!
          ========================================================================= */}
      <div className="rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#208C60]/10 text-[#208C60] dark:text-[#F47743] text-xs font-bold">
                ⛺ {event.category || 'Perkemahan'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>BERLANGSUNG</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#171717] dark:text-white tracking-tight truncate">
              {event.name}
            </h1>

            <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">{event.campGround} ({event.location})</span>
            </p>
          </div>

          {/* Primary Action Buttons (Max 2 Prominent Actions, Req 9) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('event_studio')}
              className="px-4 py-2.5 bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>Kelola Event</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('public_home')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-[#171717] dark:text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Globe className="w-4 h-4 text-slate-500" />
              <span>Portal Publik</span>
            </button>
          </div>
        </div>

        {/* 4 KEY STATISTICS MAXIMUM (Requirement 9, 21) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#ECECEF] dark:border-white/5">
          <MetricCard
            value={participants.length.toLocaleString()}
            label="Peserta"
            sublabel={`${contingents.length} Kontingen`}
            color="purple"
            icon={Users}
            onClick={() => onNavigate('participants')}
          />
          <MetricCard
            value={checkedInCount.toLocaleString()}
            label="Hadir di Buper"
            sublabel={`${Math.round((checkedInCount / Math.max(1, participants.length)) * 100)}% kehadiran`}
            color="emerald"
            icon={CheckCircle2}
            onClick={() => onNavigate('attendance')}
          />
          <MetricCard
            value={visitorCount.toLocaleString()}
            label="Pengunjung"
            sublabel="Buku tamu publik"
            color="blue"
            icon={Globe}
            onClick={() => onNavigate('public_home')}
          />
          <MetricCard
            value={unverifiedCount.toLocaleString()}
            label="Menunggu Cek"
            sublabel="Belum check-in gate"
            color="amber"
            icon={Clock}
            onClick={() => onNavigate('participants')}
          />
        </div>
      </div>

      {/* XP LEDGER — live data from the GAS PointTransactions sheet */}
      <section className="rounded-[24px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 p-4 sm:p-5 shadow-xs space-y-4" aria-labelledby="admin-xp-ledger-title">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center shrink-0"><Zap className="w-5 h-5" /></div>
            <div>
              <h2 id="admin-xp-ledger-title" className="text-sm font-black text-[#171717] dark:text-white">Pemantauan XP Peserta</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Sumber: buku besar transaksi PointTransactions di GAS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refreshXpLedger()} disabled={xpLoading} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${xpLoading ? 'animate-spin' : ''}`} /> Muat ulang
            </button>
            <button type="button" onClick={() => onNavigate('leaderboard')} className="rounded-xl bg-[#208C60] px-3 py-2 text-xs font-bold text-white hover:opacity-90">Peringkat XP</button>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${xpFeatureEnabled ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${xpFeatureEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}`}><Zap className="h-5 w-5" /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Poin & Gamifikasi XP</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${xpFeatureEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'}`}>{xpFeatureEnabled ? 'AKTIF' : 'NONAKTIF'}</span>
                </div>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600 dark:text-slate-300">Pengaturan master fitur XP untuk event aktif. Status disimpan melalui FeatureConfigs di GAS; menonaktifkan fitur tidak menghapus riwayat transaksi yang sudah ada.</p>
                {xpFeatureError && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-300">{xpFeatureError}</p>}
              </div>
            </div>
            <button type="button" onClick={() => void toggleXpFeature()} disabled={xpFeatureSaving} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold text-white disabled:cursor-wait disabled:opacity-60 ${xpFeatureEnabled ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {xpFeatureSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {xpFeatureSaving ? 'Menyimpan pengaturan…' : xpFeatureEnabled ? 'Nonaktifkan fitur XP' : 'Aktifkan fitur XP'}
            </button>
          </div>
        </div>

        {xpChannelError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">{xpChannelError}</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {XP_CHANNEL_CONTROLS.map(channel => {
            const channelRows = xpTransactions.filter(channel.match);
            const total = channelRows.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
            const enabled = xpChannelStates[channel.key] ?? true;
            const lockedByMaster = !xpFeatureEnabled;
            const saving = xpChannelSaving === channel.key;
            return <div key={channel.key} className={`rounded-2xl border p-3.5 ${enabled && !lockedByMaster ? 'border-slate-200 dark:border-white/10' : 'border-amber-200 dark:border-amber-900/40'} bg-white dark:bg-white/[0.03]`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{channel.title}</div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">{xpLoading ? '…' : `${channelRows.length} transaksi`}</span>
              </div>
              <p className="mt-1.5 min-h-8 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{channel.detail}</p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div><div className="text-[10px] text-slate-500">Total bersih</div><div className={`text-lg font-black ${total < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{xpLoading ? '…' : `${total > 0 ? '+' : ''}${total.toLocaleString('id-ID')} XP`}</div></div>
                <button type="button" onClick={() => void toggleXpChannel(channel.key)} disabled={saving || xpChannelSaving !== null || lockedByMaster} aria-pressed={enabled && !lockedByMaster} className={`rounded-xl px-3 py-2 text-[10px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${enabled && !lockedByMaster ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>
                  {saving ? <span className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Menyimpan</span> : lockedByMaster ? 'Dikunci master' : enabled ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
              <div className="mt-2 text-[10px] font-bold">{lockedByMaster ? <span className="text-amber-600">Master XP nonaktif</span> : enabled ? <span className="text-emerald-600">Channel aktif</span> : <span className="text-amber-600">Channel nonaktif</span>}</div>
            </div>;
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/[0.04]">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Setiap channel dapat diaktifkan atau dinonaktifkan secara terpisah. Pengaturan disimpan di FeatureConfigs GAS dan diperiksa backend sebelum XP ditulis. Untuk nominal reward, buka Studio Buper → Aturan XP.</p>
          <button type="button" onClick={() => onNavigate('event_studio')} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900">Atur aturan XP <ChevronRight className="h-3.5 w-3.5" /></button>
        </div>

        {xpError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/40 p-3 text-xs text-rose-700 dark:text-rose-300">
            <div className="font-bold">Riwayat XP belum dapat dimuat.</div><div className="mt-1">{xpError}</div>
            <div className="mt-1 text-[10px]">Periksa deployment GAS, event aktif, dan izin baca PointTransactions.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] p-3"><div className="text-[10px] text-slate-500">Transaksi tercatat</div><div className="mt-1 text-lg font-black text-[#171717] dark:text-white">{xpLoading ? '…' : xpTransactions.length.toLocaleString('id-ID')}</div></div>
              <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] p-3"><div className="text-[10px] text-slate-500">Total XP bersih</div><div className="mt-1 text-lg font-black text-emerald-600">{xpLoading ? '…' : xpTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0).toLocaleString('id-ID')}</div></div>
              <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] p-3"><div className="text-[10px] text-slate-500">Sumber QR/presensi</div><div className="mt-1 text-lg font-black text-[#171717] dark:text-white">{xpLoading ? '…' : xpTransactions.filter(tx => tx.category === 'attendance' || tx.category === 'activity').length.toLocaleString('id-ID')}</div></div>
              <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] p-3"><div className="text-[10px] text-slate-500">Apresiasi & lomba</div><div className="mt-1 text-lg font-black text-[#171717] dark:text-white">{xpLoading ? '…' : xpTransactions.filter(tx => tx.category === 'peer_appreciation' || tx.category === 'competition').length.toLocaleString('id-ID')}</div></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['attendance', 'QR agenda / check-in'],
                ['activity', 'QR aktivitas / checkpoint'],
                ['competition', 'Lomba / voting'],
                ['peer_appreciation', 'Apresiasi kawan'],
                ['bonus', 'Bonus / penyesuaian'],
              ] as const).map(([category, label]) => {
                const count = xpTransactions.filter(tx => tx.category === category).length;
                return <span key={category} className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">{label}<span className="rounded-full bg-slate-100 dark:bg-white/10 px-1.5 py-0.5">{count}</span></span>;
              })}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="bg-slate-50 dark:bg-white/[0.04] text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">Peserta</th><th className="px-3 py-2.5">Sumber / keterangan</th><th className="px-3 py-2.5">Waktu</th><th className="px-3 py-2.5 text-right">XP</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {xpLoading ? <tr><td colSpan={4} className="px-3 py-5 text-center text-slate-500">Memuat transaksi dari GAS…</td></tr> : xpTransactions.length === 0 ? <tr><td colSpan={4} className="px-3 py-5 text-center text-slate-500">Belum ada transaksi XP pada event aktif.</td></tr> : xpTransactions.slice(0, 8).map(tx => {
                    const sourceLabel = tx.category === 'attendance' ? 'QR agenda / check-in' : tx.category === 'activity' ? 'QR aktivitas / checkpoint' : tx.category === 'competition' ? 'Lomba / voting' : tx.category === 'peer_appreciation' ? 'Apresiasi kawan' : 'Bonus / penyesuaian';
                    const date = tx.timestamp && !Number.isNaN(new Date(tx.timestamp).getTime()) ? new Date(tx.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
                    return <tr key={tx.id} className="text-slate-700 dark:text-slate-200"><td className="px-3 py-2.5 font-semibold">{tx.participantName || tx.participantId || 'Peserta tidak dikenal'}</td><td className="px-3 py-2.5"><div className="font-semibold">{sourceLabel}</div><div className="mt-0.5 max-w-[300px] truncate text-[10px] text-slate-500" title={tx.reason}>{tx.reason || 'Tanpa keterangan'}</div></td><td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{date}</td><td className={`px-3 py-2.5 text-right font-black whitespace-nowrap ${tx.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('id-ID')}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-slate-400">{xpLastUpdated ? `Terakhir diperbarui ${xpLastUpdated}` : 'Menunggu data GAS.'} · Menampilkan maksimal 8 transaksi terbaru.</div>
          </>
        )}
      </section>

      {/* =========================================================================
          SECTION 2: SEARCH MENU ("Cari fitur...") (Requirement 14)
          Allows admins to find any feature without memorizing module categories
          ========================================================================= */}
      <div className="space-y-2">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cari fitur... (cth: Peserta, Jadwal, ID Card, Juri, Sponsor, Database, Tenda)"
        />

        {searchQuery.trim() && (
          <div className="p-3 rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 shadow-xs space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Hasil Pencarian ({searchResults.length})
            </div>
            {searchResults.length > 0 ? (
              searchResults.map(item => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.id + item.title}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      setSearchQuery('');
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between text-xs text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[#208C60]">
                        <ItemIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-[#171717] dark:text-white">{item.title}</div>
                        <div className="text-[10px] text-slate-400">Kategori: {item.category}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400">
                Fitur tidak ditemukan untuk "{searchQuery}". Coba kata kunci lain.
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION 3: NEEDS ATTENTION (Requirement 23, 24)
          Clickable items directly opening relevant screen
          ========================================================================= */}
      {attentionItems.length > 0 && <AttentionList items={attentionItems} />}

      {/* =========================================================================
          SECTION 4: PRIMARY QUICK ACTIONS (Max 6, Requirement 10)
          ========================================================================= */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-[#6B7280] dark:text-slate-400 uppercase tracking-wider px-1">
          Akses Cepat Utama
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {quickActions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                className="p-3 rounded-2xl bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 hover:border-[#208C60]/30 shadow-xs flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 group cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${action.bgColor} ${action.color}`}>
                  <Icon className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-bold text-[#171717] dark:text-white truncate">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          SECTION 5: FAVORITE / PINNED ACTIONS (Requirement 15: 4-6 max)
          ========================================================================= */}
      {pinnedItems.length > 0 && (
        <PinnedActionsBar items={pinnedItems} />
      )}

      {/* =========================================================================
          SECTION 6: GROUPED & COLLAPSIBLE MODULES (Requirements 11, 12, 13, 16, 17)
          Replaces the large module wall with clean progressive disclosure categories:
          - KEGIATAN (Default expanded)
          - OPERASIONAL (Collapsed)
          - PUBLIKASI (Collapsed)
          - DOKUMEN (Collapsed)
          - SISTEM (Collapsed)
          Cards strictly contain: Icon, Title, optional short status.
          ========================================================================= */}
      <div className="space-y-3">
        <div className="text-[11px] font-bold text-[#6B7280] dark:text-slate-400 uppercase tracking-wider px-1">
          Modul & Manajemen Event
        </div>

        {/* 1. KEGIATAN (Default Expanded) */}
        <ModuleGroup
          title="Kegiatan"
          icon={Calendar}
          isOpen={expandedSections.kegiatan}
          onToggle={() => toggleSection('kegiatan')}
          items={[
            {
              id: 'participants',
              title: 'Data Peserta',
              icon: Users,
              status: `${participants.length} Terdata`,
              statusColor: 'purple',
              onClick: () => onNavigate('participants'),
            },
            {
              id: 'schedule',
              title: 'Jadwal & Agenda',
              icon: Calendar,
              status: 'Hari ke-1',
              statusColor: 'blue',
              onClick: () => onNavigate('schedule'),
            },
            {
              id: 'attendance',
              title: 'Presensi Scan',
              icon: QrCode,
              status: `${checkedInCount} Hadir`,
              statusColor: 'emerald',
              onClick: () => onNavigate('attendance'),
            },
            {
              id: 'competitions',
              title: 'Lomba & Penjurian',
              icon: Trophy,
              status: `${event.competitionCount || 4} Cabang`,
              statusColor: 'amber',
              onClick: () => onNavigate('competitions'),
            },
            {
              id: 'event_studio',
              title: 'Aktivitas & Pos Giat',
              icon: Sliders,
              status: 'Siap',
              statusColor: 'emerald',
              onClick: () => onNavigate('event_studio'),
            },
          ]}
        />

        {/* 2. OPERASIONAL */}
        <ModuleGroup
          title="Operasional"
          icon={Tent}
          isOpen={expandedSections.operasional}
          onToggle={() => toggleSection('operasional')}
          items={[
            {
              id: 'event_studio_campsite',
              title: 'Kavling Buper & Peta',
              icon: Tent,
              status: `${contingents.length} Tenda`,
              statusColor: 'blue',
              onClick: () => onNavigate('event_studio'),
            },
            {
              id: 'health',
              title: 'Posko Medis & P3K',
              icon: Stethoscope,
              status: 'Siaga 24J',
              statusColor: 'emerald',
              onClick: () => onNavigate('health'),
            },
            {
              id: 'logistics',
              title: 'Gudang Logistik',
              icon: Boxes,
              status: '48 Item',
              statusColor: 'amber',
              onClick: () => onNavigate('logistics'),
            },
            {
              id: 'public_home',
              title: 'Buku Tamu / Pengunjung',
              icon: Globe,
              status: `${visitorCount} Tamu`,
              statusColor: 'slate',
              onClick: () => onNavigate('public_home'),
            },
          ]}
        />

        {/* 3. PUBLIKASI */}
        <ModuleGroup
          title="Publikasi"
          icon={ImageIcon}
          isOpen={expandedSections.publikasi}
          onToggle={() => toggleSection('publikasi')}
          items={[
            {
              id: 'public_gallery',
              title: 'Galeri Liputan Resmi',
              icon: ImageIcon,
              status: 'Dokumentasi',
              statusColor: 'blue',
              onClick: () => onNavigate('public_gallery'),
            },
            {
              id: 'event_studio_media',
              title: 'Hero Banner & Pengumuman',
              icon: Sparkles,
              status: 'Publik',
              statusColor: 'purple',
              onClick: () => onNavigate('event_studio'),
            },
            {
              id: 'event_studio_sponsor',
              title: 'Logo Sponsor & Kemitraan',
              icon: Building2,
              status: 'Aktif',
              statusColor: 'emerald',
              onClick: () => onNavigate('event_studio'),
            },
          ]}
        />

        {/* 4. DOKUMEN */}
        <ModuleGroup
          title="Dokumen"
          icon={CreditCard}
          isOpen={expandedSections.dokumen}
          onToggle={() => toggleSection('dokumen')}
          items={[
            {
              id: 'templates_idcard',
              title: 'Desain & Cetak ID Card',
              icon: CreditCard,
              status: 'QR Siap',
              statusColor: 'emerald',
              onClick: () => onNavigate('templates'),
            },
            {
              id: 'templates_cert',
              title: 'Piagam & Sertifikat',
              icon: FileText,
              status: 'Template',
              statusColor: 'purple',
              onClick: () => onNavigate('templates'),
            },
            {
              id: 'templates_canvas',
              title: 'Studio Desain Dokumen',
              icon: Layers,
              status: 'WYSIWYG',
              statusColor: 'blue',
              onClick: () => onNavigate('templates'),
            },
          ]}
        />

        {/* 5. SISTEM (Advanced controls separated from daily operations - Requirement 36) */}
        <ModuleGroup
          title="Sistem & Konfigurasi"
          icon={Database}
          isOpen={expandedSections.sistem}
          onToggle={() => toggleSection('sistem')}
          items={[
            ...(canReadInstallation(authService.getCurrentUser()?.role) ? [
              {
                id: 'installation',
                title: 'Konfigurasi Sistem',
                icon: ShieldCheck,
                status: customerInstallationService.isConfigured() ? 'Terkonfigurasi' : 'Perlu Konfigurasi',
                statusColor: (customerInstallationService.isConfigured() ? 'emerald' : 'amber') as any,
                onClick: () => onNavigate('installation'),
              },
            ] : []),
            {
              id: 'database_storage',
              title: 'Database Spreadsheet',
              icon: Database,
              status: isDbConnected ? 'Terhubung' : 'Perlu Cek',
              statusColor: isDbConnected ? 'emerald' : 'amber',
              onClick: () => onNavigate('database_storage'),
            },
            {
              id: 'branding_settings',
              title: 'Branding & Tampilan Kwartir',
              icon: Sparkles,
              status: 'Tampilan',
              statusColor: 'purple',
              onClick: () => onNavigate('branding_settings'),
            },
            {
              id: 'users',
              title: 'Pengguna & Hak Akses (RBAC)',
              icon: ShieldCheck,
              status: 'Hak Akses',
              statusColor: 'slate',
              onClick: () => onNavigate('users'),
            },
            {
              id: 'organizations',
              title: 'Struktur Organisasi Kwartir',
              icon: Building2,
              status: 'Kwarcab',
              statusColor: 'slate',
              onClick: () => onNavigate('organizations'),
            },
            {
              id: 'system_update',
              title: 'Status & Pembaruan Sistem',
              icon: ArrowUpCircle,
              status: 'v1.4',
              statusColor: 'blue',
              onClick: () => onNavigate('system_update'),
            },
          ]}
        />
      </div>

      {/* =========================================================================
          SECTION 7: RECENT ACTIVITY (Requirement 25: 3-5 records + Lihat Semua)
          ========================================================================= */}
      <RecentActivityList activities={recentActivities} />

      {/* =========================================================================
          SECTION 8: ONBOARDING QUICK CHECKLIST (Requirement 40)
          Progressive onboarding indicator for peace of mind
          ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-[24px] bg-slate-50 dark:bg-white/[0.03] border border-[#ECECEF] dark:border-white/5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#171717] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            <span>Kesiapan Operasional Event</span>
          </span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            5/6 Siap
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span className="text-emerald-600 font-bold">✓</span> Database Spreadsheet
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span className="text-emerald-600 font-bold">✓</span> Identitas & Logo Kwartir
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span className="text-emerald-600 font-bold">✓</span> Jadwal Sesi Hari 1
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span className="text-emerald-600 font-bold">✓</span> Barcode ID Card Peserta
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span className="text-emerald-600 font-bold">✓</span> Posko Kesehatan & Medis
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="text-amber-500 font-bold">○</span> Penilaian Juara Final
          </div>
        </div>
      </div>
    </div>
  );
};
