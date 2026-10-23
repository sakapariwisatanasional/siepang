import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Users, UserRound, RefreshCw, ShieldCheck, ImageOff } from 'lucide-react';
import { gudepRegistrationService, ContingentRecord, GudepRecord, GudepDetail } from '../../services/gudepRegistrationService';
import { resolveGoogleDriveImageUrl } from '../../utils/googleDriveImage';

type DirectoryContingent = ContingentRecord & { name: string; id: string };
type DetailBundle = { gudep: GudepRecord; detail: GudepDetail };

const clean = (value: unknown) => String(value ?? '').trim();
const statusLabel = (value: unknown) => {
  const s = clean(value).toUpperCase();
  if (s === 'VERIFIED' || s === 'APPROVED') return 'Disetujui';
  if (s === 'REJECTED') return 'Ditolak';
  if (s === 'REVISION' || s === 'NEEDS_REVISION') return 'Perlu revisi';
  return 'Menunggu verifikasi';
};
const statusClass = (value: unknown) => {
  const s = clean(value).toUpperCase();
  if (s === 'VERIFIED' || s === 'APPROVED') return 'bg-emerald-50 text-emerald-700';
  if (s === 'REJECTED') return 'bg-rose-50 text-rose-700';
  if (s === 'REVISION' || s === 'NEEDS_REVISION') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
};
const photoUrl = (p: NonNullable<GudepDetail['participants']>[number]) => resolveGoogleDriveImageUrl(
  p.profile_photo_url || (p as any).photoUrl || (p as any).photo_url || (p as any).avatar_url || '',
  p.profile_photo_file_id || (p as any).photo_file_id || (p as any).profilePhotoFileId || '',
  320,
);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';

