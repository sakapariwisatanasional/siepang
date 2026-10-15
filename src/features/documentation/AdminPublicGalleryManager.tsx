/**
 * SiEpang — Admin Public Gallery Manager
 * Source of truth: GAS actions gallery.admin.* via documentationService.
 * Install: src/features/documentation/AdminPublicGalleryManager.tsx
 * NOTE: This is an ADDITIVE page component. Mount it as a dedicated route/tab
 * with role checks in App.tsx; backend independently enforces permissions.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, ExternalLink, Film, Image as ImageIcon, Loader2, Pencil, Plus, RefreshCw, Save, Search, X, AlertCircle } from 'lucide-react';
import { documentationService, type GalleryUrlRecord } from '../../services/documentationService';

type GalleryForm = {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  title: string;
  caption: string;
  source_url: string;
  thumbnail_url: string;
  album_id: string;
  display_order: string;
  status: 'DRAFT' | 'PUBLISHED';
};
const emptyForm = (): GalleryForm => ({
  id: '', type: 'PHOTO', title: '', caption: '', source_url: '', thumbnail_url: '',
  album_id: '', display_order: '0', status: 'DRAFT',
});
const trim = (x: string) => x.trim();
const validHttps = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password;
  } catch { return false; }
};

export const AdminPublicGalleryManager: React.FC = () => {
  const [items, setItems] = useState<GalleryUrlRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PHOTO' | 'VIDEO'>('ALL');
  const [form, setForm] = useState<GalleryForm | null>(null);
  const [total, setTotal] = useState(0);
  const [pendingArchive, setPendingArchive] = useState<GalleryUrlRecord | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Current service returns the first 100 records; do not pretend this is a full database list.
      const result = await documentationService.listGalleryForAdmin();
      setItems(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat galeri dari GAS.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  const visible = useMemo(() => items.filter(m =>
    (filter === 'ALL' || m.type === filter) &&
    [m.title, m.caption, m.source_url].some(s => String(s || '').toLowerCase().includes(search.toLowerCase()))
  ), [items, filter, search]);

  const edit = (item: GalleryUrlRecord) => {
    setError(''); setNotice('');
    setForm({
      id: item.id, type: item.type, title: item.title || '', caption: item.caption || '',
      source_url: item.source_url || '', thumbnail_url: item.thumbnail_url || '',
      album_id: item.album_id || '', display_order: String(item.display_order ?? 0),
      status: item.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || working) return;
    if (!trim(form.title)) { setError('Judul wajib diisi.'); return; }
    if (!validHttps(trim(form.source_url))) { setError('URL media wajib berupa tautan HTTPS yang valid.'); return; }
    if (trim(form.thumbnail_url) && !validHttps(trim(form.thumbnail_url))) {
      setError('URL thumbnail harus menggunakan HTTPS.'); return;
    }
    const displayOrder = Number(form.display_order);
    if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 999999) {
      setError('Urutan tampil harus bilangan bulat antara 0 dan 999999.'); return;
    }
    setWorking(true); setError(''); setNotice('');
    try {
      await documentationService.saveGalleryUrl({
        id: form.id, type: form.type, title: trim(form.title), caption: trim(form.caption),
        source_url: trim(form.source_url), thumbnail_url: trim(form.thumbnail_url),
        album_id: trim(form.album_id), display_order: displayOrder, status: form.status,
      });
      setForm(null);
      setNotice('Media berhasil disimpan di GAS. Status publikasi mengikuti pilihan Anda.');
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menyimpan media.'); }
    finally { setWorking(false); }
  };

  const archive = async () => {
    if (!pendingArchive || working) return;
    setWorking(true); setError(''); setNotice('');
    try {
      await documentationService.archiveGalleryUrl(pendingArchive.id);
      setPendingArchive(null);
      setNotice('Media berhasil diarsipkan. Tautan tidak lagi ditampilkan di Galeri Publik.');
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal mengarsipkan media.'); }
    finally { setWorking(false); }
  };

  const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
  const labelClass = 'block space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200';

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6" aria-label="Manajemen Galeri Publik">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manajemen Galeri Publik</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Kelola foto dan video dari URL. Data tersimpan di Google Sheets melalui GAS.</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void reload()} disabled={loading || working} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"><RefreshCw className="h-4 w-4"/> Muat Ulang</button>
          <button type="button" onClick={() => { setForm(emptyForm()); setError(''); setNotice(''); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><Plus className="h-4 w-4"/> Tambah Media</button>
        </div>
      </div>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>{notice}</div>}

      {form && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6" aria-label="Form URL media">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900 dark:text-white">{form.id ? 'Edit Media' : 'Tambah Foto / Video'}</h2><button aria-label="Tutup formulir" type="button" onClick={() => setForm(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5"/></button></div>
        <form onSubmit={e => void submit(e)} className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Jenis Media<select className={inputClass} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as GalleryForm['type'] })}><option value="PHOTO">Foto</option><option value="VIDEO">Video</option></select></label>
          <label className={labelClass}>Status Publikasi<select className={inputClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as GalleryForm['status'] })}><option value="DRAFT">Draft (tidak tampil publik)</option><option value="PUBLISHED">Terbit (tampil publik)</option></select></label>
          <label className={labelClass}>Judul *<input required maxLength={160} className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Judul dokumentasi"/></label>
          <label className={labelClass}>Urutan Tampil<input required type="number" min={0} max={999999} step={1} className={inputClass} value={form.display_order} onChange={e => setForm({ ...form, display_order: e.target.value })}/></label>
          <label className={`${labelClass} sm:col-span-2`}>URL Foto / Video (HTTPS) *<input required type="url" className={inputClass} value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} placeholder="https://..."/><span className="block text-xs font-normal text-slate-500">Gunakan link publik. Untuk video: YouTube, Google Drive (akses diizinkan), atau file video langsung.</span></label>
          <label className={`${labelClass} sm:col-span-2`}>URL Thumbnail (opsional)<input type="url" className={inputClass} value={form.thumbnail_url} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://.../thumbnail.jpg"/></label>
          <label className={`${labelClass} sm:col-span-2`}>Caption / Deskripsi<textarea rows={3} maxLength={2000} className={inputClass} value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })}/></label>
          <label className={labelClass}>ID Album (opsional)<input maxLength={100} className={inputClass} value={form.album_id} onChange={e => setForm({ ...form, album_id: e.target.value })}/></label>
          <div className="flex items-end gap-2"><button type="submit" disabled={working} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{working ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} Simpan ke GAS</button></div>
        </form>
      </section>}

      <section className="space-y-3" aria-label="Daftar media">
        <div className="flex flex-wrap gap-3"><div className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"/><input aria-label="Cari media" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari judul, caption, atau URL..." className={`${inputClass} pl-9`}/></div><select aria-label="Filter jenis media" className={`${inputClass} w-auto`} value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="ALL">Semua</option><option value="PHOTO">Foto</option><option value="VIDEO">Video</option></select></div>
        <p className="text-xs text-slate-500">{loading ? 'Memuat dari GAS...' : `${visible.length} ditampilkan dari ${items.length} data yang dimuat (${total} total di GAS).`}{total > items.length && ' Daftar masih terbatas 100 record pertama; pagination menyusul.'}</p>
        {loading ? <div role="status" className="flex justify-center p-12 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Memuat galeri...</div> : items.length === 0 && !error ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">Belum ada media di GAS. Klik Tambah Media untuk memulai.</div> : visible.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Tidak ada media yang cocok dengan pencarian.</div> :
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex aspect-video items-center justify-center bg-slate-100 dark:bg-slate-800">{item.thumbnail_url || (item.type === 'PHOTO' ? item.source_url : '') ? <img loading="lazy" className="h-full w-full object-cover" alt={`Thumbnail ${item.title}`} src={item.thumbnail_url || item.source_url}/> : item.type === 'VIDEO' ? <Film className="h-10 w-10 text-slate-400"/> : <ImageIcon className="h-10 w-10 text-slate-400"/>}</div>
            <div className="space-y-3 p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.type === 'PHOTO' ? 'Foto' : 'Video'}</span><span className={`rounded-lg px-2 py-1 text-xs font-semibold ${item.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : item.status === 'ARCHIVED' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>{item.status === 'PUBLISHED' ? 'Terbit' : item.status === 'ARCHIVED' ? 'Arsip' : 'Draft'}</span></div>
              <h3 className="line-clamp-2 font-semibold text-slate-900 dark:text-white">{item.title}</h3>{item.caption && <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{item.caption}</p>}
              <div className="flex flex-wrap gap-2"><button type="button" onClick={() => edit(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600"><Pencil className="h-3.5 w-3.5"/> Edit</button><a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600"><ExternalLink className="h-3.5 w-3.5"/> Buka URL</a>{item.status !== 'ARCHIVED' && <button type="button" onClick={() => setPendingArchive(item)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:text-red-300"><Archive className="h-3.5 w-3.5"/> Arsip</button>}</div>
            </div>
          </article>)}</div>}
      </section>

      {pendingArchive && <div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-label="Konfirmasi arsip media" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"><h2 className="text-lg font-bold dark:text-white">Arsipkan media?</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">“{pendingArchive.title}” tidak akan tampil lagi di Galeri Publik. Data tetap tersimpan di GAS.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPendingArchive(null)} disabled={working} className="rounded-xl border px-4 py-2 text-sm">Batal</button><button type="button" onClick={() => void archive()} disabled={working} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{working ? 'Memproses...' : 'Ya, Arsipkan'}</button></div></section></div>}
    </main>
  );
};

export default AdminPublicGalleryManager;
