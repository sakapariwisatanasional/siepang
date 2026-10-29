import React, { useEffect, useRef, useState } from 'react';
import { apiTransport } from '../../services/apiTransport';

type Match = { participant_id: string; name: string; institution: string; gudep_id: string; gudep_name: string; status: 'READY' | 'BLOCKED' | 'ALREADY_LINKED'; reason: string };
type Outcome = { participant_id: string; gudep_id: string; status: string; message: string };
const statusLabel = { READY: 'Siap ditautkan', BLOCKED: 'Perlu diperiksa', ALREADY_LINKED: 'Sudah tertaut' };
async function request<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const result = await apiTransport.send<T>(action, payload, { timeoutMs: 60000 });
  if (!result.ok || !result.data) throw new Error(result.error?.message || 'GAS tidak mengembalikan hasil.');
  return result.data;
}
export const GudepBulkLinkPanel: React.FC<{ onLinked: () => void }> = ({ onLinked }) => {
  const [rows, setRows] = useState<Match[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('READY');
  const [gudep, setGudep] = useState('');
  const lock = useRef(false);
  const read = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage(''); setOutcomes([]); setWarnings([]); setSelected([]); setLoaded(false);
    try {
      const result = await request<{ rows: Match[] }>('participants.admin.gudepMatchPreview', {});
      if (!Array.isArray(result.rows)) throw new Error('Format pencocokan dari GAS tidak sesuai. Perbarui backend terlebih dahulu.');
      setRows(result.rows); setLoaded(true);
    } catch (e: any) { setError(e?.message || 'Gagal membaca data peserta.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const visible = rows.filter(r => (!status || r.status === status) && (!gudep || r.gudep_id === gudep) && `${r.name} ${r.institution} ${r.gudep_name}`.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => { void read(); }, []);
  const eligible = visible.filter(r => r.status === 'READY');
  const allChecked = eligible.length > 0 && eligible.every(r => selected.includes(r.participant_id));
  const choices = rows.filter(r => selected.includes(r.participant_id) && r.status === 'READY');
  const link = async () => {
    if (lock.current || !choices.length || choices.length > 100) return;
    if (!window.confirm(`Tautkan ${choices.length} peserta sesuai hasil pencocokan GAS? Pembagian regu yang ada tetap dipertahankan.`)) return;
    lock.current = true; setBusy(true); setError(''); setMessage(''); setOutcomes([]); setWarnings([]);
    try {
      const result = await request<{ details: Outcome[]; warnings: string[]; linked: number; skipped: number; failed: number }>('participants.admin.linkGudepBatch', { assignments: choices.map(r => ({ participant_id: r.participant_id, gudep_id: r.gudep_id })) });
      if (!Array.isArray(result.details) || result.details.length !== choices.length || choices.some(r => result.details.filter(d => d.participant_id === r.participant_id && d.gudep_id === r.gudep_id).length !== 1)) throw new Error('Hasil penautan belum dapat dipastikan. Baca ulang data sebelum mencoba lagi.');
      setOutcomes(result.details); setWarnings(result.warnings || []); setMessage(`Berhasil: ${result.linked}. Dilewati: ${result.skipped}. Gagal / perlu diperiksa: ${result.failed}.`);
      setSelected([]); setLoaded(false); onLinked();
      try { const fresh = await request<{ rows: Match[] }>('participants.admin.gudepMatchPreview', {}); if (!Array.isArray(fresh.rows)) throw new Error('Format data tidak sesuai.'); setRows(fresh.rows); setLoaded(true); }
      catch (e: any) { setError(`Hasil proses tersedia di bawah, tetapi pembacaan ulang gagal: ${e?.message || 'Gangguan koneksi'}. Tekan Baca & Cocokkan Data.`); }
    } catch (e: any) { setLoaded(false); setSelected([]); setError(`${e?.message || 'Koneksi terputus.'} Jika permintaan sempat dikirim, sebagian data mungkin sudah tersimpan. Baca ulang sebelum mencoba lagi.`); }
    finally { lock.current = false; setBusy(false); }
  };
  const groups = Array.from(new Map(rows.filter(r => r.gudep_id).map(r => [r.gudep_id, r.gudep_name])).entries());
  return <section className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-[#141418] dark:text-white">
    <h3 className="font-bold">Tautkan Peserta Otomatis Berdasarkan Gudep</h3>
    <p className="text-xs text-slate-500">GAS membaca peserta dan mencocokkan sekolah atau relasi kontingennya. Periksa hasil, pilih peserta, lalu tautkan. Tidak perlu memilih regu.</p>
    <button type="button" disabled={busy} onClick={() => void read()} className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Memproses…' : 'Baca & Cocokkan Data'}</button>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {warnings.map((w, i) => <p role="alert" key={i} className="text-sm text-amber-700">{w}</p>)}
    {loaded && <>
      <div className="flex flex-wrap gap-3 text-xs">{(['READY', 'ALREADY_LINKED', 'BLOCKED'] as const).map(s => <span key={s}>{statusLabel[s]}: <strong>{rows.filter(r => r.status === s).length}</strong></span>)}</div>
      <div className="flex flex-wrap gap-2"><input aria-label="Cari peserta atau sekolah" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari peserta / sekolah / Gudep" className="min-w-40 flex-1 rounded-lg border bg-transparent p-2 text-sm"/><select aria-label="Filter Gudep hasil pencocokan" value={gudep} onChange={e => setGudep(e.target.value)} className="max-w-full rounded-lg border bg-white p-2 text-sm text-slate-900"><option value="">Semua Gudep</option>{groups.map(([id, name]) => <option value={id} key={id}>{name} ({rows.filter(r => r.gudep_id === id && r.status === 'READY').length} siap)</option>)}</select><select aria-label="Filter hasil pencocokan" value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border bg-white p-2 text-sm text-slate-900"><option value="">Semua hasil</option>{Object.entries(statusLabel).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy || !eligible.length} checked={allChecked} onChange={() => setSelected(old => allChecked ? old.filter(id => !eligible.some(r => r.participant_id === id)) : Array.from(new Set([...old, ...eligible.map(r => r.participant_id)])))} /> Pilih semua peserta siap pada hasil yang tampil</label>
      <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Pilih</th><th className="p-2">Peserta / Sekolah</th><th className="p-2">Gudep Tujuan</th><th className="p-2">Hasil pembacaan GAS</th></tr></thead><tbody>{visible.map((r, index) => <tr key={`${r.participant_id}-${index}`} className="border-t dark:border-white/10"><td className="p-2"><input aria-label={`Pilih ${r.name}`} type="checkbox" checked={selected.includes(r.participant_id)} disabled={busy || r.status !== 'READY'} onChange={e => setSelected(old => e.target.checked ? [...old, r.participant_id] : old.filter(id => id !== r.participant_id))}/></td><td className="p-2 font-medium">{r.name}<div className="text-xs font-normal text-slate-500">{r.institution || 'Sekolah belum diisi'}</div></td><td className="p-2">{r.gudep_name || 'Belum ditemukan'}</td><td className="p-2">{statusLabel[r.status]}<div className="text-xs text-slate-500">{r.reason}</div></td></tr>)}</tbody></table>{!visible.length && <p className="p-3 text-sm">Tidak ada peserta sesuai filter.</p>}</div>
      <p className="text-xs text-slate-500">{choices.length} peserta terpilih, termasuk pilihan di luar filter. Maksimal 100 peserta per proses.</p>
      {choices.length > 100 && <p role="alert" className="text-sm text-rose-600">Kurangi pilihan menjadi maksimal 100 peserta.</p>}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !choices.length || choices.length > 100} onClick={() => void link()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Tautkan {choices.length} Peserta ke Gudep</button><button type="button" disabled={busy} onClick={() => setSelected([])} className="rounded-xl border px-4 py-2 text-sm">Batalkan Semua Pilihan</button></div>
    </>}
    {!!outcomes.length && <div className="max-h-72 overflow-auto"><h4 className="font-semibold">Hasil penautan terakhir</h4>{outcomes.map(r => <p key={r.participant_id} className="border-t py-2 text-xs">{rows.find(p => p.participant_id === r.participant_id)?.name || r.participant_id}: {r.message}</p>)}</div>}
  </section>;
};
