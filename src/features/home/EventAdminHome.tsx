/**
 * SiEpang Model A – dashboard operasional satu event aktif.
 * Tidak melakukan fetch otomatis: navigasi dan pemindaian QR tetap responsif.
 * Hak akses pada halaman tujuan tetap divalidasi oleh App.tsx dan backend GAS.
 */
import React, { useEffect, useState } from 'react';
import {
  CalendarDays, CheckCircle2, ClipboardList, ContactRound, CreditCard,
  FileText, Globe2, HeartHandshake, Medal, QrCode, Settings2,
  ShieldCheck, Trophy, Users, Zap, ArrowRight, Tent,
} from 'lucide-react';
import { eventService } from '../../services/eventService';
import { NavTab } from '../../components/navigation/MobileNavigation';

interface EventAdminHomeProps {
  onNavigate: (tab: NavTab) => void;
  onOpenScanner: () => void;
  onOpenSyncCenter: () => void;
  canManageUsers?: boolean;
}

export const EventAdminHome: React.FC<EventAdminHomeProps> = ({
  onNavigate, onOpenScanner, canManageUsers = false,
}) => {
  const [event, setEvent] = useState(() => eventService.getCurrentEvent());
  useEffect(() => eventService.subscribe(() => setEvent(eventService.getCurrentEvent())), []);

  const shortcuts = [
    { label: 'Peserta', icon: ContactRound, tab: 'participants' as NavTab, desc: 'Daftar & verifikasi' },
    { label: 'Jadwal', icon: CalendarDays, tab: 'schedule' as NavTab, desc: 'Rundown kegiatan' },
    { label: 'Lomba', icon: Trophy, tab: 'competitions' as NavTab, desc: 'Cabang & peserta' },
    { label: 'Penjurian', icon: Medal, tab: 'judge' as NavTab, desc: 'Input nilai juri' },
    { label: 'Presensi', icon: CheckCircle2, tab: 'attendance' as NavTab, desc: 'Kehadiran acara' },
    { label: 'Apresiasi & XP', icon: Zap, tab: 'leaderboard' as NavTab, desc: 'Poin & peringkat' },
    { label: 'ID Card & Sertifikat', icon: CreditCard, tab: 'templates' as NavTab, desc: 'Dokumen peserta' },
    { label: 'Beranda Publik', icon: Globe2, tab: 'public_home' as NavTab, desc: 'Informasi kegiatan' },
    { label: 'Pengaturan Event', icon: Settings2, tab: 'event_studio' as NavTab, desc: 'Konfigurasi kegiatan' },
    { label: 'Akses Panitia', icon: ShieldCheck, tab: 'users' as NavTab, desc: 'Akun & hak akses' },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-[#A92224] text-white p-5 sm:p-8 shadow-sm">
        <div className="absolute -right-10 -top-12 h-48 w-48 rounded-full bg-white/10 pointer-events-none" />
        <div className="relative space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            <Tent className="h-4 w-4" /> Model A · Satu event aktif
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Dashboard Panitia</h1>
          <p className="font-semibold text-white/95">{event.name || 'Event belum dikonfigurasi'}</p>
          <p className="text-sm text-white/80">{[event.location || event.venue, event.startDate && event.endDate ? `${event.startDate} – ${event.endDate}` : event.startDate].filter(Boolean).join(' · ') || 'Kelola operasional kegiatan dari satu tempat.'}</p>
          <button type="button" onClick={onOpenScanner} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#F5C844] px-5 py-3 text-sm font-black text-[#241910] shadow-sm active:scale-[0.98] transition-transform cursor-pointer">
            <QrCode className="h-5 w-5" /> Buka Scan QR Sekarang
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Operasional Event</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">Pilih fitur sesuai tugas panitia. Halaman ini tidak memuat seluruh database saat dibuka.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shortcuts.filter(item => item.tab !== 'users' || canManageUsers).map(({ label, icon: Icon, tab, desc }) => (
            <button key={tab} type="button" onClick={() => onNavigate(tab)} className="group min-h-[120px] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-red-300 hover:shadow-md active:scale-[0.98] dark:border-white/10 dark:bg-[#1B1B21] cursor-pointer">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#A92224] dark:bg-red-500/15 dark:text-red-300"><Icon className="h-5 w-5" /></span>
              <span className="block text-sm font-extrabold text-slate-900 dark:text-white">{label}</span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-300">{desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-amber-800 dark:text-amber-300" />
          <div className="space-y-1">
            <h2 className="font-bold text-slate-900 dark:text-white">Pengelolaan berbasis event</h2>
            <p className="text-sm text-slate-700 dark:text-slate-200">Data peserta, penilaian, presensi, ID card, dan publikasi tetap menggunakan event aktif. Struktur kwartir tidak lagi menjadi menu operasional.</p>
          </div>
        </div>
      </section>
    </main>
  );
};
