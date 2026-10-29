import React, { useEffect, useRef, useState } from 'react';
import type { GudepRecord } from '../../services/gudepRegistrationService';
import { gudepQrService, GudepGateStatus, GudepGateLog } from '../../services/gudepQrService';

type Attendance = { status: GudepGateStatus; arrival?: string; departure?: string; gate?: string };
const labels: Record<GudepGateStatus, string> = { NOT_ARRIVED: 'Belum datang', CHECKED_IN: 'Sudah check-in', CHECKED_OUT: 'Sudah pulang' };
const time = (value?: string) => value ? new Date(value).toLocaleString('id-ID') : '—';
export const GudepAttendanceRecap: React.FC<{ gudeps: GudepRecord[]; onSelect: (id: string) => void }> = ({ gudeps, onSelect }) => {
  const [records, setRecords] = useState<Record<string, Attendance>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState('ARRIVED');
  const [search, setSearch] = useState('');
  const [updated, setUpdated] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    let cancelled = false;
    const rows: Record<string, Attendance> = {};
    const failed: Record<string, string> = {};
    let index = 0;
    setBusy(true); setRecords({}); setErrors({}); setUpdated('');
    const worker = async () => {
      while (!cancelled && index < gudeps.length) {
        const gudep = gudeps[index++];
        try {
          const result = await gudepQrService.history(gudep.gudep_id);
          if (result.gudep_id !== gudep.gudep_id || !Object.prototype.hasOwnProperty.call(labels, result.gate_status) || !Array.isArray(result.history)) throw new Error('Respons kehadiran GAS tidak sesuai.');
          const arrivals = result.history.filter((log: GudepGateLog) => log.direction === 'CHECK_IN');
          const departures = result.history.filter((log: GudepGateLog) => log.direction === 'CHECK_OUT');
          rows[gudep.gudep_id] = { status: result.gate_status, arrival: arrivals[0]?.created_at, departure: departures[departures.length - 1]?.created_at, gate: arrivals[0]?.gate_name };
        } catch (error: any) { failed[gudep.gudep_id] = error?.message || 'Gagal membaca kehadiran dari GAS.'; }
      }
    };
    void Promise.all(Array.from({ length: Math.min(3, gudeps.length) }, worker)).then(() => {
      if (!cancelled && current === generation.current) { setRecords(rows); setErrors(failed); setUpdated(new Date().toLocaleString('id-ID')); setBusy(false); }
    });
    return () => { cancelled = true; };
  }, [gudeps, revision]);
  const entries = Object.values(records);
  const visible = gudeps.filter(g => {
    const status = records[g.gudep_id]?.status;
    const matches = filter === 'ALL' || (filter === 'ARRIVED' ? status === 'CHECKED_IN' || status === 'CHECKED_OUT' : filter === 'ERROR' ? !!errors[g.gudep_id] : status === filter);
    return matches && `${g.gudep_name} ${g.gudep_number} ${g.institution_name || ''}`.toLowerCase().includes(search.toLowerCase());
  });
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418] dark:text-white">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Rekap Kehadiran Kontingen / Gudep</h3><button type="button" disabled={busy} onClick={() => setRevision(v => v + 1)} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50">{busy ? 'Memuat kehadiran…' : 'Perbarui Kehadiran'}</button></div>
    <p className="text-xs text-slate-500">Kehadiran rombongan berdasarkan log gerbang GAS. Cakupan mengikuti daftar Gudep yang dapat diakses akun ini. Tidak menghitung kehadiran per peserta.</p>
    {busy ? <p role="status" className="text-sm">Membaca catatan kehadiran dari GAS…</p> : <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{[
        ['Pernah hadir', entries.filter(r => r.status !== 'NOT_ARRIVED').length],
        ['Masih di lokasi', entries.filter(r => r.status === 'CHECKED_IN').length],
        ['Sudah pulang', entries.filter(r => r.status === 'CHECKED_OUT').length],
        ['Belum datang', entries.filter(r => r.status === 'NOT_ARRIVED').length]
      ].map(([label, count]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5"><div className="text-xs">{label}</div><strong className="text-xl">{count}</strong></div>)}</div>
      {!!Object.keys(errors).length && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{Object.keys(errors).length} Gudep gagal dibaca. Rekap belum lengkap. Pilih filter Gagal dimuat untuk melihat keterangan, lalu perbarui kehadiran.</p>}
      <div className="flex flex-wrap gap-2"><input aria-label="Cari kontingen hadir" placeholder="Cari sekolah, Gudep, atau nomor" value={search} onChange={e => setSearch(e.target.value)} className="min-w-48 flex-1 rounded-lg border bg-transparent p-2 text-sm"/><select aria-label="Filter kehadiran kontingen" value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border bg-white p-2 text-sm text-slate-900"><option value="ARRIVED">Sudah pernah hadir</option><option value="CHECKED_IN">Masih di lokasi</option><option value="CHECKED_OUT">Sudah pulang</option><option value="NOT_ARRIVED">Belum datang</option><option value="ALL">Semua kontingen</option><option value="ERROR">Gagal dimuat</option></select></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Kontingen / Gudep</th><th className="p-2">Kehadiran</th><th className="p-2">Datang</th><th className="p-2">Pulang</th><th className="p-2">Gerbang datang</th></tr></thead><tbody>{visible.map(g => { const r = records[g.gudep_id]; return <tr key={g.gudep_id} className="border-t border-slate-200 dark:border-white/10"><td className="p-2"><button type="button" onClick={() => onSelect(g.gudep_id)} className="text-left font-semibold text-emerald-700 dark:text-emerald-300">{g.gudep_name}</button><div className="text-xs text-slate-500">{g.gudep_number} · {g.institution_name}</div></td><td className="p-2">{r ? labels[r.status] : <span className="text-rose-600">Gagal dimuat: {errors[g.gudep_id] || 'Data belum tersedia'}</span>}</td><td className="p-2">{time(r?.arrival)}</td><td className="p-2">{time(r?.departure)}</td><td className="p-2">{r?.gate || '—'}</td></tr>; })}</tbody></table>{!visible.length && <p className="p-3 text-sm text-slate-500">Tidak ada kontingen sesuai filter.</p>}</div>
      <p className="text-xs text-slate-500">{visible.length} kontingen ditampilkan dari {gudeps.length} Gudep. Pembacaan terakhir: {updated}. Perbarui setelah scan baru.</p>
    </>}
  </section>;
};
