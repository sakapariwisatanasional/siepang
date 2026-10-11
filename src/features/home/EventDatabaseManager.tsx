/** SiEpang Model A — Admin-only creation / validation of an INACTIVE event database.
 * Backend performs its own authorization checks. No event activation here.
 */
import React, { useRef, useState } from 'react';
import { Database, FolderPlus, Loader2, ShieldCheck, ExternalLink, AlertTriangle } from 'lucide-react';
import { apiTransport } from '../../services/apiTransport';

type Draft = {
  status: string;
  name: string;
  event_id: string;
  request_key: string;
  spreadsheet_id: string;
  folder_id: string;
  schema_count: number;
  spreadsheet_url?: string;
  folder_url?: string;
};

const makeKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `evt_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
};

export const EventDatabaseManager: React.FC = () => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState<'create' | 'validate' | null>(null);
  const requestRef = useRef<string>('');
  const initialSignature = useRef<string>('');
  const pendingRef = useRef(false);

  const create = async () => {
    if (pendingRef.current || name.trim().length < 3) return;
    pendingRef.current = true;
    setWorking('create');
    setError('');
    const signature = JSON.stringify([name.trim(), date, location.trim()]);
    if (!requestRef.current || initialSignature.current !== signature) {
      requestRef.current = makeKey();
      initialSignature.current = signature;
    }
    try {
      const res = await apiTransport.send<Draft>('event.database.createDraft', {
        name: name.trim(), date, location: location.trim(), request_key: requestRef.current,
      }, { timeoutMs: 120000 });
      if (!res.ok || !res.data) throw new Error(res.error?.message || 'Respons pembuatan database tidak lengkap.');
      setDraft(res.data);
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : String(cause)} Jika terjadi timeout, jangan ganti nama/tanggal/lokasi sebelum mencoba ulang; ID proses yang sama akan dipakai agar tidak membuat duplikat.`);
    } finally { pendingRef.current = false; setWorking(null); }
  };

  const validate = async () => {
    if (pendingRef.current || !requestRef.current) return;
    pendingRef.current = true;
    setWorking('validate');
    setError('');
    try {
      const res = await apiTransport.send<Draft>('event.database.validateDraft', {
        request_key: requestRef.current,
      }, { timeoutMs: 120000 });
      if (!res.ok || !res.data) throw new Error(res.error?.message || 'Validasi gagal tanpa detail.');
      setDraft(res.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { pendingRef.current = false; setWorking(null); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1B1B21] sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <FolderPlus className="h-7 w-7 text-red-700 dark:text-red-300" />
        <div><h2 className="text-lg font-black text-slate-900 dark:text-white">Buat Database Event Baru</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Buat folder Drive dan Spreadsheet standar yang bersih. Event aktif tidak akan berubah.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Nama kegiatan
          <input className="mt-1 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 dark:border-white/20 dark:bg-slate-900 dark:text-white" maxLength={120} value={name} onChange={e=>{setName(e.target.value);setDraft(null);}} placeholder="Contoh: Perkemahan Wirakarya 2027" />
        </label>
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tanggal kegiatan
          <input type="date" className="mt-1 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 dark:border-white/20 dark:bg-slate-900 dark:text-white" value={date} onChange={e=>{setDate(e.target.value);setDraft(null);}} />
        </label>
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lokasi kegiatan
          <input className="mt-1 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 dark:border-white/20 dark:bg-slate-900 dark:text-white" maxLength={180} value={location} onChange={e=>{setLocation(e.target.value);setDraft(null);}} placeholder="Bumi Perkemahan" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!!working || name.trim().length < 3} onClick={create} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#A92224] px-4 py-3 text-sm font-bold text-white disabled:opacity-50 active:scale-[0.98]">
          {working === 'create' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Database className="h-4 w-4"/>}{working === 'create' ? 'Membuat database…' : 'Buat Database Draft'}
        </button>
        <button type="button" disabled={!!working || !requestRef.current} onClick={validate} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-50 dark:border-white/20 dark:text-white">
          {working === 'validate' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ShieldCheck className="h-4 w-4"/>}Validasi Draft
        </button>
      </div>
      {error && <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100"><AlertTriangle className="h-5 w-5 shrink-0"/><span>{error}</span></div>}
      {draft && <div className="mt-4 space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-slate-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100">
        <p className="font-black">Database: {draft.status === 'VALID' ? 'Lulus validasi' : 'Draft dibuat'}</p>
        <p>{draft.name} · {draft.schema_count} sheet · Event ID: <span className="break-all">{draft.event_id}</span></p>
        <p className="break-all text-xs">Spreadsheet ID: {draft.spreadsheet_id}</p>
        <p className="break-all text-xs">Folder ID: {draft.folder_id}</p>
        <p className="break-all text-xs">ID proses: {draft.request_key}</p>
        {draft.spreadsheet_url && <a className="inline-flex items-center gap-1 font-bold underline" href={draft.spreadsheet_url} target="_blank" rel="noopener noreferrer">Buka Spreadsheet <ExternalLink className="h-4 w-4"/></a>}
        {draft.folder_url && <a className="ml-3 inline-flex items-center gap-1 font-bold underline" href={draft.folder_url} target="_blank" rel="noopener noreferrer">Buka Folder <ExternalLink className="h-4 w-4"/></a>}
      </div>}
      <p className="mt-4 text-xs text-slate-600 dark:text-slate-300">Pembuatan dan validasi tidak mengaktifkan event. Aktivasi membutuhkan tahap backend terpisah. Apabila permintaan pembuatan timeout, gunakan ID proses yang sama dengan menekan kembali tanpa mengubah formulir.</p>
    </section>
  );
};
