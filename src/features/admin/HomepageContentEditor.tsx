import React,{useEffect,useState} from 'react';
import { homepageContentService, HomepageContent, HomepageSnapshot } from '../../services/homepageContentService';

interface Props { onClose:()=>void; onPublished:()=>void; }
const empty:HomepageContent={title:'Selamat datang di SiEpang',description:'Jelajahi kegiatan, informasi resmi, dan layanan perkemahan dengan mudah.',ctaLabel:'Lihat Jadwal'};
export const HomepageContentEditor:React.FC<Props>=({onClose,onPublished})=>{
  const [content,setContent]=useState<HomepageContent>(empty);
  const [snapshot,setSnapshot]=useState<HomepageSnapshot|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{let active=true;homepageContentService.getAdmin().then(data=>{if(active){setSnapshot(data);setContent(data.draft||data.published||empty);}}).catch(e=>{if(active)setError(e.message||'Gagal mengambil pengaturan.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const submit=async(publish:boolean)=>{
    setSaving(true);setError('');setNotice('');
    try{const next=await homepageContentService.save(content,publish);setSnapshot(next);setNotice(publish?'Konten berhasil diterbitkan dan diverifikasi dari GAS.':'Draft tersimpan dan diverifikasi dari GAS.');if(publish)onPublished();}
    catch(e:any){setError(e?.message||'Penyimpanan gagal.');}finally{setSaving(false);}
  };
  const field='w-full min-h-12 rounded-xl border border-slate-400 bg-white p-3 text-base text-slate-950 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-500 dark:bg-slate-800 dark:text-white';
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Editor Beranda Admin">
    <div className="w-full max-w-xl max-h-[94vh] overflow-y-auto rounded-3xl bg-white p-5 text-slate-900 shadow-2xl dark:bg-slate-950 dark:text-white space-y-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Editor Beranda Admin</h2><p className="text-sm text-slate-600 dark:text-slate-300">Draft tidak langsung tampil di Beranda publik.</p></div><button type="button" onClick={onClose} className="min-h-11 rounded-xl border px-4">Tutup</button></div>
      {loading?<p role="status">Memuat konfigurasi dari GAS…</p>:<>
        <label className="block space-y-1"><span className="font-semibold">Judul Beranda</span><input className={field} maxLength={120} value={content.title} onChange={e=>setContent({...content,title:e.target.value})}/></label>
        <label className="block space-y-1"><span className="font-semibold">Deskripsi</span><textarea className={field} rows={3} maxLength={500} value={content.description} onChange={e=>setContent({...content,description:e.target.value})}/></label>
        <label className="block space-y-1"><span className="font-semibold">Teks tombol</span><input className={field} maxLength={45} value={content.ctaLabel} onChange={e=>setContent({...content,ctaLabel:e.target.value})}/></label>
        <div className="rounded-2xl bg-[#172E2B] p-5 text-white space-y-2"><p className="text-xs text-amber-300">PRATINJAU</p><h3 className="text-xl font-bold">{content.title||'Judul'}</h3><p className="text-sm">{content.description}</p><span className="inline-block rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950">{content.ctaLabel||'Tombol'}</span></div>
        <p className="text-xs text-slate-600 dark:text-slate-300">Status: {snapshot?.published?'Ada versi diterbitkan':'Belum diterbitkan'}</p>
        {error&&<p role="alert" className="rounded-xl border border-rose-500 bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950 dark:text-rose-100">{error}</p>}
        {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{notice}</p>}
        <div className="grid grid-cols-2 gap-3"><button disabled={saving} onClick={()=>void submit(false)} className="min-h-12 rounded-xl border border-slate-400 font-semibold disabled:opacity-50">Simpan Draft</button><button disabled={saving} onClick={()=>void submit(true)} className="min-h-12 rounded-xl bg-amber-400 text-slate-950 font-bold disabled:opacity-50">{saving?'Menyimpan…':'Publikasikan'}</button></div>
      </>}
    </div>
  </div>;
};
