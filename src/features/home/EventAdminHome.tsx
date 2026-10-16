/**
 * SiEpang — beranda admin berbasis kartu navigasi ringkas.
 *
 * Prinsip:
 * - Satu halaman/fungsi utama = satu kartu.
 * - Tidak mengulang menu yang sudah tersedia di sidebar.
 * - Navigasi tetap melalui onNavigate; tidak ada perubahan backend/GAS.
 * - Feature control dan permission yang sudah ada tetap dipakai.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  LayoutGrid,
  MapPinned,
  Medal,
  QrCode,
  RefreshCw,
  TentTree,
  Trophy,
  Users,
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

/**
 * Dashboard hanya menampilkan fungsi kerja utama.
 *
 * Sengaja tidak memasukkan:
 * - Profil Saya
 * - Portal Publik
 * - Pengguna
 * - ID Card
 * - Branding
 * - Database Spreadsheet
 * - Akses Panitia
 *
 * Menu-menu tersebut tetap tersedia melalui sidebar sesuai role.
 *
 * event_studio hanya muncul sekali sebagai "Kelola Event" agar tidak ada
 * dua kartu berbeda yang membawa pengguna ke halaman yang sama.
 */
const QUICK_TILES: Tile[] = [
  {
    label: 'Data Peserta',
    description: 'Pendaftaran & verifikasi',
    tab: 'participants',
    icon: Users,
  },
  {
    label: 'Jadwal Kegiatan',
    description: 'Seluruh agenda perkemahan',
    tab: 'schedule',
    icon: CalendarDays,
    feature: 'SCHEDULE',
  },
  {
    label: 'Unjuk Karya',
    description: 'Photo & video karya peserta',
    tab: 'competitions',
    icon: Trophy,
    feature: 'COMPETITION',
  },
  {
    label: 'Presensi',
    description: 'Kehadiran peserta',
    tab: 'attendance',
    icon: ClipboardCheck,
  },
  {
    label: 'Penjurian',
    description: 'Input nilai & hasil',
    tab: 'judge',
    icon: Medal,
  },
  {
    label: 'Peringkat & XP',
    description: 'Poin dan apresiasi peserta',
    tab: 'leaderboard',
    icon: Trophy,
    feature: 'POINTS_XP',
  },
  {
    label: 'Kelola Event',
    description: 'Denah, kavling & fasilitas',
    tab: 'event_studio',
    icon: MapPinned,
  },
];

export const EventAdminHome: React.FC<EventAdminHomeProps> = ({
  onNavigate,
  onOpenScanner,
  onOpenSyncCenter,
}) => {
  const [event, setEvent] = useState(() => eventService.getCurrentEvent());
  const [featureRevision, setFeatureRevision] = useState(0);

  useEffect(() => {
    const unEvent = eventService.subscribe(() => {
      setEvent(eventService.getCurrentEvent());
    });

    const unFeatures = featureControlService.subscribe(() => {
      setFeatureRevision(value => value + 1);
    });

    return () => {
      unEvent();
      unFeatures();
    };
  }, []);

  const tiles = useMemo(
    () =>
      QUICK_TILES.filter(
        tile =>
          !tile.feature ||
          featureControlService.isFeatureEnabled(tile.feature as any),
      ),
    [featureRevision],
  );

  const eventName = event?.name?.trim() || 'Belum ada event aktif';
  const place = (event?.location || event?.venue || '').trim();
  const dates = [event?.startDate, event?.endDate].filter(Boolean).join(' – ');

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 p-5 text-white shadow-sm sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[32px] border-white/10"
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-100">
              <TentTree className="h-4 w-4" />
              Ruang Kerja Admin
            </p>

            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Kelola SiEpang
            </h1>

            <p className="text-base font-semibold">{eventName}</p>

            {(place || dates) && (
              <p className="text-sm text-emerald-100">
                {[place, dates].filter(Boolean).join(' · ')}
              </p>
            )}

            <p className="text-sm text-emerald-50/90">
              Akses fungsi utama perkemahan dari satu tempat. Menu administrasi
              lainnya tersedia di sidebar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <QrCode className="h-5 w-5" />
              Scan QR
            </button>

            <button
              type="button"
              onClick={onOpenSyncCenter}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <RefreshCw className="h-4 w-4" />
              Pusat Sinkronisasi
            </button>
          </div>
        </div>
      </section>

      <section className="relative space-y-3 overflow-visible pb-2" aria-label="Akses cepat">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <LayoutGrid className="h-5 w-5" />
          </span>

          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Akses Cepat
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Fungsi utama yang paling sering digunakan panitia
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 auto-rows-max overflow-visible">
          {tiles.map(({ label, description, tab, icon: Icon }) => (
            <button
              key={`${tab}-${label}`}
              type="button"
              onClick={() => onNavigate(tab)}
              className="group flex min-h-[142px] flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-white/10 dark:bg-slate-900 dark:hover:border-emerald-500"
            >
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Icon className="h-5 w-5" />
              </span>

              <span className="flex w-full items-center justify-between gap-1 text-sm font-bold text-slate-900 dark:text-white">
                {label}
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-emerald-600" />
              </span>

              <span className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {description}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
};
