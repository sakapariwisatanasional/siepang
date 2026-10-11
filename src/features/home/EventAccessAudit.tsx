/**
 * SiEpang Model A – audit penautan panitia / akun event (read-only).
 * Tidak membuat, mengubah, atau memberikan izin GAS.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { eventCommitteeService, type CommitteeMember } from '../../services/eventCommitteeService';
import { userManagementService, type ManagedUser } from '../../services/userManagementService';

interface Props { onManageAccounts?: () => void }

type AuditItem = { member: CommitteeMember; category: 'unlinked' | 'missing' | 'inactive' | 'linked'; account?: ManagedUser };

export const EventAccessAudit: React.FC<Props> = ({ onManageAccounts }) => {
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [accounts, setAccounts] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Akun dan susunan panitia diambil hanya ketika panel dimuat/diperbarui.
      // refreshUsers() dapat mengembalikan cache ketika layanan tidak tersedia;
      // karena itu hasil tidak pernah dianggap sebagai otorisasi terverifikasi.
      const [document, currentAccounts] = await Promise.all([
        eventCommitteeService.load(),
        userManagementService.refreshUsers(),
      ]);
      setMembers(document.members);
      setAccounts(currentAccounts);
      setUpdatedAt(new Date().toLocaleString('id-ID'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Audit belum dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const findings = useMemo<AuditItem[]>(() => members.map(member => {
    if (!member.userId) return { member, category: 'unlinked' };
    const account = accounts.find(item => String(item.id) === String(member.userId));
    if (!account) return { member, category: 'missing' };
    if (account.status !== 'active') return { member, category: 'inactive', account };
    return { member, category: 'linked', account };
  }), [members, accounts]);
  const attention = findings.filter(item => item.category !== 'linked');

  const labels: Record<AuditItem['category'], string> = {
    unlinked: 'Belum ditautkan ke akun login',
    missing: 'Akun tertaut tidak ditemukan pada daftar akun',
    inactive: 'Akun tertaut berstatus nonaktif',
    linked: 'Akun tertaut dan tercatat aktif',
  };

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1B1B21] sm:p-5" aria-labelledby="event-access-audit-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="event-access-audit-heading" className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white"><ShieldAlert className="h-5 w-5 text-[#A92224]"/>Audit Penugasan Panitia</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Periksa kecocokan susunan panitia dan akun login event aktif. Panel ini tidak memberikan atau mencabut izin.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 disabled:opacity-50 dark:border-white/20 dark:text-white"><RefreshCw className="h-4 w-4"/>{loading ? 'Memeriksa…' : 'Periksa ulang'}</button>
      </div>
      <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
        <strong>Catatan keamanan:</strong> status akun di panel ini hanya informasi administratif dan dapat berasal dari cache. Izin sebenarnya harus diperiksa oleh GAS pada setiap aksi. Jabatan panitia atau akun yang tertaut tidak otomatis memberi akses fitur.
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {!error && !loading && <>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5"><p className="text-2xl font-black text-slate-900 dark:text-white">{members.length}</p><p className="text-xs text-slate-600 dark:text-slate-300">Anggota panitia</p></div>
          <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10"><p className="text-2xl font-black text-emerald-800 dark:text-emerald-300">{findings.length - attention.length}</p><p className="text-xs text-emerald-800 dark:text-emerald-300">Akun tercatat aktif</p></div>
          <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-500/10"><p className="text-2xl font-black text-amber-800 dark:text-amber-300">{attention.length}</p><p className="text-xs text-amber-800 dark:text-amber-300">Perlu diperiksa</p></div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {findings.map(({member, category, account}) => <article key={member.id} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <div className="flex items-start gap-2">{category === 'linked' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"/> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"/>}<div className="min-w-0"><p className="font-bold text-slate-900 dark:text-white">{member.name}</p><p className="text-xs text-slate-600 dark:text-slate-300">{member.position} · {member.division || 'Tanpa bidang'}</p><p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{labels[category]}</p>{account && <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{account.name || account.email || account.id} · {account.role}</p>}</div></div>
          </article>)}
          {!members.length && <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-white/20 dark:text-slate-300"><Users className="mr-2 inline h-4 w-4"/>Belum ada susunan panitia untuk event ini.</p>}
        </div>
        {updatedAt && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Terakhir diperiksa: {updatedAt}</p>}
      </>}
      {onManageAccounts && <button type="button" onClick={onManageAccounts} className="mt-4 min-h-11 rounded-xl bg-[#A92224] px-4 text-sm font-bold text-white">Buka Pengelolaan Akun & Izin</button>}
    </section>
  );
};
