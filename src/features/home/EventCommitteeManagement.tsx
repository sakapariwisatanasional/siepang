/** Editor susunan kepanitiaan formal, khusus admin event.
 * Terpisah dari akun/role. Simpan terlebih dulu sebelum dianggap resmi.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Save, Trash2, Users, X, Pencil } from 'lucide-react';
import { eventCommitteeService, CommitteeMember } from '../../services/eventCommitteeService';
import { userManagementService, ManagedUser } from '../../services/userManagementService';
import { OFFICIAL_COMMITTEE_POSITIONS, getCommitteePosition } from '../../services/committeePositionCatalog';

const TITLES = OFFICIAL_COMMITTEE_POSITIONS.map(item => item.title);
const DIVISIONS = Array.from(new Set(OFFICIAL_COMMITTEE_POSITIONS.map(item => item.division)));
const blank = (): CommitteeMember => ({ id: `pan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, name: '', position: '', division: '', phone: '', notes: '', userId: '' });
const fieldClass = 'w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-[#15151B] dark:text-white focus:outline-none focus:ring-2 focus:ring-red-400';

interface Props { onManageAccounts?: () => void }

export const EventCommitteeManagement: React.FC<Props> = ({ onManageAccounts }) => {
  const [accounts, setAccounts] = useState<ManagedUser[]>(() => userManagementService.getUsers());
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountError, setAccountError] = useState('');
  const refreshAccounts = async () => {
    if (loadingAccounts) return;
    setLoadingAccounts(true); setAccountError('');
    try { setAccounts(await userManagementService.refreshUsers()); }
    catch (error) { setAccountError(error instanceof Error ? error.message : 'Gagal mengambil daftar akun.'); }
    finally { setLoadingAccounts(false); }
  };
  const accountById = (id: string) => accounts.find(account => String(account.id) === id);

  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [edit, setEdit] = useState<CommitteeMember | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (dirty && !window.confirm('Perubahan yang belum disimpan akan hilang. Muat ulang?')) return;
    setLoading(true); setError(''); setMessage('');
    try { const doc = await eventCommitteeService.load(); setMembers(doc.members); setDirty(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal mengambil data panitia.'); }
    finally { setLoading(false); }
  }, [dirty]);

  useEffect(() => {
    let active = true;
    eventCommitteeService.load().then(doc => { if (active) { setMembers(doc.members); setDirty(false); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Gagal memuat panitia.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const commitEdit = () => {
    if (!edit) return;
    if (!edit.name.trim() || !getCommitteePosition(edit.position)) { setError('Nama wajib diisi dan jabatan harus dipilih dari 17 jabatan resmi.'); return; }
    setMembers(old => [...old.filter(m => m.id !== edit.id), { ...edit, name: edit.name.trim(), position: getCommitteePosition(edit.position)!.title, division: getCommitteePosition(edit.position)!.division }]);
    setDirty(true); setEdit(null); setError(''); setMessage('Perubahan belum disimpan ke database.');
  };
  const remove = (id: string) => {
    if (!window.confirm('Hapus petugas dari susunan panitia? Perubahan baru berlaku setelah disimpan.')) return;
    setMembers(old => old.filter(m => m.id !== id)); setDirty(true); setMessage('Perubahan belum disimpan ke database.');
  };
  const save = async () => {
    if (saving || loading || !dirty) return;
    setSaving(true); setError(''); setMessage('');
    try { const doc = await eventCommitteeService.save(members); setMembers(doc.members); setDirty(false); setMessage('Susunan panitia berhasil tersimpan di database event.'); }
    catch (e) { setError(`${e instanceof Error ? e.message : 'Penyimpanan gagal.'} Jika terjadi timeout, muat ulang untuk memastikan statusnya sebelum mencoba simpan lagi.`); }
    finally { setSaving(false); }
  };

  return <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1B1B21] sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white"><Users className="h-5 w-5 text-[#A92224]" />Susunan Panitia Resmi</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Susun jabatan dan bidang kerja untuk event aktif. Jabatan di sini tidak otomatis memberi akses aplikasi.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={loading || saving} onClick={() => void refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800 disabled:opacity-50 dark:border-white/20 dark:text-white"><RefreshCw className="h-4 w-4" />Muat ulang</button>
        <button type="button" onClick={() => { setEdit(blank()); setError(''); }} disabled={loading || saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Tambah</button>
        <button type="button" onClick={() => void save()} disabled={!dirty || saving || loading || edit !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#A92224] px-3 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Menyimpan…' : 'Simpan ke GAS'}</button>
      </div>
    </div>
    {dirty && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Ada perubahan yang belum disimpan.</p>}
    {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">{message}</p>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{error}</p>}
    {loading ? <p className="mt-4 text-sm text-slate-500">Memuat susunan panitia…</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{members.map(m => <article key={m.id} className="rounded-2xl border border-slate-200 p-3 dark:border-white/10"><p className="font-extrabold text-slate-900 dark:text-white">{m.name}</p><p className="text-sm font-semibold text-[#A92224] dark:text-red-300">{m.position}</p><p className="text-xs text-slate-600 dark:text-slate-300">{m.division || 'Tanpa bidang'}{m.phone ? ` · ${m.phone}` : ''}</p>{m.userId && <p className="mt-2 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200">{accountById(m.userId) ? `Akun tertaut: ${accountById(m.userId)?.name || accountById(m.userId)?.email} · ${accountById(m.userId)?.status === 'active' ? 'Aktif' : 'Nonaktif'}` : `Akun tertaut: ${m.userId} (belum ditemukan pada daftar akun)`}</p>}{m.notes && <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{m.notes}</p>}<div className="mt-3 flex gap-2"><button type="button" disabled={saving} onClick={() => setEdit({...m})} className="flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm dark:border-white/20 dark:text-white"><Pencil className="h-4 w-4" />Edit</button><button type="button" disabled={saving} onClick={() => remove(m.id)} className="flex min-h-11 items-center gap-1 rounded-lg border border-red-200 px-3 text-sm text-red-700 dark:text-red-300"><Trash2 className="h-4 w-4" />Hapus</button></div></article>)}{!members.length && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600 dark:text-slate-300">Belum ada susunan panitia. Tekan Tambah untuk mulai.</p>}</div>}
    {edit && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="presentation"><div role="dialog" aria-modal="true" aria-label="Form petugas panitia" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-[#1B1B21] sm:rounded-3xl"><div className="mb-4 flex justify-between"><h3 className="text-lg font-black dark:text-white">Data Panitia</h3><button type="button" onClick={() => setEdit(null)} className="rounded-lg p-2 dark:text-white" aria-label="Tutup"><X /></button></div><div className="grid gap-3"><label className="text-sm font-semibold dark:text-white">Nama lengkap<input className={`${fieldClass} mt-1`} value={edit.name} maxLength={120} onChange={e => setEdit({...edit,name:e.target.value})}/></label><label className="text-sm font-semibold dark:text-white">Jabatan<select required className={`${fieldClass} mt-1`} value={edit.position} onChange={e => { const pos = getCommitteePosition(e.target.value); setEdit({...edit, position: pos?.title || '', division: pos?.division || ''}); }}><option value="">Pilih jabatan resmi</option>{TITLES.map(t=><option key={t} value={t}>{t}</option>)}{edit.position && !getCommitteePosition(edit.position) && <option value={edit.position} disabled>Jabatan lama: {edit.position} (perlu penyesuaian)</option>}</select></label><label className="text-sm font-semibold dark:text-white">Bidang<input list="panitia-bidang" className={`${fieldClass} mt-1`} value={edit.division} maxLength={100} onChange={e => setEdit({...edit,division:e.target.value})}/><datalist id="panitia-bidang">{DIVISIONS.map(t=><option key={t} value={t}/>)}</datalist></label><label className="text-sm font-semibold dark:text-white">Kontak (opsional)<input className={`${fieldClass} mt-1`} value={edit.phone} maxLength={50} onChange={e => setEdit({...edit,phone:e.target.value})}/></label><label className="text-sm font-semibold dark:text-white">Keterangan<textarea className={`${fieldClass} mt-1`} rows={3} maxLength={500} value={edit.notes} onChange={e => setEdit({...edit,notes:e.target.value})}/></label><div className="rounded-xl border border-slate-200 p-3 dark:border-white/15"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-900 dark:text-white">Tautkan akun login (opsional)</span><button type="button" disabled={loadingAccounts} onClick={() => void refreshAccounts()} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-800 disabled:opacity-50 dark:border-white/20 dark:text-white">{loadingAccounts ? 'Memuat akun…' : 'Perbarui daftar akun'}</button></div><select className={fieldClass} value={edit.userId} onChange={e => setEdit({...edit, userId: e.target.value})}><option value="">Tanpa akun login</option>{edit.userId && !accountById(edit.userId) && <option value={edit.userId}>Akun lama: {edit.userId} (tidak ada di daftar saat ini)</option>}{accounts.map(account => <option key={account.id} value={String(account.id)}>{account.name || account.email || account.id} · {account.role} · {account.status === 'active' ? 'Aktif' : 'Nonaktif'}</option>)}</select>{edit.userId && accountById(edit.userId)?.status !== 'active' && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Akun yang dipilih belum terverifikasi aktif pada daftar akun. Periksa menu Akses Panitia.</p>}{accountError && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{accountError}</p>}<p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Penautan ini hanya mencatat identitas akun. Tidak mengubah peran, izin akses, atau penugasan juri di GAS.</p>{onManageAccounts && <button type="button" onClick={onManageAccounts} className="mt-2 min-h-10 text-sm font-bold text-[#A92224] underline dark:text-red-300">Buka Akses Panitia</button>}</div><button type="button" onClick={commitEdit} className="min-h-12 rounded-xl bg-[#A92224] px-4 font-black text-white">Masukkan ke Susunan</button></div></div></div>}
  </section>;
};
