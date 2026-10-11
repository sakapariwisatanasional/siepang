/** SiEpang — Judging interface: real CompetitionEntries and confirmed GAS persistence. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Save, Trophy, Lock, ScanLine } from 'lucide-react';
import { judgeCloudService, type Criteria, type EntryRecord, type ScoreRecord } from '../../services/judgeCloudService';

const DEFAULT: Criteria = { kreativitas: 0, kesesuaianTema: 0, teknikPramuka: 0, kerapian: 0 };
const RUBRIC: { key: keyof Criteria; label: string; weight: string }[] = [
  { key: 'kreativitas', label: 'Kreativitas & Inovasi', weight: '30%' },
  { key: 'kesesuaianTema', label: 'Kesesuaian Tema', weight: '25%' },
  { key: 'teknikPramuka', label: 'Teknik Kepramukaan', weight: '30%' },
  { key: 'kerapian', label: 'Kerapian & Keindahan', weight: '15%' },
];
const decode = (value: unknown): Criteria => {
  try {
    const source = typeof value === 'string' ? JSON.parse(value) : value;
    if (!source || typeof source !== 'object') return { ...DEFAULT };
    return Object.fromEntries((Object.keys(DEFAULT) as (keyof Criteria)[]).map(k => [k, Number((source as any)[k] || 0)])) as Criteria;
  } catch { return { ...DEFAULT }; }
};
const memberIds = (entry: EntryRecord): string[] => {
  try {
    const raw = typeof entry.team_members_json === 'string' ? JSON.parse(entry.team_members_json) : entry.team_members_json;
    return Array.isArray(raw) ? raw.map(v => typeof v === 'string' ? v : String(v?.participant_id || v?.id || '')) : [];
  } catch { return []; }
};
const getQrId = (text: string) => {
  const trimmed = text.trim();
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      return url.searchParams.get('p') || url.searchParams.get('participant_id') || trimmed;
    }
  } catch { /* use raw code */ }
  return trimmed;
};
export const JudgeScoringInterface: React.FC = () => {
  const [entries, setEntries] = useState<EntryRecord[]>([]);
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [competitionId, setCompetitionId] = useState('');
  const [entryId, setEntryId] = useState('');
  const [criteria, setCriteria] = useState<Criteria>({ ...DEFAULT });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const lockRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [qrCode, setQrCode] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await judgeCloudService.load();
      setEntries(data.entries); setRecords(data.scores);
      setCompetitionId(prev => data.entries.some(e => e.competition_id === prev) ? prev : data.entries[0]?.competition_id || '');
    } catch (e: any) { setError(e?.message || 'Gagal memuat data lomba.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const competitions = useMemo(() => [...new Set(entries.map(e => e.competition_id).filter(Boolean))], [entries]);
  const available = useMemo(() => entries.filter(e => e.competition_id === competitionId), [entries, competitionId]);
  useEffect(() => { setEntryId(prev => available.some(e => e.id === prev) ? prev : available[0]?.id || ''); }, [available]);
  const entry = available.find(e => e.id === entryId);
  const existing = useMemo(() => {
    if (!entry) return undefined;
    try { return judgeCloudService.getOwnScore(records, entry.competition_id, entry.id); } catch { return undefined; }
  }, [records, entry]);
  useEffect(() => { setCriteria(existing ? decode(existing.criteria_scores_json) : { ...DEFAULT }); setNotice(''); }, [existing?.id, entryId, existing?.submitted_at]);
  const isLocked = existing?.is_locked === true || String(existing?.is_locked).toLowerCase() === 'true';
  const total = Math.round(criteria.kreativitas * .3 + criteria.kesesuaianTema * .25 + criteria.teknikPramuka * .3 + criteria.kerapian * .15);
  const save = async () => {
    if (!entry || lockRef.current || isLocked) return;
    lockRef.current = true; setSaving(true); setNotice(''); setError('');
    try {
      const saved = await judgeCloudService.save(entry, criteria, existing);
      setRecords(prev => [saved, ...prev.filter(x => x.id !== saved.id)]);
      setNotice(`Nilai ${saved.score} berhasil disimpan dan dikonfirmasi GAS untuk entri ${entry.id}.`);
    } catch (e: any) { setError(e?.message || 'Penyimpanan belum terkonfirmasi. Periksa GAS sebelum mengulang.'); }
    finally { lockRef.current = false; setSaving(false); }
  };
  const selectByQr = () => {
    const id = getQrId(qrCode);
    if (!id) return;
    const matches = entries.filter(e => e.team_leader_id === id || memberIds(e).includes(id));
    if (matches.length === 1) { setCompetitionId(matches[0].competition_id); setEntryId(matches[0].id); setNotice(`QR peserta cocok dengan entri ${matches[0].id}.`); setError(''); }
    else if (matches.length > 1) setError('Peserta mengikuti beberapa lomba. Pilih cabang dan entri lomba secara manual.');
    else setError('ID QR belum terhubung ke CompetitionEntries. Daftarkan entri lomba terlebih dahulu; jangan membuat nilai tanpa entri.');
  };
  const inputClass = 'w-full rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#222228] p-3 text-sm text-slate-900 dark:text-white';
  return <div className="max-w-2xl mx-auto space-y-4 pb-10 text-slate-900 dark:text-white">
    <div className="rounded-3xl bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/10 p-5 space-y-2">
      <div className="flex items-center gap-2"><Trophy className="text-amber-600"/><h1 className="text-xl font-bold">Penilaian Lomba</h1></div>
      <p className="text-xs text-slate-600 dark:text-slate-300">Nilai hanya dinyatakan tersimpan setelah dikonfirmasi Google Apps Script.</p>
      <button type="button" onClick={() => void load()} disabled={loading || saving} className="flex items-center gap-2 min-h-11 text-sm font-semibold text-emerald-700 dark:text-emerald-400"><RefreshCw size={16}/>{loading ? 'Memuat dari GAS…' : 'Muat ulang dari GAS'}</button>
    </div>
    {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-300 p-3 text-sm text-red-700 dark:text-red-200 flex gap-2"><AlertTriangle size={18}/>{error}</div>}
    {notice && <div role="status" className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 p-3 text-sm text-emerald-700 dark:text-emerald-200 flex gap-2"><CheckCircle2 size={18}/>{notice}</div>}
    {!loading && entries.length === 0 && <div className="rounded-2xl border p-5 text-sm">Belum ada entri lomba yang dapat dinilai pada event ini. Siapkan data di <strong>CompetitionEntries</strong> lebih dahulu.</div>}
    {entries.length > 0 && <>
      <div className="rounded-3xl bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/10 p-5 space-y-4">
        <div><label className="text-sm font-semibold">Cabang lomba</label><select className={inputClass} value={competitionId} onChange={e => setCompetitionId(e.target.value)}>{competitions.map(id => <option key={id} value={id}>{id}</option>)}</select></div>
        <div><label className="text-sm font-semibold">Entri lomba</label><select className={inputClass} value={entryId} onChange={e => setEntryId(e.target.value)}>{available.map(e => <option key={e.id} value={e.id}>{e.team_name || e.entry_title || e.id} — {e.id}</option>)}</select></div>
        <div className="space-y-2"><label className="text-sm font-semibold flex items-center gap-2"><ScanLine size={16}/> ID dari QR peserta (opsional)</label><div className="flex gap-2"><input className={inputClass} value={qrCode} placeholder="p_... atau URL /scan?p=..." onChange={e => setQrCode(e.target.value)} /><button className="rounded-xl px-4 bg-slate-800 text-white text-sm font-bold min-h-11" type="button" onClick={selectByQr}>Cari</button></div><p className="text-xs text-slate-500">QR dipakai untuk mencari entri yang sudah terhubung; tidak membuat entri baru. Kamera scanner global tetap terpisah.</p></div>
      </div>
      {entry && <div className="rounded-3xl bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/10 p-5 space-y-5">
        <div className="flex justify-between items-center"><h2 className="font-bold">Rubrik Penilaian</h2><div className="text-2xl font-black text-orange-600">{total}<span className="text-xs"> /100</span></div></div>
        {RUBRIC.map(item => <div key={item.key} className="space-y-2"><div className="flex justify-between text-sm font-medium"><span>{item.label} ({item.weight})</span><span>{criteria[item.key]}</span></div><input type="range" min="0" max="100" step="1" disabled={saving || isLocked} className="w-full accent-orange-600" value={criteria[item.key]} onChange={e => setCriteria(prev => ({ ...prev, [item.key]: Number(e.target.value) }))}/></div>)}
        {existing && <p className="text-xs text-slate-500">Nilai juri saat ini dari database: {existing.score} · ID {existing.id}</p>}
        {isLocked && <p className="text-sm flex gap-2 text-amber-600"><Lock size={18}/>Nilai terkunci. Hubungi admin lomba untuk revisi.</p>}
        <button type="button" disabled={saving || loading || isLocked} onClick={() => void save()} className="w-full min-h-12 rounded-2xl bg-emerald-700 text-white font-bold text-sm disabled:opacity-50 flex gap-2 items-center justify-center"><Save size={18}/>{saving ? 'Menyimpan ke GAS…' : 'Simpan Nilai ke Spreadsheet'}</button>
      </div>}
    </>}
  </div>;
};
