/**
 * SiEpang — Administrasi Gugus Depan dan Regu (GAS authoritative).
 * Target: src/features/event_studio/GudepReguManager.tsx
 * No local-only writes. Permissions enforced on GAS.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, School, Users, AlertCircle, QrCode, X, Pencil } from 'lucide-react';
import { gudepRegistrationService, GudepRecord, GudepRegu, GudepAdvisor } from '../../services/gudepRegistrationService';
import { userManagementService, ManagedUser } from '../../services/userManagementService';
import { authService } from '../../services/authService';
import { GudepQrPanel } from './GudepQrPanel';

const newKey = (): string => `form_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#C62828] dark:border-white/15 dark:bg-white/5 dark:text-white';
const labelClass = 'block mb-1 text-xs font-bold text-slate-700 dark:text-slate-200';
const blankGudep = () => ({ gudep_number: '', gudep_name: '', institution_name: '', address: '', contact_name: '', contact_phone: '', contact_email: '' });
const blankRegu = () => ({ regu_name: '', gender: 'PUTRA' as 'PUTRA' | 'PUTRI', quota: 8 });

export const GudepReguManager: React.FC = () => {
  const [gudep, setGudep] = useState<GudepRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [regu, setRegu] = useState<GudepRegu[]>([]);
  const [advisors, setAdvisors] = useState<GudepAdvisor[]>([]);
  const [availableUsers, setAvailableUsers] = useState<ManagedUser[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [gForm, setGForm] = useState(blankGudep());
  const [editGudep, setEditGudep] = useState(false);
  const [editGudepForm, setEditGudepForm] = useState({ gudep_number: '', gudep_name: '', institution_name: '' });
  const [editingReguId, setEditingReguId] = useState('');
  const [editingReguName, setEditingReguName] = useState('');
  const [rForm, setRForm] = useState(blankRegu());
  const [addGudep, setAddGudep] = useState(false);
  const [addRegu, setAddRegu] = useState(false);
  const [showGudepQr, setShowGudepQr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [contingentNotes, setContingentNotes] = useState('');
  const [reguNotes, setReguNotes] = useState<Record<string, string>>({});
  const gudepKey = useRef(newKey());
  const reguKey = useRef(newKey());
  const detailRequest = useRef(0);
  const authState = authService.getAuthState();
  const roles = (authState.effectiveRoles || [authState.role]).map((role: unknown) => String(role || '').toLowerCase());
  const canAssignOperator = roles.includes('superadmin') || roles.includes('workspace_admin');
  const canVerify = roles.some((role: string) => ['superadmin', 'workspace_admin', 'event_admin', 'registration_officer'].includes(role));

  const load = useCallback(async (preferredId?: string) => {
    setLoading(true); setError('');
    try {
      const result = await gudepRegistrationService.list();
      const rows = result.gudep || [];
      setGudep(rows);
      setSelectedId(old => {
        const selected = preferredId || old;
        return rows.some(g => g.gudep_id === selected) ? selected : (rows[0]?.gudep_id || '');
      });
    } catch (e: any) { setError(e?.message || 'Gagal memuat Gudep dari GAS.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!canAssignOperator) return;
    let active = true;
    setUsersLoading(true);
    userManagementService.refreshUsers()
      .then(rows => { if (active) setAvailableUsers(rows.filter(user => user.status === 'active')); })
      .catch((e: any) => { if (active) setError(e?.message || 'Gagal memuat akun pengguna dari GAS.'); })
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, [canAssignOperator]);

  const assignOperator = async () => {
    if (!selectedId || !assignUserId || busy || !canAssignOperator) return;
    const target = availableUsers.find(user => user.id === assignUserId);
    if (!target) { setError('Pilih akun aktif yang tersedia.'); return; }
    if (!window.confirm(`Tugaskan ${target.name || target.email} untuk mengelola ${selected?.gudep_name || 'Gudep ini'}?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await gudepRegistrationService.assignExistingUser({ gudep_id: selectedId, user_id: assignUserId });
      // The Gudep assignment limits the data scope; registration_officer exposes the existing participant menu.
      // This is an additive role grant and does not revoke any existing role.
      await userManagementService.grantAdditionalRoles(assignUserId, ['registration_officer'], 'EVENT');
      setAvailableUsers(await userManagementService.refreshUsers());
      setMessage(`Akun ${target.name || target.email} berhasil ditugaskan ke ${selected?.gudep_name || 'Gudep'} dan diberi akses menu Data Peserta. Backend tetap membatasi pendaftaran ke Gudep yang ditugaskan.`);
      setAssignUserId('');
    } catch (e: any) {
      setError(`Penugasan mungkin sudah tersimpan di GudepOperatorAssignments, tetapi akses menu belum terkonfirmasi. Periksa penugasan akun sebelum mencoba ulang. Detail: ${e?.message || 'Kesalahan tidak diketahui.'}`);
    } finally { setBusy(false); }
  };
  useEffect(() => {
    const current = ++detailRequest.current;
    if (!selectedId) { setRegu([]); setAdvisors([]); setDetailLoading(false); return; }
    setDetailLoading(true); setRegu([]); setAdvisors([]);
    gudepRegistrationService.detail(selectedId).then(data => {
      if (current === detailRequest.current) { setRegu(data.regu || []); setAdvisors(data.advisors || []); }
    }).catch((e: any) => {
      if (current === detailRequest.current) setError(e?.message || 'Gagal membaca regu.');
    }).finally(() => { if (current === detailRequest.current) setDetailLoading(false); });
  }, [selectedId]);

  const createGudep = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await gudepRegistrationService.create({ ...gForm, request_key: gudepKey.current });
      setMessage(`Gudep ${result.gudep.gudep_name} berhasil disimpan di GAS.`);
      gudepKey.current = newKey(); setGForm(blankGudep()); setAddGudep(false);
      await load(result.gudep.gudep_id);
    } catch (err: any) { setError(err?.message || 'Penyimpanan Gudep gagal. Cek GAS sebelum mencoba dengan data baru.'); }
    finally { setBusy(false); }
  };

  const createRegu = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy || !selectedId) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await gudepRegistrationService.createRegu({ ...rForm, gudep_id: selectedId, request_key: reguKey.current });
      setMessage(`Regu ${result.regu.regu_name} berhasil disimpan di GAS.`);
      reguKey.current = newKey(); setRForm(blankRegu()); setAddRegu(false);
      const updated = await gudepRegistrationService.detail(selectedId);
      setRegu(updated.regu || []); setAdvisors(updated.advisors || []);
    } catch (err: any) { setError(err?.message || 'Penyimpanan regu gagal.'); }
    finally { setBusy(false); }
  };
  const submitGudep = async () => {
    if (busy || !selectedId) return;
    if (!window.confirm('Ajukan Gudep ini ke Admin untuk verifikasi? Setelah diajukan, data terkunci sampai keputusan Admin.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await gudepRegistrationService.submit(selectedId);
      await load(selectedId);
      setMessage('Pengajuan Gudep berhasil disimpan ke GAS. Status: SUBMITTED.');
    } catch (e: any) { setError(e?.message || 'Gagal mengajukan Gudep.'); }
    finally { setBusy(false); }
  };

  const decideGudep = async (decision: 'VERIFIED' | 'REVISION' | 'REJECTED') => {
    if (busy || !selectedId) return;
    const note = decisionNotes.trim();
    if (decision !== 'VERIFIED' && !note) { setError('Alasan perbaikan atau penolakan wajib diisi.'); return; }
    const label = decision === 'VERIFIED' ? 'Setujui' : decision === 'REVISION' ? 'Minta revisi' : 'Tolak';
    if (!window.confirm(`${label} pendaftaran Gudep ini?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await gudepRegistrationService.verify(selectedId, decision, note);
      setDecisionNotes('');
      await load(selectedId);
      const fresh = await gudepRegistrationService.detail(selectedId);
      setRegu(fresh.regu || []); setAdvisors(fresh.advisors || []);
      setMessage(`Keputusan verifikasi Gudep ${decision} berhasil disimpan ke GAS. Verifikasi Regu dilakukan secara terpisah.`);
    } catch (e: any) { setError(e?.message || 'Gagal menyimpan keputusan verifikasi.'); }
    finally { setBusy(false); }
  };

  const decideContingent = async (decision: 'VERIFIED' | 'REVISION' | 'REJECTED') => {
    if (busy || !selectedId) return;
    const note = contingentNotes.trim();
    if (decision !== 'VERIFIED' && !note) { setError('Alasan revisi atau penolakan kontingen wajib diisi.'); return; }
    const label = decision === 'VERIFIED' ? 'Verifikasi' : decision === 'REVISION' ? 'Minta revisi' : 'Tolak';
    if (!window.confirm(`${label} kontingen ${selected?.gudep_name || ''}?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await gudepRegistrationService.verifyContingent(selectedId, decision, note);
      setContingentNotes('');
      await load(selectedId);
      setMessage(`Keputusan verifikasi kontingen ${decision} berhasil disimpan ke GAS.`);
    } catch (e: any) { setError(e?.message || 'Gagal menyimpan keputusan verifikasi kontingen.'); }
    finally { setBusy(false); }
  };

  const submitRegu = async (reguId: string, reguName: string) => {
    if (busy || !selectedId) return;
    if (!window.confirm(`Ajukan Regu ${reguName} untuk verifikasi Admin?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await gudepRegistrationService.submitRegu(selectedId, reguId);
      const fresh = await gudepRegistrationService.detail(selectedId);
      setRegu(fresh.regu || []); setAdvisors(fresh.advisors || []);
      setMessage(`Pengajuan Regu ${reguName} berhasil dikirim ke GAS.`);
    } catch (e: any) { setError(e?.message || 'Gagal mengajukan Regu.'); }
    finally { setBusy(false); }
  };

  const decideRegu = async (reguId: string, reguName: string, decision: 'VERIFIED' | 'REVISION' | 'REJECTED') => {
    if (busy || !selectedId) return;
    const note = (reguNotes[reguId] || '').trim();
    if (decision !== 'VERIFIED' && !note) { setError(`Alasan revisi atau penolakan Regu ${reguName} wajib diisi.`); return; }
    const label = decision === 'VERIFIED' ? 'Verifikasi' : decision === 'REVISION' ? 'Minta revisi' : 'Tolak';
    if (!window.confirm(`${label} Regu ${reguName}?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await gudepRegistrationService.verifyRegu(selectedId, reguId, decision, note);
      setReguNotes(prev => ({ ...prev, [reguId]: '' }));
      const fresh = await gudepRegistrationService.detail(selectedId);
      setRegu(fresh.regu || []); setAdvisors(fresh.advisors || []);
      setMessage(`Keputusan verifikasi Regu ${reguName}: ${decision} berhasil disimpan ke GAS.`);
    } catch (e: any) { setError(e?.message || `Gagal memverifikasi Regu ${reguName}.`); }
    finally { setBusy(false); }
  };


  const changeActivation = async (status: 'ACTIVE' | 'INACTIVE') => {
    if (!selectedId || busy || !window.confirm(status === 'ACTIVE' ? 'Aktifkan Gudep dan seluruh Regu yang telah diverifikasi?' : 'Nonaktifkan Gudep beserta seluruh Regunya?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await gudepRegistrationService.activateGudep(selectedId,status);
      await load(selectedId);
      const result = await gudepRegistrationService.detail(selectedId);
      setRegu(result.regu || []); setAdvisors(result.advisors || []);
      setMessage(`Gudep beserta Regu berhasil ${status === 'ACTIVE' ? 'diaktifkan' : 'dinonaktifkan'} di GAS.`);
    } catch (e: any) { setError(e?.message || 'Aktivasi Gudep gagal.'); }
    finally { setBusy(false); }
  };
  const changeReguActivation = async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
    if (busy || !selectedId || !window.confirm(`${status === 'ACTIVE' ? 'Aktifkan' : 'Nonaktifkan'} Regu ini?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await gudepRegistrationService.activateRegu(selectedId,id,status);
      const result = await gudepRegistrationService.detail(selectedId);
      setRegu(result.regu || []); setAdvisors(result.advisors || []);
      setMessage('Status aktivasi Regu berhasil disimpan di GAS.');
    } catch (e: any) { setError(e?.message || 'Aktivasi Regu gagal.'); }
    finally { setBusy(false); }
  };

  const beginEditGudep = () => { if (!selected) return; setEditGudepForm({gudep_number:selected.gudep_number || '',gudep_name:selected.gudep_name || '',institution_name:selected.institution_name || ''}); setEditGudep(true); };
  const saveGudepName = async (e: React.FormEvent) => { e.preventDefault(); if (!selected || busy) return; setBusy(true); setError(''); setMessage(''); try { const result = await gudepRegistrationService.updateGudep({gudep_id:selected.gudep_id,...editGudepForm}); setMessage('Identitas Gudep berhasil diperbarui di GAS. ID dan status verifikasi dipertahankan.'); setEditGudep(false); await load(result.gudep.gudep_id); } catch (err:any) { setError(err?.message || 'Perubahan Gudep gagal disimpan.'); } finally { setBusy(false); } };
  const saveReguName = async (reguId:string) => { if (!selected || busy || !editingReguName.trim()) return; setBusy(true); setError(''); setMessage(''); try { await gudepRegistrationService.updateRegu({gudep_id:selected.gudep_id,regu_id:reguId,regu_name:editingReguName.trim()}); const result=await gudepRegistrationService.detail(selected.gudep_id); setRegu(result.regu || []); setAdvisors(result.advisors || []); setEditingReguId(''); setEditingReguName(''); setMessage('Nama regu berhasil diperbarui di GAS. ID dan relasi peserta dipertahankan.'); } catch(err:any) { setError(err?.message || 'Perubahan nama regu gagal disimpan.'); } finally { setBusy(false); } };
  const selected = gudep.find(g => g.gudep_id === selectedId);
  const locked = selected?.registration_status === 'SUBMITTED' || selected?.verification_status === 'VERIFIED';

  return <div className="space-y-5">
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 dark:border-red-500/20 dark:bg-red-950/20 dark:text-red-100">
      Buat <strong>Gugus Depan</strong> lebih dulu, lalu tambahkan <strong>Regu Putra atau Putri</strong> di dalamnya. Data tersimpan di Google Spreadsheet dan muncul pada pilihan Gudep → Regu di pendaftaran peserta.
    </div>
    {message && <div role="status" className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-900">{message}</div>}
    {error && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/20 dark:text-rose-200 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><School className="h-5 w-5 text-emerald-600" /> Daftar Gugus Depan</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={busy || loading} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"><RefreshCw className="inline h-4 w-4 mr-1" /> Muat Ulang</button>
          <button type="button" onClick={() => setAddGudep(v => !v)} disabled={busy} className="rounded-xl bg-[#C62828] px-3 py-2 text-xs font-bold text-white"><Plus className="inline h-4 w-4 mr-1" /> Buat Gudep</button>
        </div>
      </div>
      {addGudep && <form onSubmit={createGudep} className="rounded-xl border border-red-200 p-4 space-y-3 dark:border-red-500/20">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={labelClass}>Nomor Gugus Depan *</label><input required maxLength={60} className={inputClass} placeholder="Contoh: 01.001–01.002" value={gForm.gudep_number} onChange={e => setGForm(p => ({...p,gudep_number:e.target.value}))}/></div>
          <div><label className={labelClass}>Nama Gugus Depan *</label><input required maxLength={150} className={inputClass} placeholder="Contoh: Gudep SDN Sawangan 01" value={gForm.gudep_name} onChange={e => setGForm(p => ({...p,gudep_name:e.target.value}))}/></div>
          <div><label className={labelClass}>Sekolah / Pangkalan</label><input maxLength={150} className={inputClass} value={gForm.institution_name} onChange={e => setGForm(p => ({...p,institution_name:e.target.value}))}/></div>
          <div><label className={labelClass}>Nama Penanggung Jawab</label><input maxLength={120} className={inputClass} value={gForm.contact_name} onChange={e => setGForm(p => ({...p,contact_name:e.target.value}))}/></div>
          <div><label className={labelClass}>Nomor HP Kontak</label><input maxLength={40} className={inputClass} value={gForm.contact_phone} onChange={e => setGForm(p => ({...p,contact_phone:e.target.value}))}/></div>
          <div><label className={labelClass}>Email Kontak</label><input type="email" maxLength={120} className={inputClass} value={gForm.contact_email} onChange={e => setGForm(p => ({...p,contact_email:e.target.value}))}/></div>
        </div>
        <div><label className={labelClass}>Alamat Pangkalan</label><textarea maxLength={300} rows={2} className={inputClass} value={gForm.address} onChange={e => setGForm(p => ({...p,address:e.target.value}))}/></div>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setAddGudep(false)} disabled={busy} className="rounded-xl border px-4 py-2 text-sm dark:text-white">Batal</button><button type="submit" disabled={busy} className="rounded-xl bg-[#C62828] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan Gudep ke GAS'}</button></div>
      </form>}
      {loading ? <p className="text-sm text-slate-500">Memuat Gugus Depan dari GAS…</p> : gudep.length === 0 ? <p className="text-sm text-slate-500">Belum ada Gudep yang dapat diakses akun ini. Buat Gudep sebagai Admin berwenang.</p> : <div className="grid items-start gap-3 sm:grid-cols-2">{gudep.map(g => {
        const isSelected = selectedId === g.gudep_id;
        const contingentStatus = String(g.contingent_verification_status || 'PENDING').toUpperCase();
        return <article key={g.gudep_id} className={`min-w-0 overflow-hidden rounded-xl border bg-white transition dark:bg-[#141418] ${isSelected ? 'border-emerald-500 ring-1 ring-emerald-300 dark:ring-emerald-900' : 'border-slate-200 dark:border-white/10'}`}>
          <button type="button" onClick={() => {setSelectedId(g.gudep_id);setAddRegu(false);setShowGudepQr(false);setContingentNotes(g.contingent_verification_notes || '');}} aria-expanded={isSelected} className="w-full p-3 text-left">
            <span className="flex items-start justify-between gap-2"><span className="block min-w-0 break-words font-bold text-sm text-slate-900 dark:text-white">{g.gudep_name}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${contingentStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : contingentStatus === 'REJECTED' ? 'bg-rose-100 text-rose-800' : contingentStatus === 'REVISION' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>Kontingen: {contingentStatus}</span></span>
            <span className="mt-1 block break-words text-xs text-slate-600 dark:text-slate-300">{g.gudep_number} · {g.institution_name || 'Pangkalan belum diisi'}</span>
            <span className="mt-1 block text-[11px] text-slate-500">{g.registration_status} · Verifikasi Gudep: {g.verification_status}</span>
            <span className="mt-2 block text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{isSelected ? 'Detail dan tindakan ditampilkan di kartu ini' : 'Pilih untuk melihat tindakan'}</span>
          </button>
          {isSelected && <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]" aria-label={`Tindakan verifikasi kontingen ${g.gudep_name}`}>
            <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Verifikasi Kontingen</h3><span className="text-[10px] text-slate-500">Disimpan ke GAS</span></div>
            {contingentStatus !== 'VERIFIED' && contingentStatus !== 'REJECTED' ? <>
              <div><label className={labelClass}>Catatan (wajib untuk revisi/tolak)</label><textarea rows={2} maxLength={1000} className={inputClass} value={contingentNotes} onChange={e => setContingentNotes(e.target.value)} placeholder="Isi alasan jika meminta revisi atau menolak" /></div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button type="button" disabled={busy} onClick={() => void decideContingent('VERIFIED')} className="min-h-10 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Verifikasi</button>
                <button type="button" disabled={busy || !contingentNotes.trim()} onClick={() => void decideContingent('REVISION')} className="min-h-10 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">Minta Revisi</button>
                <button type="button" disabled={busy || !contingentNotes.trim()} onClick={() => void decideContingent('REJECTED')} className="min-h-10 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Tolak</button>
              </div>
            </> : <p className={`rounded-lg p-2 text-xs ${contingentStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-200'}`}>{contingentStatus === 'VERIFIED' ? 'Kontingen sudah diverifikasi.' : 'Kontingen ditolak. Data tetap tersimpan.'}</p>}
            {contingentStatus === 'REVISION' && <p className="text-xs text-amber-700 dark:text-amber-300">Kontingen perlu diperbaiki sebelum diajukan kembali.</p>}
            <div className="border-t border-slate-200 pt-3 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200">Ringkasan Pangkalan & Kontingen</h4><button type="button" onClick={beginEditGudep} disabled={busy || (!canAssignOperator && locked)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold disabled:opacity-40"><Pencil className="h-3.5 w-3.5"/> Edit nama</button></div>
              {editGudep && <form onSubmit={saveGudepName} className="rounded-xl border border-blue-200 bg-white p-3 space-y-3 dark:border-blue-500/30 dark:bg-white/[0.03]"><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><div><label className={labelClass}>Nomor Gudep</label><input required maxLength={60} className={inputClass} value={editGudepForm.gudep_number} onChange={e=>setEditGudepForm(p=>({...p,gudep_number:e.target.value}))}/></div><div><label className={labelClass}>Nama Gudep</label><input required maxLength={150} className={inputClass} value={editGudepForm.gudep_name} onChange={e=>setEditGudepForm(p=>({...p,gudep_name:e.target.value}))}/></div><div><label className={labelClass}>Nama pangkalan/sekolah</label><input maxLength={150} className={inputClass} value={editGudepForm.institution_name} onChange={e=>setEditGudepForm(p=>({...p,institution_name:e.target.value}))}/></div></div><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>setEditGudep(false)} disabled={busy} className="min-h-9 rounded-lg border px-3 text-xs font-bold">Batal</button><button type="submit" disabled={busy} className="min-h-9 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white">{busy?'Menyimpan…':'Simpan perubahan'}</button></div></form>}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-white p-2 dark:bg-white/5"><p className="text-[10px] font-bold uppercase text-slate-500">Data Pangkalan</p><p className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">{g.institution_name || 'Nama pangkalan belum diisi'}</p><p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{g.address || 'Alamat belum diisi'}</p><p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">Kontak: {g.contact_name || '—'} · {g.contact_phone || 'No. HP belum diisi'}</p><p className="break-all text-[11px] text-slate-600 dark:text-slate-300">{g.contact_email || 'Email belum diisi'}</p></div>
                <div className="rounded-lg bg-white p-2 dark:bg-white/5"><p className="text-[10px] font-bold uppercase text-slate-500">Pembina / Pendamping / Pimpinan</p>{advisors.length ? <ul className="mt-1 space-y-1">{advisors.map((a: any, index: number) => <li key={a.advisor_id || a.id || `${a.full_name || a.name || 'pembina'}-${index}`} className="text-xs text-slate-800 dark:text-slate-100"><span className="font-semibold">{a.full_name || a.name || 'Nama belum tersedia'}</span><span className="block text-[11px] text-slate-500">{a.email || 'Email —'} · {a.phone || a.contact_phone || 'HP —'}</span></li>)}</ul> : <p className="mt-1 text-xs text-slate-500">Data pembina/pendamping belum tercatat.</p>}<p className="mt-2 text-[10px] text-slate-500">Data akun operator aktif ditetapkan melalui penugasan di bawah.</p></div>
              </div>
              <div className="rounded-lg border border-slate-200 p-2 dark:border-white/10"><div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-xs font-bold text-slate-800 dark:text-white">Data Regu ({isSelected ? regu.length : 0})</h4>{detailLoading && <span className="text-[10px] text-slate-500">Memuat…</span>}</div>
                {!detailLoading && regu.length === 0 ? <p className="text-xs text-slate-500">Belum ada data regu.</p> : <div className="space-y-2">{regu.map(r => { const rv = String(r.verification_status || 'PENDING').toUpperCase(); const rs = String(r.registration_status || 'DRAFT').toUpperCase(); return <div key={r.regu_id} className="rounded-lg bg-white p-2 dark:bg-white/5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-slate-900 dark:text-white">{r.regu_name}</p><p className="text-[10px] text-slate-500">{r.gender === 'PUTRA' ? 'Putra' : 'Putri'} · Kuota {r.quota} · Pengajuan {rs}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${rv === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : rv === 'REJECTED' ? 'bg-rose-100 text-rose-800' : rv === 'REVISION' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{rv}</span></div>
                  {canVerify && rs === 'SUBMITTED' && rv !== 'VERIFIED' && rv !== 'REJECTED' && <div className="mt-2 space-y-2"><textarea rows={1} maxLength={1000} className={inputClass} value={reguNotes[r.regu_id] || ''} onChange={e => setReguNotes(prev => ({...prev, [r.regu_id]: e.target.value}))} placeholder="Catatan wajib untuk revisi/tolak"/><div className="grid grid-cols-3 gap-1"><button type="button" disabled={busy} onClick={() => void decideRegu(r.regu_id, r.regu_name, 'VERIFIED')} className="rounded-lg bg-emerald-600 px-2 py-2 text-[10px] font-bold text-white disabled:opacity-40">Verifikasi</button><button type="button" disabled={busy || !(reguNotes[r.regu_id] || '').trim()} onClick={() => void decideRegu(r.regu_id, r.regu_name, 'REVISION')} className="rounded-lg bg-amber-500 px-2 py-2 text-[10px] font-bold text-slate-950 disabled:opacity-40">Revisi</button><button type="button" disabled={busy || !(reguNotes[r.regu_id] || '').trim()} onClick={() => void decideRegu(r.regu_id, r.regu_name, 'REJECTED')} className="rounded-lg bg-rose-600 px-2 py-2 text-[10px] font-bold text-white disabled:opacity-40">Tolak</button></div></div>}
                </div>; })}</div>}
              </div>
              {canVerify && <div className="rounded-lg border border-slate-200 p-2 dark:border-white/10 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-bold text-slate-800 dark:text-white">Verifikasi Pangkalan / Gudep</h4><span className="text-[10px] text-slate-500">{g.registration_status} · {g.verification_status}</span></div>
                {g.registration_status === 'SUBMITTED' && g.verification_status !== 'VERIFIED' && g.verification_status !== 'REJECTED' ? <><textarea rows={1} maxLength={1000} className={inputClass} value={isSelected ? decisionNotes : ''} onChange={e => setDecisionNotes(e.target.value)} placeholder="Catatan wajib untuk revisi/tolak"/><div className="grid grid-cols-3 gap-1"><button type="button" disabled={busy} onClick={() => void decideGudep('VERIFIED')} className="rounded-lg bg-emerald-600 px-2 py-2 text-[10px] font-bold text-white disabled:opacity-40">Verifikasi</button><button type="button" disabled={busy || !decisionNotes.trim()} onClick={() => void decideGudep('REVISION')} className="rounded-lg bg-amber-500 px-2 py-2 text-[10px] font-bold text-slate-950 disabled:opacity-40">Revisi</button><button type="button" disabled={busy || !decisionNotes.trim()} onClick={() => void decideGudep('REJECTED')} className="rounded-lg bg-rose-600 px-2 py-2 text-[10px] font-bold text-white disabled:opacity-40">Tolak</button></div></> : <p className="text-xs text-slate-600 dark:text-slate-300">Status Gudep: <strong>{g.verification_status}</strong>{g.verification_status === 'VERIFIED' ? ' — sudah diverifikasi.' : g.verification_status === 'REJECTED' ? ' — ditolak.' : ' — menunggu pengajuan/verifikasi.'}</p>}
              </div>}
              {canAssignOperator && <div className="rounded-lg border border-indigo-200 p-2 dark:border-indigo-500/20 space-y-2"><h4 className="text-xs font-bold text-slate-800 dark:text-white">Penugasan Akun Pembina / Pengelola</h4><div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]"><select aria-label="Pilih akun pengelola Gudep" className={inputClass} value={assignUserId} onChange={e => setAssignUserId(e.target.value)} disabled={busy || usersLoading}><option value="">{usersLoading ? 'Memuat akun…' : 'Pilih akun pengguna aktif…'}</option>{availableUsers.map(user => <option key={user.id} value={user.id}>{user.name || user.email} — {user.email}</option>)}</select><button type="button" onClick={() => void assignOperator()} disabled={busy || usersLoading || !assignUserId} className="rounded-lg bg-indigo-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40">Tugaskan Akun</button></div></div>}
            </div>
          </div>}
        </article>;
      })}</div>}
    </div>
    {selected && canAssignOperator && <section className="rounded-2xl border border-indigo-200 bg-white p-4 dark:border-indigo-500/20 dark:bg-[#141418] space-y-3" aria-label="Penugasan operator Gudep">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-100 p-2 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"><Users className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Tugaskan Pengelola Gudep</h3><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">Pilih akun yang sudah terdaftar untuk mengelola Gudep ini. Penugasan disimpan oleh backend pada GudepOperatorAssignments; pengguna hanya mendapat akses ke Gudep yang ditugaskan.</p></div></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div><label className={labelClass}>Akun pengguna aktif</label><select className={inputClass} value={assignUserId} onChange={e => setAssignUserId(e.target.value)} disabled={busy || usersLoading}><option value="">{usersLoading ? 'Memuat akun pengguna…' : availableUsers.length ? 'Pilih pengguna…' : 'Tidak ada akun aktif'}</option>{availableUsers.map(user => <option key={user.id} value={user.id}>{user.name || user.email} — {user.email}</option>)}</select></div><button type="button" onClick={() => void assignOperator()} disabled={busy || usersLoading || !assignUserId} className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Menyimpan…' : 'Tugaskan ke Gudep'}</button></div>
      <p className="text-[11px] text-slate-500">Untuk menugaskan pengguna ke Gudep lain, pilih kartu Gudep tersebut dan ulangi proses ini. Pengguna yang sama dapat ditugaskan ke beberapa Gudep.</p>
    </section>}
    {selected && <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418] space-y-3" aria-label="Persetujuan pendaftaran Gudep">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pengajuan & Persetujuan Gudep</h3>
      <p className="text-xs text-slate-600 dark:text-slate-300">Status pengajuan: <strong>{selected.registration_status}</strong> · Verifikasi: <strong>{selected.verification_status}</strong></p>
      {selected.registration_status === 'DRAFT' && selected.verification_status !== 'VERIFIED' && selected.verification_status !== 'REJECTED' && <div className="space-y-2">
        <p className="text-xs text-slate-600 dark:text-slate-300">Selesaikan minimal satu regu, kemudian kirim untuk diperiksa Admin.</p>
        <button type="button" disabled={busy || regu.length === 0 || detailLoading} onClick={() => void submitGudep()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Memproses…' : 'Ajukan ke Admin'}</button>
      </div>}
      {selected.registration_status === 'SUBMITTED' && selected.verification_status !== 'VERIFIED' && selected.verification_status !== 'REJECTED' && <div className="space-y-3">
        <p className="text-xs text-slate-600 dark:text-slate-300">Keputusan hanya akan diterima jika akun memiliki izin Admin di backend GAS.</p>
        <div><label className={labelClass}>Catatan verifikasi (wajib untuk Revisi/Tolak)</label><textarea rows={2} maxLength={1000} className={inputClass} value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)} placeholder="Contoh: Nomor Gudep perlu diperbaiki" /></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void decideGudep('VERIFIED')} className="rounded-xl bg-[#C62828] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Setujui / Verifikasi</button>
          <button type="button" disabled={busy || !decisionNotes.trim()} onClick={() => void decideGudep('REVISION')} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">Minta Revisi</button>
          <button type="button" disabled={busy || !decisionNotes.trim()} onClick={() => void decideGudep('REJECTED')} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Tolak</button>
        </div>
      </div>}
      {selected.verification_status === 'VERIFIED' && <div className="space-y-2">
        <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">Gudep telah diverifikasi. Setiap Regu harus diajukan dan diverifikasi secara terpisah. Aktivasi operasional terpisah dari persetujuan dan hanya dapat dilakukan Admin berwenang.</p>
        <p className="text-xs text-slate-700 dark:text-slate-200">Status aktivasi: <strong>{selected.activation_status || 'INACTIVE'}</strong></p>
        <div className="flex flex-wrap gap-2">
          {selected.activation_status !== 'ACTIVE' ? <button type="button" disabled={busy || detailLoading || regu.length === 0 || regu.some(r => r.verification_status !== 'VERIFIED')} onClick={() => void changeActivation('ACTIVE')} className="rounded-xl bg-[#C62828] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Verifikasi selesai — Aktifkan Gudep & Regu</button> : <button type="button" disabled={busy} onClick={() => void changeActivation('INACTIVE')} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Nonaktifkan Gudep & Regu</button>}
        </div>
        {!detailLoading && regu.some(r => r.verification_status !== 'VERIFIED') && <p className="rounded-xl border border-amber-500/40 p-3 text-xs text-amber-700 dark:text-amber-300">Regu yang belum diverifikasi harus diajukan dan diputuskan satu per satu. Sistem tidak menyetujui Regu secara otomatis hanya karena Gudep sudah diverifikasi.</p>}
      </div>}
      {selected.verification_status === 'REJECTED' && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-900 dark:bg-rose-950/20 dark:text-rose-200">Pengajuan ditolak. Data tidak dihapus.</p>}
      {selected.verification_status === 'REVISION' && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">Pengajuan dikembalikan ke DRAFT untuk perbaikan. Fungsi edit data memerlukan endpoint update GAS yang belum tersedia.</p>}
    </section>}
    {selected && <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Users className="w-5 h-5 text-emerald-600"/> Regu pada {selected.gudep_name}</div><p className="text-xs text-slate-500">Regu terhubung dengan Gudep yang dipilih. Kuota ditentukan per regu.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setShowGudepQr(true)} aria-label={`Buka QR Gudep ${selected.gudep_name} untuk dicetak`} className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-600 dark:bg-white/10 dark:hover:bg-white/20"><QrCode className="h-4 w-4 text-emerald-400" aria-hidden="true"/> Cetak QR</button><button type="button" onClick={() => setAddRegu(v => !v)} disabled={busy || locked} className="rounded-xl bg-[#C62828] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus className="inline w-4 h-4 mr-1" /> Tambah Regu</button></div></div>
      {locked && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">Gudep sudah diajukan atau diverifikasi. Perubahan regu terkunci oleh aturan backend.</p>}
      {addRegu && !locked && <form onSubmit={createRegu} className="rounded-xl border border-red-200 p-4 space-y-3 dark:border-red-500/20"><div className="grid gap-3 sm:grid-cols-3"><div><label className={labelClass}>Nama Regu *</label><input required maxLength={120} className={inputClass} value={rForm.regu_name} placeholder="Contoh: Regu Elang" onChange={e => setRForm(p=>({...p,regu_name:e.target.value}))}/></div><div><label className={labelClass}>Jenis Regu *</label><select className={inputClass} value={rForm.gender} onChange={e=>setRForm(p=>({...p,gender:e.target.value as 'PUTRA'|'PUTRI'}))}><option value="PUTRA">Putra</option><option value="PUTRI">Putri</option></select></div><div><label className={labelClass}>Kuota (1–100) *</label><input required type="number" min={1} max={100} className={inputClass} value={rForm.quota} onChange={e=>setRForm(p=>({...p,quota:Number(e.target.value)}))}/></div></div><div className="flex justify-end gap-2"><button type="button" onClick={()=>setAddRegu(false)} disabled={busy} className="rounded-xl border px-4 py-2 text-sm dark:text-white">Batal</button><button type="submit" disabled={busy} className="rounded-xl bg-[#C62828] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?'Menyimpan…':'Simpan Regu ke GAS'}</button></div></form>}
      {detailLoading ? <p className="text-sm text-slate-500">Memuat daftar regu…</p> : regu.length === 0 ? <p className="text-sm text-slate-500">Belum ada regu. Tambahkan regu sebelum mendaftarkan peserta.</p> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{regu.map(r => {
        const verification = String(r.verification_status || 'PENDING').toUpperCase();
        const registration = String(r.registration_status || 'DRAFT').toUpperCase();
        return <article key={r.regu_id} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-white/10 space-y-3">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h4 className="break-words text-sm font-bold text-slate-900 dark:text-white">{r.regu_name}</h4><p className="mt-1 text-xs text-slate-500">{r.gender === 'PUTRA' ? 'Putra' : 'Putri'} · Kuota {r.quota}</p></div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">{verification}</span><button type="button" title="Edit nama regu" aria-label={'Edit nama '+r.regu_name} disabled={busy || (!canAssignOperator && locked)} onClick={()=>{setEditingReguId(r.regu_id);setEditingReguName(r.regu_name);}} className="rounded-lg border p-2 disabled:opacity-40"><Pencil className="h-3.5 w-3.5"/></button></div></div>
          {editingReguId === r.regu_id && <form onSubmit={e=>{e.preventDefault();void saveReguName(r.regu_id);}} className="space-y-2 rounded-lg border border-blue-200 p-2 dark:border-blue-500/30"><label className={labelClass}>Nama regu</label><input required maxLength={120} className={inputClass} value={editingReguName} onChange={e=>setEditingReguName(e.target.value)}/><div className="flex gap-2"><button type="button" disabled={busy} onClick={()=>{setEditingReguId('');setEditingReguName('');}} className="min-h-9 flex-1 rounded-lg border px-2 text-xs font-bold">Batal</button><button type="submit" disabled={busy || !editingReguName.trim()} className="min-h-9 flex-1 rounded-lg bg-blue-700 px-2 text-xs font-bold text-white">{busy?'Menyimpan…':'Simpan nama'}</button></div></form>}
          <p className="text-[11px] text-slate-500">Pengajuan: {registration} · Aktivasi: {r.activation_status || 'INACTIVE'}</p>
          {registration !== 'SUBMITTED' && verification !== 'VERIFIED' && verification !== 'REJECTED' && <button type="button" disabled={busy} onClick={() => void submitRegu(r.regu_id, r.regu_name)} className="min-h-10 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Ajukan Verifikasi Regu</button>}
          {registration === 'SUBMITTED' && verification !== 'VERIFIED' && verification !== 'REJECTED' && <div className="space-y-2"><label className={labelClass}>Catatan Regu (wajib untuk revisi/tolak)</label><textarea rows={2} maxLength={1000} className={inputClass} value={reguNotes[r.regu_id] || ''} onChange={e => setReguNotes(prev => ({...prev, [r.regu_id]: e.target.value}))} placeholder="Alasan revisi atau penolakan"/><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><button type="button" disabled={busy} onClick={() => void decideRegu(r.regu_id, r.regu_name, 'VERIFIED')} className="min-h-10 rounded-lg bg-emerald-600 px-2 py-2 text-[11px] font-bold text-white disabled:opacity-40">Verifikasi</button><button type="button" disabled={busy || !(reguNotes[r.regu_id] || '').trim()} onClick={() => void decideRegu(r.regu_id, r.regu_name, 'REVISION')} className="min-h-10 rounded-lg bg-amber-500 px-2 py-2 text-[11px] font-bold text-slate-950 disabled:opacity-40">Minta Revisi</button><button type="button" disabled={busy || !(reguNotes[r.regu_id] || '').trim()} onClick={() => void decideRegu(r.regu_id, r.regu_name, 'REJECTED')} className="min-h-10 rounded-lg bg-rose-600 px-2 py-2 text-[11px] font-bold text-white disabled:opacity-40">Tolak</button></div></div>}
          {selected.activation_status === 'ACTIVE' && verification === 'VERIFIED' && <button type="button" disabled={busy} onClick={() => void changeReguActivation(r.regu_id, r.activation_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')} className="min-h-10 rounded-lg border border-emerald-400 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 disabled:opacity-40">{r.activation_status === 'ACTIVE' ? 'Nonaktifkan Regu' : 'Aktifkan Regu'}</button>}
          {verification === 'VERIFIED' && <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Regu telah diverifikasi.</p>}
          {verification === 'REVISION' && <p className="text-xs text-amber-700 dark:text-amber-300">Regu perlu diperbaiki dan diajukan kembali.</p>}
          {verification === 'REJECTED' && <p className="text-xs text-rose-700 dark:text-rose-300">Pengajuan Regu ditolak.</p>}
        </article>;
      })}</div>}
    </div>}
    {selected && showGudepQr && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-6" role="presentation" onMouseDown={e => { if(e.target === e.currentTarget) setShowGudepQr(false); }}>
      <div role="dialog" aria-modal="true" aria-label={`QR Gudep ${selected.gudep_name}`} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/20 dark:bg-[#141418] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900 dark:text-white">QR Gudep / Pangkalan</h3><p className="text-xs text-slate-500">{selected.gudep_name} · {selected.gudep_number}</p></div><button type="button" onClick={() => setShowGudepQr(false)} aria-label="Tutup panel QR Gudep" className="rounded-lg border border-slate-300 p-2 text-slate-800 dark:border-white/20 dark:text-white"><X className="h-5 w-5"/></button></div>
        <GudepQrPanel key={selected.gudep_id} gudepId={selected.gudep_id} gudepName={selected.gudep_name} />
      </div>
    </div>}
  </div>;
};
