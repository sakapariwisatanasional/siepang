import React, { useCallback, useEffect, useState } from 'react';
import { gudepRegistrationService, GudepRecord } from '../../services/gudepRegistrationService';
import { GudepAttendanceRecap } from './GudepAttendanceRecap';
import { GudepQrPanel } from './GudepQrPanel';

export const GudepAttendancePage: React.FC = () => {
  const [gudeps, setGudeps] = useState<GudepRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError(''); setSelected(''); setGudeps([]);
    try { const result = await gudepRegistrationService.list(); if (!Array.isArray(result.gudep)) throw new Error('Respons daftar Gudep dari GAS tidak sesuai.'); setGudeps(result.gudep); }
    catch (e: any) { setError(e?.message || 'Gagal membaca daftar Gudep dari GAS.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const current = gudeps.find(g => g.gudep_id === selected);
  return <main className="mx-auto w-full max-w-7xl space-y-4 px-3 py-4 sm:px-5">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418] dark:text-white"><div><h1 className="text-xl font-bold">Kehadiran Kontingen / Gudep</h1><p className="mt-1 text-sm text-slate-500">Rekap kedatangan dan kepulangan rombongan berdasarkan catatan gerbang GAS.</p></div><button type="button" disabled={loading} onClick={() => void load()} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50">Muat Ulang Daftar Gudep</button></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    {loading ? <p role="status" className="text-sm text-slate-500">Memuat daftar Gudep…</p> : !error && <GudepAttendanceRecap gudeps={gudeps} onSelect={setSelected} />}
    {current && <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold dark:text-white">Detail Kehadiran: {current.gudep_name}</h2><button type="button" onClick={() => setSelected('')} className="rounded-lg border px-3 py-2 text-sm dark:text-white">Tutup Detail</button></div><GudepQrPanel key={current.gudep_id} gudepId={current.gudep_id} gudepName={current.gudep_name}/></section>}
  </main>;
};
