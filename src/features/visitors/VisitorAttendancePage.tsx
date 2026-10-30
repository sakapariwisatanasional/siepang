import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QrImage } from '../../components/qr/QrImage';
import { apiTransport } from '../../services/apiTransport';

type Pass = { id: string; pass_code: string; qr_token: string; valid_date: string; status: string };
type Guest = { id: string; full_name: string; passes?: Pass[]; status?: string; visit_date?: string; expected_arrival?: string; expected_departure?: string; institution?: string; category?: string; registration_code?: string };
type Visit = { id: string; visitor_id: string; visitor_name?: string; checkin_at: string; checkout_at?: string; status: string; gate_name?: string; officer_name?: string };
const formatTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('id-ID', {timeZone: 'Asia/Jakarta'}) : '—';
export function visitorAttendanceRows(visitors: Guest[], visits: Visit[]) {
  const people = new Map(visitors.map(v => [v.id, v]));
  const latest = new Map<string, Visit>();
  for (const visit of visits) {
    if (!visit.visitor_id || !visit.checkin_at || !Number.isFinite(Date.parse(visit.checkin_at)) || !['CHECKED_IN', 'CHECKED_OUT'].includes(visit.status)) continue;
    const previous = latest.get(visit.visitor_id);
    if (!previous || Date.parse(visit.checkin_at) >= Date.parse(previous.checkin_at)) latest.set(visit.visitor_id, visit);
  }
  for (const guest of visitors) if (!latest.has(guest.id)) latest.set(guest.id, {id: guest.id, visitor_id: guest.id, checkin_at: '', status: 'NOT_CHECKED_IN'});
  return Array.from(latest.values()).map(visit => ({ ...visit, guest: people.get(visit.visitor_id) })).sort((a, b) => (Date.parse(b.checkin_at) || 0) - (Date.parse(a.checkin_at) || 0));
}
export const VisitorAttendancePage: React.FC = () => {
  const [rows, setRows] = useState<ReturnType<typeof visitorAttendanceRows>>([]);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selectedPass, setSelectedPass] = useState<{ pass: Pass; name: string } | null>(null);
  const [checkoutRow, setCheckoutRow] = useState<(typeof rows)[number] | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
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
  const checkout = async () => {
    if (!checkoutRow || saveLock.current) return;
    const pass = checkoutRow.guest?.passes?.find(p => p.status === 'APPROVED' && p.qr_token);
    if (!pass) { setError('Tidak ada pass aktif yang memiliki QR. Periksa data VisitorPasses.'); return; }
    saveLock.current = true; setSaving(true); setError('');
    try {
      const result = await apiTransport.send<{ scan: { visitor_id: string; status: string } }>('visitors.gate.scan', {token: pass.qr_token, direction: 'CHECK_OUT', gate_id: 'gate_utama'}, {timeoutMs: 45000});
      if (!result.ok || result.data?.scan?.visitor_id !== checkoutRow.visitor_id || result.data.scan.status !== 'CHECKED_OUT') throw new Error(result.error?.message || 'Check-out belum dikonfirmasi GAS. Muat ulang sebelum mencoba kembali.');
      setCheckoutRow(null); await load();
    } catch (e: any) {setError(e?.message || 'Gagal mencatat keluar. Muat ulang untuk memeriksa hasilnya.');}
    finally {saveLock.current = false; setSaving(false);}
  };
  const visible = rows.filter(r => (status === 'ALL' || r.status === status) && `${r.guest?.full_name || r.visitor_name || ''} ${r.guest?.institution || ''} ${r.guest?.registration_code || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-5 dark:text-white">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418]"><div><h1 className="text-xl font-bold">Daftar Hadir Tamu</h1><p className="mt-1 text-sm text-slate-500">Data seluruh event aktif. Terdaftar = belum tercatat masuk + pernah hadir. Pernah hadir = belum check-out + sudah pulang. Rencana waktu berasal dari formulir; waktu aktual berasal dari scan gerbang (WIB).</p></div><button type="button" disabled={busy} onClick={() => void load()} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Memuat…' : 'Perbarui Kehadiran'}</button></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}{loaded ? ' Data sebelumnya tetap ditampilkan; pembaruan terakhir gagal.' : ' Daftar kehadiran belum berhasil dimuat.'}</p>}
    {!loaded && busy && <p role="status" className="text-sm text-slate-500">Membaca daftar hadir tamu dari GAS…</p>}
    {loaded && <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[['Terdaftar', rows.filter(r => r.guest).length], ['Belum tercatat masuk', rows.filter(r => r.status === 'NOT_CHECKED_IN').length], ['Pernah hadir', rows.filter(r => r.status !== 'NOT_CHECKED_IN').length], ['Masih di lokasi', rows.filter(r => r.status === 'CHECKED_IN').length], ['Sudah pulang', rows.filter(r => r.status === 'CHECKED_OUT').length]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418]"><p className="text-sm text-slate-500">{label}</p><strong className="text-2xl">{value}</strong></div>)}</div>
      <div className="flex flex-wrap gap-2"><input aria-label="Cari tamu" placeholder="Cari nama, instansi, atau kode tamu" value={query} onChange={e => setQuery(e.target.value)} className="min-w-40 flex-1 rounded-xl border bg-transparent px-3 py-2 text-sm"/><select aria-label="Filter kehadiran tamu" value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"><option value="ALL">Semua tamu terdaftar / hadir</option><option value="NOT_CHECKED_IN">Terdaftar, belum tercatat masuk</option><option value="CHECKED_IN">Masih di lokasi</option><option value="CHECKED_OUT">Sudah pulang</option></select></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#141418]"><table className="w-full min-w-[1100px] text-left text-sm"><thead><tr>{['Nama Tamu / Kode', 'Instansi / Kategori', 'Status', 'Rencana Kunjungan (WIB)', 'Check-in', 'Check-out', 'Gerbang', 'Petugas', 'QR / Tindakan'].map(h => <th className="p-3 align-top" key={h}>{h}</th>)}</tr></thead><tbody>{visible.map(r => <tr key={r.visitor_id} className="border-t border-slate-200 dark:border-white/10"><td className="p-3 align-top font-semibold">{r.guest?.full_name || r.visitor_name || 'Nama belum tersedia'}<p className="text-xs font-normal text-slate-500">{r.guest?.registration_code || r.visitor_id}</p>{r.status === 'NOT_CHECKED_IN' && ['CHECKED_IN','CHECKED_OUT'].includes(r.guest?.status || '') && <p className="text-xs text-amber-700">Status visitor tidak sesuai log. Perlu pemeriksaan.</p>}</td><td className="p-3 align-top">{r.guest?.institution || '—'}<p className="text-xs text-slate-500">{r.guest?.category || '—'}</p></td><td className="p-3 align-top">{r.status === 'CHECKED_IN' ? 'Belum check-out' : r.status === 'CHECKED_OUT' ? 'Sudah pulang' : 'Belum tercatat masuk'}</td><td className="p-3 align-top"><p>{r.guest?.visit_date || 'Belum diisi'}</p><p className="whitespace-nowrap text-xs text-slate-500">Datang: {r.guest?.expected_arrival || 'Belum diisi'}<br/>Pulang: {r.guest?.expected_departure || 'Belum diisi'}</p></td><td className="p-3 align-top">{formatTime(r.checkin_at)}</td><td className="p-3 align-top">{formatTime(r.checkout_at)}</td><td className="p-3 align-top">{r.gate_name || '—'}</td><td className="p-3 align-top">{r.officer_name || '—'}</td><td className="p-3 align-top"><div className="flex flex-col gap-2">{r.guest?.passes?.length ? r.guest.passes.map(pass => <button key={pass.id} type="button" disabled={!pass.qr_token} onClick={() => setSelectedPass({pass, name: r.guest?.full_name || r.visitor_name || r.visitor_id})} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">Lihat QR {pass.pass_code} ({pass.status})</button>) : <span className="text-xs text-amber-700">QR Pass belum tersedia</span>}{r.status === 'CHECKED_IN' && <button type="button" disabled={saving || !r.guest?.passes?.some(p => p.status === 'APPROVED' && p.qr_token)} onClick={() => setCheckoutRow(r)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs text-white disabled:opacity-40">Catat Keluar</button>}</div></td></tr>)}</tbody></table>{!visible.length && <p className="p-5 text-sm text-slate-500">{rows.length ? 'Tidak ada tamu sesuai filter.' : 'Belum ada check-in tamu yang tercatat.'}</p>}</div>
      <p aria-live="polite" className="text-xs text-slate-500">{visible.length} tamu ditampilkan. Pembacaan terakhir: {updated}. Pembaruan otomatis setiap 60 detik saat halaman terlihat.</p>
    </>}
    {selectedPass && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-label="QR Pass pengunjung" className="max-h-[90dvh] w-full max-w-sm overflow-auto rounded-2xl bg-white p-5 text-slate-900"><button type="button" onClick={() => setSelectedPass(null)} className="float-right rounded-lg border px-3 py-2">Tutup</button><h2 className="font-bold">QR Pass Visitor</h2><p className="mt-4">{selectedPass.name}</p><p>{selectedPass.pass.pass_code}</p><p className="text-sm">Berlaku: {selectedPass.pass.valid_date} · {selectedPass.pass.status}</p><QrImage value={selectedPass.pass.qr_token} size={240} className="mx-auto mt-4"/><p className="mt-3 text-xs text-slate-500">QR asli dari GAS. Membuka QR tidak mengubah kehadiran.</p></section></div>}
    {checkoutRow && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-label="Konfirmasi keluar" className="w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900"><h2 className="font-bold">Catat pengunjung keluar?</h2><p className="my-3">Pastikan {checkoutRow.guest?.full_name || checkoutRow.visitor_name} sudah pulang. Waktu yang dicatat adalah waktu sekarang, bukan perkiraan waktu pulang.</p><div className="flex gap-2"><button disabled={saving} onClick={() => setCheckoutRow(null)} className="rounded-lg border px-4 py-2">Batal</button><button disabled={saving} onClick={() => void checkout()} className="rounded-lg bg-emerald-700 px-4 py-2 text-white">{saving ? 'Menyimpan ke GAS...' : 'Ya, Catat Keluar'}</button></div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</section></div>}
  </main>;
};
