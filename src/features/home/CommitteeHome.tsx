/**
 * SiEpang - Dashboard Panitia (Grid Card + Icon)
 * Perbaikan berdasarkan New siepang(2).zip.
 * Tidak menggunakan daftar tugas dummy, status keamanan fiktif, atau data hard-coded.
 * Sumber data operasional tetap service yang tersinkronisasi dengan GAS.
 */
import React, { useEffect, useState } from 'react';
import {
  CalendarDays, ClipboardCheck, HeartPulse, LayoutGrid,
  Megaphone, QrCode, Search, ShieldCheck, Users, ArrowUpRight,
  Clock3, UserRound,
} from 'lucide-react';
import { eventService } from '../../services/eventService';
import { participantService } from '../../services/participantService';
import { featureControlService } from '../../services/featureControlService';
import type { NavTab } from '../../components/navigation/MobileNavigation';

interface CommitteeHomeProps {
  onNavigate: (tab: NavTab) => void;
  onOpenScanner: () => void;
}

type Shortcut = {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  feature?: string;
  color: string;
};

export const CommitteeHome: React.FC<CommitteeHomeProps> = ({ onNavigate, onOpenScanner }) => {
  const [query, setQuery] = useState('');
  const [, refresh] = useState(0);

  // ParticipantService memperoleh data dari sinkronisasi GAS; perbarui tampilan
  // bila data layanan berubah. Jangan isi fallback dengan data fiktif.
  useEffect(() => {
    const unsubscribe = participantService.subscribe(() => refresh(v => v + 1));
    return unsubscribe;
  }, []);

  const event = eventService.getCurrentEvent();
  const participants = participantService.getParticipants();
  const checkedIn = participants.filter(p => p.checkedIn).length;
  const schedules = eventService.getSchedule(1);
  const matches = query.trim()
    ? participants.filter(p =>
        [p.name, p.code, p.contingentName].some(value =>
          String(value || '').toLowerCase().includes(query.trim().toLowerCase())
        )
      ).slice(0, 5)
    : [];

  const shortcuts: Shortcut[] = [
    { label: 'Pindai QR', description: 'Presensi dan check-in', icon: QrCode, onClick: onOpenScanner, color: 'emerald' },
    { label: 'Data Peserta', description: 'Temukan peserta', icon: Users, onClick: () => onNavigate('participants'), color: 'blue' },
    { label: 'Jadwal', description: 'Agenda kegiatan', icon: CalendarDays, onClick: () => onNavigate('schedule'), feature: 'SCHEDULE', color: 'violet' },
    { label: 'Presensi', description: 'Cek kehadiran', icon: ClipboardCheck, onClick: () => onNavigate('attendance'), feature: 'ATTENDANCE', color: 'amber' },
    { label: 'Kesehatan', description: 'Layanan medis', icon: HeartPulse, onClick: () => onNavigate('health'), color: 'rose' },
    { label: 'Informasi Event', description: 'Berita dan pengumuman', icon: Megaphone, onClick: () => onNavigate('public_home'), feature: 'PUBLIC_EVENT_PAGE', color: 'sky' },
    { label: 'Profil Saya', description: 'Biodata dan foto', icon: UserRound, onClick: () => onNavigate('profile'), color: 'slate' },
  ];
  const visibleShortcuts = shortcuts.filter(item => !item.feature || featureControlService.isFeatureEnabled(item.feature as Parameters<typeof featureControlService.isFeatureEnabled>[0]));
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 sm:p-7 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"><ShieldCheck className="h-4 w-4" /> Ruang Kerja Panitia</div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">Dashboard Panitia</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event?.shortName || 'SiEpang'} · Akses kegiatan dan layanan lapangan.</p>
          </div>
          <button type="button" onClick={onOpenScanner} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"><QrCode className="h-5 w-5" /> Mulai Scan QR</button>
        </div>
      </section>

      <section aria-label="Ringkasan data yang dimuat" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { name: 'Peserta dalam data', value: participants.length, icon: Users, color: 'text-blue-700' },
          { name: 'Sudah check-in', value: checkedIn, icon: ClipboardCheck, color: 'text-emerald-700' },
          { name: 'Jadwal termuat', value: schedules.length, icon: CalendarDays, color: 'text-violet-700' },
        ].map(metric => (
          <div key={metric.name} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#191b23]">
            <metric.icon className={`mb-3 h-5 w-5 ${metric.color}`} aria-hidden="true" />
            <div className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">{metric.value}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{metric.name}</div>
          </div>
        ))}
      </section>
      <p className="-mt-3 text-xs text-slate-500 dark:text-slate-400">Angka menampilkan data yang saat ini tersedia di layanan aplikasi. Jika sinkronisasi GAS belum selesai, angka belum tentu mencerminkan data terbaru.</p>

      <section aria-labelledby="committee-tools">
        <div className="mb-3 flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-emerald-700"/><h2 id="committee-tools" className="text-lg font-extrabold text-slate-900 dark:text-white">Layanan & Alat Kerja</h2></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visibleShortcuts.map(item => (
            <button type="button" key={item.label} onClick={item.onClick} className="group flex min-h-[140px] flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-white/10 dark:bg-[#191b23]">
              <div className="mb-3 flex w-full items-start justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[item.color]}`}><item.icon className="h-5 w-5"/></span><ArrowUpRight className="h-4 w-4 text-slate-400 opacity-60 group-hover:opacity-100"/></div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</span><span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#191b23]" aria-label="Cari peserta">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Search className="h-5 w-5 text-emerald-700"/> Cari Peserta / Kontingen</h2>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nama, nomor ID, atau kontingen" aria-label="Cari peserta" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-800 dark:text-white" />
          {query.trim() && <div className="mt-3 space-y-2">{matches.length ? matches.map(p => <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{p.name}</span><span className="block truncate text-xs text-slate-500 dark:text-slate-400">{p.contingentName || 'Belum ada kontingen'}</span></span><span className="shrink-0 text-xs text-slate-500">{p.checkedIn ? 'Sudah hadir' : 'Belum hadir'}</span></div>) : <p className="text-sm text-slate-500">Tidak ada hasil pada data yang termuat.</p>}</div>}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#191b23]" aria-label="Jadwal kegiatan">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Clock3 className="h-5 w-5 text-blue-700"/> Pratinjau Jadwal</h2><button type="button" onClick={() => onNavigate('schedule')} className="text-xs font-bold text-emerald-700 hover:underline">Lihat semua</button></div>
          {schedules.length ? <div className="space-y-2">{schedules.slice(0, 4).map(item => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><span><span className="block text-sm font-semibold text-slate-900 dark:text-white">{item.title}</span><span className="text-xs text-slate-500">{item.location}</span></span><span className="shrink-0 text-xs font-semibold text-emerald-700">{item.time}</span></div>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">Belum ada jadwal dalam data yang termuat.</p>}
        </section>
      </div>
      <p className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"><HeartPulse className="h-4 w-4 shrink-0"/> Bila ada keadaan darurat, segera hubungi posko kesehatan sesuai prosedur kegiatan.</p>
    </div>
  );
};