export const ContingentReguDirectory: React.FC = () => {
  const [contingents, setContingents] = useState<DirectoryContingent[]>([]);
  const [gudep, setGudep] = useState<GudepRecord[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<DirectoryContingent | null>(null);
  const [bundles, setBundles] = useState<DetailBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await gudepRegistrationService.list();
      const list = (result.contingents || []).map(c => ({ ...c, id: clean(c.id), name: clean(c.name) }))
        .filter(c => c.id && c.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setContingents(list);
      setGudep(result.gudep || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data kontingen.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  const visibleContingents = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('id');
    if (!q) return contingents;
    return contingents.filter(c => [c.name, c.region, c.leader_name].some(v => clean(v).toLocaleLowerCase('id').includes(q)));
  }, [contingents, query]);

  const openContingent = async (contingent: DirectoryContingent) => {
    setSelected(contingent); setBundles([]); setError(''); setDetailLoading(true);
    try {
      // Join only by canonical IDs. Never guess a relation from similar names.
      const associated = gudep.filter(g => clean(g.contingent_id || g.gudep_id) === contingent.id);
      const loaded = await Promise.all(associated.map(async g => ({ gudep: g, detail: await gudepRegistrationService.detail(g.gudep_id) })));
      setBundles(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat susunan regu dan peserta.');
    } finally { setDetailLoading(false); }
  };

  const renderRegu = (gender: 'PUTRA' | 'PUTRI') => {
    const rows = bundles.flatMap(bundle => bundle.detail.regu
      .filter(r => clean(r.gender).toUpperCase() === gender)
      .map(regu => ({ bundle, regu, members: (bundle.detail.participants || []).filter(p => p.regu_id === regu.regu_id) })));
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${gender === 'PUTRA' ? 'bg-sky-50 text-sky-700' : 'bg-pink-50 text-pink-700'}`}><Users className="h-5 w-5" /></span><div><h3 className="font-bold text-slate-900">Regu {gender === 'PUTRA' ? 'Putra' : 'Putri'}</h3><p className="text-xs text-slate-500">{rows.length} regu</p></div></div>
        </div>
        {rows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Belum ada regu {gender === 'PUTRA' ? 'putra' : 'putri'} yang terhubung ke kontingen ini.</div> :
          <div className="space-y-4">{rows.map(({ bundle, regu, members }) => <div key={regu.regu_id} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-slate-900">{regu.regu_name}</h4><p className="mt-0.5 text-xs text-slate-500">{bundle.gudep.gudep_number} · {bundle.gudep.institution_name || bundle.gudep.gudep_name}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(regu.verification_status)}`}>{statusLabel(regu.verification_status)}</span></div>
            <div className="mb-3 text-xs text-slate-500">{members.length} peserta{regu.quota ? ` · Kuota ${regu.quota}` : ''}</div>
            {members.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Belum ada peserta yang ditautkan ke regu ini.</p> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{members.map(member => {
              const url = photoUrl(member);
              return <article key={member.id} className="min-w-0 min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                {url && <img src={url} alt={`Foto ${member.name}`} loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; const fallback = e.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.style.display = 'flex'; }} className="mx-auto mb-2 h-14 w-14 rounded-full border border-slate-200 object-cover sm:h-16 sm:w-16" />}<div style={{ display: url ? 'none' : 'flex' }} className="mx-auto mb-2 h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 ring-1 ring-slate-200 sm:h-16 sm:w-16"><span>{initials(member.name)}</span></div>
                <p className="break-words text-sm font-semibold text-slate-800">{member.name || 'Nama belum tersedia'}</p>
                {member.membership_number && <p className="mt-1 break-all text-[10px] text-slate-500">{member.membership_number}</p>}
              </article>;
            })}</div>}
          </div>)}</div>}
      </section>
    );
  };

  return <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-4 sm:px-5 lg:px-7">
    <header className="rounded-xl border-l-4 border-l-red-600 border-y border-r border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700"><Users className="h-6 w-6" /></div><div><p className="text-xs font-semibold text-red-700">Data & anggota</p><h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Data Kontingen per Regu</h1><p className="mt-1 max-w-2xl text-sm text-slate-600">Pilih kontingen untuk melihat susunan Regu Putra dan Regu Putri beserta foto profil serta nama peserta.</p></div></div><button type="button" onClick={() => { void loadList(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"><RefreshCw className="h-4 w-4"/> Muat ulang</button></div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

    {!selected ? <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold text-slate-900">Pilih Kontingen</h2><p className="text-sm text-slate-500">{contingents.length} kontingen pada event aktif</p></div><label className="relative block w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama kontingen/sekolah..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"/></label></div>
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Memuat data kontingen...</div> : visibleContingents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><ImageOff className="mx-auto mb-2 h-8 w-8 text-slate-400"/><p className="font-semibold text-slate-700">Kontingen tidak ditemukan</p><p className="mt-1 text-sm text-slate-500">Periksa kata kunci atau pastikan data kontingen sudah tersimpan di spreadsheet event aktif.</p></div> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleContingents.map(c => {
        const groups = gudep.filter(g => clean(g.contingent_id || g.gudep_id) === c.id);
        return <button type="button" key={c.id} onClick={() => void openContingent(c)} className="group min-w-0 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-red-300 hover:bg-red-50/30 focus:outline-none focus:ring-2 focus:ring-red-300"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700"><ShieldCheck className="h-5 w-5"/></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(c.verification_status)}`}>{statusLabel(c.verification_status)}</span></div><h3 className="mt-3 break-words font-semibold text-slate-900 group-hover:text-red-800">{c.name}</h3><p className="mt-1 text-sm text-slate-500">{c.region || c.leader_name || 'Kontingen'}</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{groups.length} pangkalan/Gudep</span><span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{Number(c.participant_count || 0)} peserta</span></div><p className="mt-4 border-t border-slate-100 pt-3 text-sm font-semibold text-red-700">Lihat regu dan peserta →</p></button>;
      })}</div>}
    </> : <>
      <button type="button" onClick={() => { setSelected(null); setBundles([]); setError(''); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"><ArrowLeft className="h-4 w-4"/> Kembali ke daftar kontingen</button>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Detail kontingen</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.region || 'Wilayah tidak dicantumkan'}{selected.leader_name ? ` · Pimpinan: ${selected.leader_name}` : ''}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusClass(selected.verification_status)}`}>{statusLabel(selected.verification_status)}</span></div></div>
      {detailLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Memuat regu dan daftar peserta...</div> : bundles.length === 0 ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Belum ada Gudep yang terhubung dengan ID kontingen ini. Data tidak dicocokkan otomatis berdasarkan kemiripan nama agar peserta tidak masuk ke kontingen yang salah.</div> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{renderRegu('PUTRA')}{renderRegu('PUTRI')}</div>}
      <p className="flex items-start gap-2 text-xs text-slate-500"><UserRound className="mt-0.5 h-4 w-4 shrink-0"/>Foto ditampilkan dari sumber profil resmi peserta. Jika foto tidak tersedia atau gagal dimuat, halaman menampilkan inisial nama.</p>
    </>}
  </div>;
};
