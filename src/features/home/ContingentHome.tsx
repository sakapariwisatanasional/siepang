/**
 * SiEpang — Dashboard Pembina / Pengelola Kontingen.
 * GAS remains the only source of truth. This view does not create or cache dummy records.
 * Install: src/features/home/ContingentHome.tsx (new file).
 * Requires a separate RoleHomeRouter.tsx change for kontingen_admin.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen, CalendarDays, ChevronRight, ClipboardCheck, CloudOff,
  MapPinned, RefreshCw, School, ShieldCheck, TentTree, UserRound, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NavTab } from '../../components/navigation/MobileNavigation';
import { gudepRegistrationService, type GudepRecord } from '../../services/gudepRegistrationService';

type Props = { onNavigate: (tab: NavTab) => void };
type CardConfig = { title: string; description: string; icon: LucideIcon; tab: NavTab; tint: string };

const shortcuts: CardConfig[] = [
  { title: 'Pangkalan & Gudep', description: 'Kelola data satuan dan pangkalan', icon: School, tab: 'organizations', tint: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' },
  { title: 'Regu & Anggota', description: 'Daftar serta kelengkapan regu', icon: Users, tab: 'participants', tint: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
  { title: 'Berkas Peserta', description: 'Pantau persyaratan pendaftaran', icon: ClipboardCheck, tab: 'participants', tint: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
  { title: 'Lokasi Kavling', description: 'Lihat informasi penempatan regu', icon: MapPinned, tab: 'event_studio', tint: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
  { title: 'Jadwal Kegiatan', description: 'Agenda dan kegiatan event', icon: CalendarDays, tab: 'schedule', tint: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10' },
  { title: 'Profil Saya', description: 'Perbarui informasi akun', icon: UserRound, tab: 'profile', tint: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' },
];

export const ContingentHome: React.FC<Props> = ({ onNavigate }) => {
  const [gudep, setGudep] = useState<GudepRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await gudepRegistrationService.list();
      setGudep(Array.isArray(result.gudep) ? result.gudep : []);
    } catch (err) {
      setGudep([]);
      setError(err instanceof Error ? err.message : 'Gagal memuat data Gugus Depan dari GAS.');
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 pb-12 sm:space-y-7">
      <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-700 to-teal-800 p-5 text-white shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><ShieldCheck className="h-4 w-4" /> Ruang Kerja Pembina</span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Pangkalan, Gudep & Regu</h1>
            <p className="mt-2 max-w-2xl text-sm text-emerald-50">Pantau pendaftaran, persyaratan, dan informasi penempatan regu dari satu tempat.</p>
          </div>
          <TentTree aria-hidden className="hidden h-12 w-12 shrink-0 text-white/80 sm:block" />
        </div>
      </section>

      <section aria-label="Akses cepat pembina" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Akses Cepat</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Menu sesuai hak akses akun</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {shortcuts.map(({ title, description, icon: Icon, tab, tint }) => (
            <button key={title} type="button" onClick={() => onNavigate(tab)} className="group flex min-h-[130px] flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-white/10 dark:bg-[#17191d]">
              <span className={`rounded-xl p-2.5 ${tint}`}><Icon className="h-6 w-6" aria-hidden /></span>
              <span className="flex w-full items-center justify-between gap-2 text-sm font-bold text-slate-900 dark:text-white">{title}<ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" /></span>
              <span className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#17191d] sm:p-5" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><BookOpen className="h-5 w-5" aria-hidden /></span>
            <div><h2 className="font-bold text-slate-900 dark:text-white">Data Gugus Depan</h2><p className="text-xs text-slate-500 dark:text-slate-400">Dibaca langsung melalui layanan GAS</p></div>
          </div>
          <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5" aria-label="Muat ulang data Gudep"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Segarkan</button>
        </div>
        {busy ? <p className="mt-4 text-sm text-slate-500">Memuat data dari GAS…</p> : error ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><CloudOff aria-hidden className="h-5 w-5 shrink-0" /><span>{error}</span></div>
        ) : (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{gudep.length}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gugus Depan yang dikembalikan API untuk cakupan akun saat ini. Daftar ini bukan klaim kepemilikan semua Gudep oleh Pembina.</p>
            {gudep.length === 0 && <p className="mt-2 text-xs text-slate-500">Belum ada data yang dikembalikan GAS.</p>}
          </div>
        )}
      </section>
      <p className="text-xs text-slate-500 dark:text-slate-400">Akses ke tiap fitur tetap divalidasi oleh sistem autentikasi dan hak akses GAS. Dashboard ini tidak menyimpan data dummy maupun hasil perubahan lokal.</p>
    </main>
  );
};
