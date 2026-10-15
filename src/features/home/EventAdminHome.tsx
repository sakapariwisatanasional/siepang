/**
 * SiEpang — beranda Admin berbasis kartu navigasi.
 * Setiap kartu berpindah halaman melalui onNavigate, bukan scroll/anchor.
 * Informasi kegiatan berasal dari eventService (GAS-backed store), tanpa data demo.
 * Otorisasi halaman tujuan tetap wajib diperiksa App.tsx dan GAS.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, CalendarDays, ClipboardCheck, CreditCard, Globe2,
  Medal, QrCode, Settings2, ShieldCheck, TentTree, Trophy, Users,
  UserRound, Activity, LayoutGrid, MapPinned, RefreshCw,
} from 'lucide-react';
import { eventService } from '../../services/eventService';
import { featureControlService } from '../../services/featureControlService';
import type { NavTab } from '../../components/navigation/MobileNavigation';

interface EventAdminHomeProps {
  onNavigate: (tab: NavTab) => void;
  onOpenScanner: () => void;
  onOpenSyncCenter: () => void;
  canManageUsers?: boolean;
}

type Tile = {
  label: string;
  description: string;
  tab: NavTab;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string;
  requiresManager?: boolean;
};

const GROUPS: { heading: string; subtitle: string; tiles: Tile[] }[] = [
  {
    heading: 'Operasional Perkemahan',
    subtitle: 'Pengelolaan kegiatan, peserta, dan fasilitas',
    tiles: [
      { label: 'Data Peserta', description: 'Pendaftaran & verifikasi', tab: 'participants', icon: Users },
      { label: 'Jadwal', description: 'Rangkaian kegiatan', tab: 'schedule', icon: CalendarDays, feature: 'SCHEDULE' },
      { label: 'Perlombaan', description: 'Cabang & pendaftaran', tab: 'competitions', icon: Trophy, feature: 'COMPETITION' },
      { label: 'Presensi', description: 'Kehadiran peserta', tab: 'attendance', icon: ClipboardCheck },
      { label: 'Penjurian', description: 'Input nilai & hasil', tab: 'judge', icon: Medal },
      { label: 'Manajemen Event', description: 'Denah, kavling & fasilitas', tab: 'event_studio', icon: MapPinned },
    ],
  },
  {
    heading: 'Akun & Administrasi',
    subtitle: 'Pengaturan sistem dan layanan dokumen',
    tiles: [
      { label: 'Pengguna', description: 'Akun dan akses panitia', tab: 'users', icon: ShieldCheck, requiresManager: true },
      { label: 'ID Card', description: 'Kartu & sertifikat', tab: 'templates', icon: CreditCard },
      { label: 'Profil Saya', description: 'Identitas dan foto', tab: 'profile', icon: UserRound },
      { label: 'Pengaturan Event', description: 'Konfigurasi kegiatan', tab: 'event_studio', icon: Settings2 },
      { label: 'Portal Publik', description: 'Pratinjau informasi umum', tab: 'public_home', icon: Globe2 },
      { label: 'Peringkat', description: 'Poin dan apresiasi', tab: 'leaderboard', icon: Activity, feature: 'POINTS_XP' },
    ],
  },
];

export const EventAdminHome: React.FC<EventAdminHomeProps> = ({
  onNavigate, onOpenScanner, onOpenSyncCenter, canManageUsers = false,
}) => {
  const [event, setEvent] = useState(() => eventService.getCurrentEvent());
  const [featureRevision, setFeatureRevision] = useState(0);
  useEffect(() => {
    const unEvent = eventService.subscribe(() => setEvent(eventService.getCurrentEvent()));
    const unFeatures = featureControlService.subscribe(() => setFeatureRevision(x => x + 1));
    return () => { unEvent(); unFeatures(); };
  }, []);

  const groups = useMemo(() => GROUPS.map(group => ({
    ...group,
    tiles: group.tiles.filter(tile =>
      (!tile.requiresManager || canManageUsers) &&
      (!tile.feature || featureControlService.isFeatureEnabled(tile.feature as any))
    ),
  })).filter(group => group.tiles.length > 0), [canManageUsers, featureRevision]);

  const eventName = event?.name?.trim() || 'Belum ada event aktif';
  const place = (event?.location || event?.venue || '').trim();
  const dates = [event?.startDate, event?.endDate].filter(Boolean).join(' – ');

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 p-5 text-white shadow-sm sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[32px] border-white/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-100"><TentTree className="h-4 w-4" /> Ruang Kerja Admin</p>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Kelola SiEpang</h1>
            <p className="text-base font-semibold">{eventName}</p>
            {(place || dates) && <p className="text-sm text-emerald-100">{[place, dates].filter(Boolean).join(' · ')}</p>}
            <p className="text-sm text-emerald-50/90">Buka fitur melalui kartu di bawah. Tiap fitur tampil sebagai halaman tersendiri.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onOpenScanner} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><QrCode className="h-5 w-5" /> Scan QR</button>
            <button type="button" onClick={onOpenSyncCenter} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><RefreshCw className="h-4 w-4" /> Pusat Sinkronisasi</button>
          </div>
        </div>
      </section>

      {groups.map(group => (
        <section key={group.heading} className="space-y-3" aria-label={group.heading}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><LayoutGrid className="h-5 w-5" /></span>
            <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">{group.heading}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{group.subtitle}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {group.tiles.map(({ label, description, tab, icon: Icon }) => (
              <button key={`${group.heading}-${tab}-${label}`} type="button" onClick={() => onNavigate(tab)} className="group flex min-h-[142px] flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-white/10 dark:bg-slate-900 dark:hover:border-emerald-500">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Icon className="h-5 w-5" /></span>
                <span className="flex w-full items-center justify-between gap-1 text-sm font-bold text-slate-900 dark:text-white">{label}<ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-emerald-600" /></span>
                <span className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
};
