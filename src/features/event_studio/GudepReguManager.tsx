/**
 * SiEpang — Administrasi Gugus Depan dan Regu (GAS authoritative).
 * Target: src/features/event_studio/GudepReguManager.tsx
 * No local-only writes. Permissions enforced on GAS.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, School, Users, AlertCircle, QrCode, X } from 'lucide-react';
import { gudepRegistrationService, GudepRecord, GudepRegu } from '../../services/gudepRegistrationService';
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
  const [gForm, setGForm] = useState(blankGudep());
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
  const gudepKey = useRef(newKey());
  const reguKey = useRef(newKey());
  const detailRequest = useRef(0);

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
    const current = ++detailRequest.current;
    if (!selectedId) { setRegu([]); setDetailLoading(false); return; }
    setDetailLoading(true); setRegu([]);
    gudepRegistrationService.detail(selectedId).then(data => {
      if (current === detailRequest.current) setRegu(data.regu || []);
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
      setRegu(updated.regu || []);
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
      setRegu(fresh.regu || []);
      setMessage(`Keputusan ${decision} berhasil disimpan ke GAS, termasuk status seluruh Regu.`);
    } catch (e: any) { setError(e?.message || 'Gagal menyimpan keputusan verifikasi.'); }
    finally { setBusy(false); }
  };

  const syncVerifiedRegu = async () => {
    if (busy || !selectedId) return;
    if (!window.confirm('Samakan status Regu PENDING menjadi VERIFIED mengikuti Gudep yang sudah disetujui?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await gudepRegistrationService.syncReguVerification(selectedId);
      const fresh = await gudepRegistrationService.detail(selectedId);
      setRegu(fresh.regu || []);
      setMessage(`${result.regu_updated} Regu berhasil disinkronkan menjadi VERIFIED di GAS.`);
      await load(selectedId);
    } catch (e: any) { setError(e?.message || 'Gagal menyinkronkan status regu.'); }
    finally { setBusy(false); }
  };

  const changeActivation = async (status: 'ACTIVE' | 'INACTIVE') => {
    if (!selectedId || busy || !window.confirm(status === 'ACTIVE' ? 'Aktifkan Gudep dan seluruh Regu yang telah diverifikasi?' : 'Nonaktifkan Gudep beserta seluruh Regunya?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await gudepRegistrationService.activateGudep(selectedId,status);
      await load(selectedId);
      const result = await gudepRegistrationService.detail(selectedId);
      setRegu(result.regu || []);
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
      setRegu(result.regu || []);
      setMessage('Status aktivasi Regu berhasil disimpan di GAS.');
    } catch (e: any) { setError(e?.message || 'Aktivasi Regu gagal.'); }
    finally { setBusy(false); }
  };
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
      {loading ? <p className="text-sm text-slate-500">Memuat Gugus Depan dari GAS…</p> : gudep.length === 0 ? <p className="text-sm text-slate-500">Belum ada Gudep yang dapat diakses akun ini. Buat Gudep sebagai Admin berwenang.</p> : <div className="grid gap-2 sm:grid-cols-2">{gudep.map(g => <button key={g.gudep_id} type="button" onClick={() => {setSelectedId(g.gudep_id);setAddRegu(false);setShowGudepQr(false);}} className={`rounded-xl border p-3 text-left transition ${selectedId === g.gudep_id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-white/10'}`}><span className="block font-bold text-sm text-slate-900 dark:text-white">{g.gudep_name}</span><span className="block text-xs text-slate-600 dark:text-slate-300">{g.gudep_number} · {g.institution_name || 'Pangkalan belum diisi'}</span><span className="block text-[11px] text-slate-500 mt-1">{g.registration_status} · {g.verification_status}</span></button>)}</div>}
    </div>
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
        <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">Gudep telah diverifikasi. Verifikasi Gudep mencakup semua Regu yang diajukan. Aktivasi operasional terpisah dari persetujuan. Hanya Admin berwenang dapat mengaktifkan Gudep dan seluruh Regu yang VERIFIED.</p>
        <p className="text-xs text-slate-700 dark:text-slate-200">Status aktivasi: <strong>{selected.activation_status || 'INACTIVE'}</strong></p>
        <div className="flex flex-wrap gap-2">
          {selected.activation_status !== 'ACTIVE' ? <button type="button" disabled={busy || detailLoading || regu.length === 0 || regu.some(r => r.verification_status !== 'VERIFIED')} onClick={() => void changeActivation('ACTIVE')} className="rounded-xl bg-[#C62828] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Verifikasi selesai — Aktifkan Gudep & Regu</button> : <button type="button" disabled={busy} onClick={() => void changeActivation('INACTIVE')} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Nonaktifkan Gudep & Regu</button>}
        </div>
        {!detailLoading && regu.some(r => r.verification_status === 'PENDING') && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 p-3">
          <span className="text-xs text-amber-600 dark:text-amber-300">Ada Regu lama berstatus PENDING walaupun Gudep sudah VERIFIED.</span>
          <button type="button" disabled={busy} onClick={() => void syncVerifiedRegu()} className="rounded-xl bg-[#C62828] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Sinkronkan Verifikasi Regu</button>
        </div>}
      </div>}
      {selected.verification_status === 'REJECTED' && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-900 dark:bg-rose-950/20 dark:text-rose-200">Pengajuan ditolak. Data tidak dihapus.</p>}
      {selected.verification_status === 'REVISION' && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">Pengajuan dikembalikan ke DRAFT untuk perbaikan. Fungsi edit data memerlukan endpoint update GAS yang belum tersedia.</p>}
    </section>}
    {selected && <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Users className="w-5 h-5 text-emerald-600"/> Regu pada {selected.gudep_name}</div><p className="text-xs text-slate-500">Regu terhubung dengan Gudep yang dipilih. Kuota ditentukan per regu.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setShowGudepQr(true)} aria-label={`Buka QR Gudep ${selected.gudep_name} untuk dicetak`} className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-600 dark:bg-white/10 dark:hover:bg-white/20"><QrCode className="h-4 w-4 text-emerald-400" aria-hidden="true"/> Cetak QR</button><button type="button" onClick={() => setAddRegu(v => !v)} disabled={busy || locked} className="rounded-xl bg-[#C62828] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus className="inline w-4 h-4 mr-1" /> Tambah Regu</button></div></div>
      {locked && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">Gudep sudah diajukan atau diverifikasi. Perubahan regu terkunci oleh aturan backend.</p>}
      {addRegu && !locked && <form onSubmit={createRegu} className="rounded-xl border border-red-200 p-4 space-y-3 dark:border-red-500/20"><div className="grid gap-3 sm:grid-cols-3"><div><label className={labelClass}>Nama Regu *</label><input required maxLength={120} className={inputClass} value={rForm.regu_name} placeholder="Contoh: Regu Elang" onChange={e => setRForm(p=>({...p,regu_name:e.target.value}))}/></div><div><label className={labelClass}>Jenis Regu *</label><select className={inputClass} value={rForm.gender} onChange={e=>setRForm(p=>({...p,gender:e.target.value as 'PUTRA'|'PUTRI'}))}><option value="PUTRA">Putra</option><option value="PUTRI">Putri</option></select></div><div><label className={labelClass}>Kuota (1–100) *</label><input required type="number" min={1} max={100} className={inputClass} value={rForm.quota} onChange={e=>setRForm(p=>({...p,quota:Number(e.target.value)}))}/></div></div><div className="flex justify-end gap-2"><button type="button" onClick={()=>setAddRegu(false)} disabled={busy} className="rounded-xl border px-4 py-2 text-sm dark:text-white">Batal</button><button type="submit" disabled={busy} className="rounded-xl bg-[#C62828] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?'Menyimpan…':'Simpan Regu ke GAS'}</button></div></form>}
      {detailLoading ? <p className="text-sm text-slate-500">Memuat daftar regu…</p> : regu.length === 0 ? <p className="text-sm text-slate-500">Belum ada regu. Tambahkan regu sebelum mendaftarkan peserta.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"><th className="py-3 pr-3">Regu</th><th className="py-3 pr-3">Jenis</th><th className="py-3 pr-3">Kuota</th><th className="py-3">Verifikasi / Aktivasi</th><th className="py-3">Aksi</th></tr></thead><tbody>{regu.map(r=><tr key={r.regu_id} className="border-b border-slate-100 dark:border-white/5 text-slate-900 dark:text-white"><td className="py-3 pr-3 font-semibold">{r.regu_name}</td><td className="py-3 pr-3">{r.gender==='PUTRA'?'Putra':'Putri'}</td><td className="py-3 pr-3">{r.quota}</td><td className="py-3">{r.verification_status||'PENDING'} · {r.activation_status||'INACTIVE'}</td><td className="py-3">{selected.activation_status === 'ACTIVE' && r.verification_status === 'VERIFIED' && <button type="button" disabled={busy} onClick={() => void changeReguActivation(r.regu_id, r.activation_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')} className="rounded-lg border border-emerald-400 px-2 py-1 text-emerald-700 dark:text-emerald-300 disabled:opacity-40">{r.activation_status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}</button>}</td></tr>)}</tbody></table></div>}
    </div>}
    {selected && showGudepQr && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-6" role="presentation" onMouseDown={e => { if(e.target === e.currentTarget) setShowGudepQr(false); }}>
      <div role="dialog" aria-modal="true" aria-label={`QR Gudep ${selected.gudep_name}`} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/20 dark:bg-[#141418] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900 dark:text-white">QR Gudep / Pangkalan</h3><p className="text-xs text-slate-500">{selected.gudep_name} · {selected.gudep_number}</p></div><button type="button" onClick={() => setShowGudepQr(false)} aria-label="Tutup panel QR Gudep" className="rounded-lg border border-slate-300 p-2 text-slate-800 dark:border-white/20 dark:text-white"><X className="h-5 w-5"/></button></div>
        <GudepQrPanel key={selected.gudep_id} gudepId={selected.gudep_id} gudepName={selected.gudep_name} />
      </div>
    </div>}
  </div>;
};
