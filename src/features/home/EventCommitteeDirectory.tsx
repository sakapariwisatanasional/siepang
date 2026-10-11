/**
 * SiEpang Model A — Direktori akun panitia event (tahap baca-saja).
 * Data bersumber dari userManagementService yang sudah digunakan aplikasi.
 * Jabatan kepanitiaan formal belum disimpan: role aplikasi ≠ jabatan panitia.
 * Tidak mengubah pengguna, hak akses, login, atau backend GAS.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, UserRound, Users } from 'lucide-react';
import { userManagementService, ManagedUser } from '../../services/userManagementService';

const OPERATIONAL_ROLES = new Set([
  'superadmin', 'workspace_admin', 'event_admin', 'committee', 'judge',
  'registration_officer', 'attendance_officer', 'health_officer',
  'logistic_officer', 'ceremony_officer', 'documentation_officer',
  'publication_officer',
]);

const ROLE_NAMES: Record<string, string> = {
  superadmin: 'Administrator Utama',
  workspace_admin: 'Administrator Sistem',
  event_admin: 'Admin Event',
  committee: 'Panitia',
  judge: 'Juri',
  registration_officer: 'Petugas Pendaftaran',
  attendance_officer: 'Petugas Presensi',
  health_officer: 'Petugas Kesehatan',
  logistic_officer: 'Petugas Logistik',
  ceremony_officer: 'Petugas Upacara',
  documentation_officer: 'Petugas Dokumentasi',
  publication_officer: 'Petugas Publikasi',
};

interface EventCommitteeDirectoryProps {
  onManageAccounts?: () => void;
}

export const EventCommitteeDirectory: React.FC<EventCommitteeDirectoryProps> = ({ onManageAccounts }) => {
  const [users, setUsers] = useState<ManagedUser[]>(() => userManagementService.getUsers());
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => userManagementService.subscribe(() => setUsers(userManagementService.getUsers())), []);

  const members = useMemo(() => users
    .filter(user => OPERATIONAL_ROLES.has(String(user.role)))
    .filter(user => `${user.name || ''} ${user.email || ''} ${ROLE_NAMES[String(user.role)] || user.role}`
      .toLocaleLowerCase('id-ID').includes(query.trim().toLocaleLowerCase('id-ID')))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id-ID')),
  [users, query]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError('');
    try {
      await userManagementService.refreshUsers();
      setUsers(userManagementService.getUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui data petugas.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1B1B21] sm:p-5" aria-label="Direktori petugas event">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#A92224] dark:text-red-300"><Users className="h-5 w-5" /><h2 className="text-lg font-black text-slate-900 dark:text-white">Petugas Event</h2></div>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">Direktori akun operasional yang tersedia. Jabatan formal seperti ketua, sekretaris, dan koordinator bidang akan dikelola dalam tahap berikutnya.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 transition active:scale-[0.98] disabled:opacity-60 dark:border-white/20 dark:text-slate-100">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Memuat...' : 'Perbarui'}
          </button>
          {onManageAccounts && <button type="button" onClick={onManageAccounts} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#A92224] px-3 py-2 text-sm font-bold text-white active:scale-[0.98]"><ShieldCheck className="h-4 w-4" />Kelola Akses</button>}
        </div>
      </div>
      <label className="relative mt-4 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <span className="sr-only">Cari petugas</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama atau tugas petugas" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-[#A92224] dark:border-white/20 dark:bg-[#121217] dark:text-white" />
      </label>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{error}</p>}
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">{members.length} akun operasional ditampilkan. Data dibaca dari akun aplikasi yang sudah tersedia.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {members.map(user => (
          <article key={user.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#A92224] dark:bg-red-500/15 dark:text-red-300"><UserRound className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{user.name || 'Tanpa nama'}</p>
              <p className="text-xs font-semibold text-[#A92224] dark:text-red-300">{ROLE_NAMES[String(user.role)] || String(user.role)}</p>
              <p className="truncate text-xs text-slate-600 dark:text-slate-300">{user.email || 'Email belum tersedia'}</p>
              <p className={`mt-1 text-xs font-medium ${user.status === 'inactive' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{user.status === 'inactive' ? 'Akun nonaktif' : 'Akun aktif'}</p>
            </div>
          </article>
        ))}
        {members.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600 dark:border-white/20 dark:text-slate-300">{query ? 'Tidak ada petugas yang sesuai pencarian.' : 'Belum ada akun petugas pada data yang tersedia. Tekan Perbarui untuk memuat dari server.'}</div>}
      </div>
    </section>
  );
};
