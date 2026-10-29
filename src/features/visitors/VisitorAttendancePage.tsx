import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiTransport } from '../../services/apiTransport';

type Guest = { id: string; full_name: string; institution?: string; category?: string; registration_code?: string };
type Visit = { id: string; visitor_id: string; visitor_name?: string; checkin_at: string; checkout_at?: string; status: string; gate_name?: string; officer_name?: string };
const formatTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('id-ID') : '—';
export function visitorAttendanceRows(visitors: Guest[], visits: Visit[]) {
  const people = new Map(visitors.map(v => [v.id, v]));
  const latest = new Map<string, Visit>();
  for (const visit of visits) {
    if (!visit.visitor_id || !visit.checkin_at || !Number.isFinite(Date.parse(visit.checkin_at)) || !['CHECKED_IN', 'CHECKED_OUT'].includes(visit.status)) continue;
    const previous = latest.get(visit.visitor_id);
    if (!previous || Date.parse(visit.checkin_at) >= Date.parse(previous.checkin_at)) latest.set(visit.visitor_id, visit);
  }
  return Array.from(latest.values()).map(visit => ({ ...visit, guest: people.get(visit.visitor_id) })).sort((a, b) => Date.parse(b.checkin_at) - Date.parse(a.checkin_at));
}
export const VisitorAttendancePage: React.FC = () => {
  const [rows, setRows] = useState<ReturnType<typeof visitorAttendanceRows>>([]);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const running = useRef(false);
  const alive = useRef(false);
  const load = useCallback(async () => {
    if (running.current) return;
    running.current = true; setBusy(true);
    try {
      const result = await apiTransport.send<{ visitors: Guest[]; visits: Visit[] }>('visitors.gate.list', {}, { timeoutMs: 45000 });
      if (!result.ok || !result.data) throw new Error(result.error?.message || 'GAS gagal membaca daftar hadir tamu.');
      if (!Array.isArray(result.data.visitors) || !Array.isArray(result.data.visits)) throw new Error('Format data kehadiran dari GAS tidak sesuai.');
      if (alive.current) { setRows(visitorAttendanceRows(result.data.visitors, result.data.visits)); setError(''); setLoaded(true); setUpdated(new Date().toLocaleString('id-ID')); }
    } catch (e: any) { if (alive.current) setError(e?.message || 'Gagal membaca kehadiran tamu.'); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }, []);
  useEffect(() => {
    alive.current = true; void load();
    const refresh = () => { if (!document.hidden) void load(); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { alive.current = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  const visible = rows.filter(r => (status === 'ALL' || r.status === status) && `${r.guest?.full_name || r.visitor_name || ''} ${r.guest?.institution || ''} ${r.guest?.registration_code || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-5 dark:text-white">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418]"><div><h1 className="text-xl font-bold">Daftar Hadir Tamu</h1><p className="mt-1 text-sm text-slate-500">Kehadiran berdasarkan check-in gerbang pada event aktif. Menampilkan kunjungan terakhir setiap tamu.</p></div><button type="button" disabled={busy} onClick={() => void load()} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Memuat…' : 'Perbarui Kehadiran'}</button></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}{loaded ? ' Data sebelumnya tetap ditampilkan; pembaruan terakhir gagal.' : ' Daftar kehadiran belum berhasil dimuat.'}</p>}
    {!loaded && busy && <p role="status" className="text-sm text-slate-500">Membaca daftar hadir tamu dari GAS…</p>}
    {loaded && <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[['Pernah hadir', rows.length], ['Masih di lokasi', rows.filter(r => r.status === 'CHECKED_IN').length], ['Sudah pulang', rows.filter(r => r.status === 'CHECKED_OUT').length]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418]"><p className="text-sm text-slate-500">{label}</p><strong className="text-2xl">{value}</strong></div>)}</div>
      <div className="flex flex-wrap gap-2"><input aria-label="Cari tamu" placeholder="Cari nama, instansi, atau kode tamu" value={query} onChange={e => setQuery(e.target.value)} className="min-w-40 flex-1 rounded-xl border bg-transparent px-3 py-2 text-sm"/><select aria-label="Filter kehadiran tamu" value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"><option value="ALL">Semua tamu yang pernah hadir</option><option value="CHECKED_IN">Masih di lokasi</option><option value="CHECKED_OUT">Sudah pulang</option></select></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#141418]"><table className="w-full text-left text-sm"><thead><tr>{['Nama Tamu / Kode', 'Instansi / Kategori', 'Status', 'Check-in', 'Check-out', 'Gerbang', 'Petugas'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{visible.map(r => <tr key={r.visitor_id} className="border-t border-slate-200 dark:border-white/10"><td className="p-3 font-semibold">{r.guest?.full_name || r.visitor_name || 'Nama belum tersedia'}<p className="text-xs font-normal text-slate-500">{r.guest?.registration_code || r.visitor_id}</p></td><td className="p-3">{r.guest?.institution || '—'}<p className="text-xs text-slate-500">{r.guest?.category || '—'}</p></td><td className="p-3">{r.status === 'CHECKED_IN' ? 'Masih di lokasi' : 'Sudah pulang'}</td><td className="p-3">{formatTime(r.checkin_at)}</td><td className="p-3">{formatTime(r.checkout_at)}</td><td className="p-3">{r.gate_name || '—'}</td><td className="p-3">{r.officer_name || '—'}</td></tr>)}</tbody></table>{!visible.length && <p className="p-5 text-sm text-slate-500">{rows.length ? 'Tidak ada tamu sesuai filter.' : 'Belum ada check-in tamu yang tercatat.'}</p>}</div>
      <p aria-live="polite" className="text-xs text-slate-500">{visible.length} tamu ditampilkan. Pembacaan terakhir: {updated}. Pembaruan otomatis setiap 60 detik saat halaman terlihat.</p>
    </>}
  </main>;
};
