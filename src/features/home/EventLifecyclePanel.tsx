/**
 * SiEpang Model A — Tahap 8 (persiapan siklus event).
 * Panel hanya-baca: TIDAK mengarsipkan event, mengubah Script Properties,
 * atau mengaktifkan event baru. Langkah mutasi menunggu backend atomik.
 */
import React, { useEffect, useState } from 'react';
import { Archive, CalendarDays, RefreshCw, ShieldAlert } from 'lucide-react';
import { eventService } from '../../services/eventService';
import type { NavTab } from '../../components/navigation/MobileNavigation';

interface EventLifecyclePanelProps {
  onNavigate: (tab: NavTab) => void;
}

const lifecycleSteps = [
  'Pastikan presensi, penjurian, dan transaksi XP telah selesai serta direkonsiliasi.',
  'Publikasikan hasil lomba resmi dan verifikasi dokumen peserta.',
  'Cadangkan Spreadsheet serta folder Google Drive untuk event ini.',
  'Pastikan backend mampu menutup event dan mengganti SIEPANG_ACTIVE_EVENT_ID secara aman.',
];

export const EventLifecyclePanel: React.FC<EventLifecyclePanelProps> = ({ onNavigate }) => {
  const [event, setEvent] = useState(() => eventService.getCurrentEvent());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<boolean[]>(() => lifecycleSteps.map(() => false));

  useEffect(() => eventService.subscribe(() => {
    setEvent(eventService.getCurrentEvent());
  }), []);

  useEffect(() => {
    setChecked(lifecycleSteps.map(() => false));
    setError('');
  }, [event.id]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError('');
    try {
      const result = await eventService.loadCurrentInstallationEventWithResult();
      if (result.state !== 'CONFIGURED') {
        setError(result.error || 'Belum dapat memastikan status event dari server.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Status event gagal diperbarui.');
    } finally {
      setRefreshing(false);
    }
  };

  const status = String(event.status || 'UNKNOWN').toUpperCase();
  const completed = checked.filter(Boolean).length;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1B1B21] sm:p-6" aria-labelledby="event-lifecycle-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">Model A · Satu event aktif</p>
          <h2 id="event-lifecycle-title" className="mt-1 text-lg font-black text-slate-900 dark:text-white">Siklus & Persiapan Arsip Event</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Pemeriksaan administratif sebelum kegiatan ditutup. Tidak mengubah database.</p>
        </div>
        <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60 dark:border-white/20 dark:text-white">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Memeriksa…' : 'Perbarui status'}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <p className="text-xs text-slate-500 dark:text-slate-300">Event aktif</p>
          <p className="mt-1 break-words font-bold text-slate-900 dark:text-white">{event.name || 'Belum dikonfigurasi'}</p>
          <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-300">ID: {event.id || 'Belum tersedia'}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <p className="text-xs text-slate-500 dark:text-slate-300">Status server terakhir</p>
          <p className="mt-1 font-bold text-slate-900 dark:text-white">{status}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><CalendarDays className="h-4 w-4" />{[event.startDate, event.endDate].filter(Boolean).join(' — ') || 'Tanggal belum tersedia'}</p>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{error}</p>}
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900 dark:text-white">Daftar persiapan panitia</h3>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{completed}/{lifecycleSteps.length} diperiksa</span>
        </div>
        <div className="space-y-2">
          {lifecycleSteps.map((step, i) => (
            <label key={step} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <input type="checkbox" checked={checked[i]} onChange={e => setChecked(prev => prev.map((v, idx) => idx === i ? e.target.checked : v))} className="mt-1 h-5 w-5 accent-red-700" />
              <span className="text-sm text-slate-800 dark:text-slate-100">{step}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">Checklist hanya tersimpan sementara di halaman ini; bukan bukti verifikasi otomatis dan akan kembali kosong ketika halaman dimuat ulang.</p>
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-800 dark:text-amber-300" />
        <div>
          <p className="font-bold text-amber-950 dark:text-amber-200">Pengarsipan belum diaktifkan</p>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">Backend masih bergantung pada SIEPANG_ACTIVE_EVENT_ID. Mengarsipkan event sebelum proses perpindahan atomik tersedia dapat membuat aplikasi kehilangan event aktif.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onNavigate('event_studio')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#A92224] px-4 py-2 text-sm font-bold text-white active:scale-[0.98]">Pengaturan Event</button>
        <span aria-disabled="true" title="Menunggu backend perpindahan event yang aman" className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 dark:border-white/20 dark:text-slate-400"><Archive className="h-4 w-4" />Arsipkan Event (belum tersedia)</span>
      </div>
    </section>
  );
};
