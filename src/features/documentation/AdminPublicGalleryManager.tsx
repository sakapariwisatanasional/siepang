/** SiEpang — Galeri Publik Admin (URL-first, GAS as source of truth)
 * Replace: src/features/documentation/AdminPublicGalleryManager.tsx
 * File uploads require a separate Drive upload endpoint; this view registers shared URLs.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Archive, CheckCircle2, ExternalLink, Film, Image as ImageIcon, Link2, Loader2, Pencil, Plus, RefreshCw, Search, X, PlayCircle, Cloud, ClipboardPaste, Save, ShieldCheck } from 'lucide-react';
import { documentationService, type GalleryUrlRecord } from '../../services/documentationService';

type FormValue = { id: string; type: 'PHOTO'|'VIDEO'; title: string; caption: string; source_url: string; thumbnail_url: string; album_id: string; display_order: string; status: 'DRAFT'|'PUBLISHED' };
type Kind = 'ALL'|'PHOTO'|'VIDEO';
const blank = (type: 'PHOTO'|'VIDEO'='PHOTO'): FormValue => ({ id:'',type,title:'',caption:'',source_url:'',thumbnail_url:'',album_id:'',display_order:'0',status:'DRAFT' });
const https = (value: string) => { try { const u=new URL(value); return u.protocol==='https:' && !!u.hostname && !u.username && !u.password; } catch {return false;} };
function info(url: string) {
  if (!https(url)) return {provider:'', image:'', embed:'', direct:false};
  const u=new URL(url), host=u.hostname.toLowerCase(), path=u.pathname;
  const yt = host==='youtu.be' ? path.split('/')[1] : host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com') ? (u.searchParams.get('v') || path.match(/\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] || '') : '';
  if (yt && /^[\w-]{11}$/.test(yt)) return {provider:'YouTube',image:`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,embed:`https://www.youtube-nocookie.com/embed/${yt}`,direct:false};
  const driveId=(host==='drive.google.com' || host==='docs.google.com') ? (path.match(/\/file\/d\/([\w-]+)/)?.[1] || u.searchParams.get('id') || '') : '';
  if (driveId && /^[\w-]+$/.test(driveId)) return {provider:'Google Drive',image:`https://drive.google.com/thumbnail?id=${driveId}&sz=w600`,embed:`https://drive.google.com/file/d/${driveId}/preview`,direct:false};
  if (host==='instagram.com' || host.endsWith('.instagram.com')) return {provider:'Instagram',image:'',embed:'',direct:false};
  if (host==='tiktok.com' || host.endsWith('.tiktok.com')) return {provider:'TikTok',image:'',embed:'',direct:false};
  if (host==='facebook.com' || host.endsWith('.facebook.com') || host==='fb.watch') return {provider:'Facebook',image:'',embed:'',direct:false};
  const direct=/\.(?:mp4|webm|ogg)(?:$|\?)/i.test(url);
  return {provider:direct?'Video langsung':'Tautan HTTPS',image:'',embed:'',direct};
}
const field='w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const text='text-slate-900 dark:text-white';
const muted='text-slate-600 dark:text-slate-300';
const btn='inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800';

export const AdminPublicGalleryManager: React.FC = () => {
  const [items,setItems]=useState<GalleryUrlRecord[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [verifyWarning,setVerifyWarning]=useState('');
  const [filter,setFilter]=useState<Kind>('ALL');
  const [query,setQuery]=useState('');
  const [form,setForm]=useState<FormValue|null>(null);
  const [archiveItem,setArchiveItem]=useState<GalleryUrlRecord|null>(null);
  const [preview,setPreview]=useState<GalleryUrlRecord|null>(null);
  const [broken,setBroken]=useState<Record<string,boolean>>({});
  const reload=useCallback(async()=>{
    setLoading(true);setError('');
    try { const page=await documentationService.listGalleryForAdmin(); setItems(page.items);setTotal(page.total); }
    catch(e){setError(e instanceof Error?e.message:'Gagal mengambil data Galeri dari GAS.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void reload();},[reload]);
  const counts=useMemo(()=>({photo:items.filter(x=>x.type==='PHOTO').length,video:items.filter(x=>x.type==='VIDEO').length,published:items.filter(x=>x.status==='PUBLISHED').length,draft:items.filter(x=>x.status==='DRAFT').length}),[items]);
  const visible=useMemo(()=>items.filter(x=>(filter==='ALL'||x.type===filter)&&[x.title,x.caption,x.source_url].some(v=>String(v||'').toLowerCase().includes(query.trim().toLowerCase()))),[items,filter,query]);
  const openForm=(item?:GalleryUrlRecord,type:'PHOTO'|'VIDEO'='PHOTO')=>{
    setError('');setNotice('');setVerifyWarning('');
    setForm(item?{id:item.id,type:item.type,title:item.title||'',caption:item.caption||'',source_url:item.source_url||'',thumbnail_url:item.thumbnail_url||'',album_id:item.album_id||'',display_order:String(item.display_order??0),status:item.status==='PUBLISHED'?'PUBLISHED':'DRAFT'}:blank(type));
  };
  const update=(patch:Partial<FormValue>)=>setForm(p=>p?{...p,...patch}:p);
  /** The server response alone is not treated as proof of persistence. */
  const matchesSaved = (item: GalleryUrlRecord, draft: FormValue, order: number) =>
    item.type === draft.type &&
    item.title === draft.title.trim() &&
    item.caption === draft.caption.trim() &&
    item.source_url === draft.source_url.trim() &&
    (item.thumbnail_url || '') === draft.thumbnail_url.trim() &&
    (item.album_id || '') === draft.album_id.trim() &&
    Number(item.display_order) === order &&
    item.status === draft.status;

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault(); if(!form||saving)return;
    if(!form.title.trim()){setError('Judul media harus diisi.');return;}
    if(!https(form.source_url.trim())){setError('Tempel URL HTTPS yang valid dan dapat diakses publik.');return;}
    if(form.thumbnail_url.trim()&&!https(form.thumbnail_url.trim())){setError('URL thumbnail harus menggunakan HTTPS.');return;}
    const order=Number(form.display_order);
    if(!Number.isInteger(order)||order<0||order>999999){setError('Urutan tampil harus bilangan bulat 0–999999.');return;}
    const draft={...form};
    setSaving(true);setError('');setNotice('');setVerifyWarning('');
    let submitted=false;
    try{
      // Capture the server list before a CREATE to distinguish a new row from old duplicates.
      const before=await documentationService.listGalleryForAdmin();
      const oldIds=new Set(before.items.map(m=>m.id));
      await documentationService.saveGalleryUrl({id:draft.id,type:draft.type,title:draft.title.trim(),caption:draft.caption.trim(),source_url:draft.source_url.trim(),thumbnail_url:draft.thumbnail_url.trim(),album_id:draft.album_id.trim(),display_order:order,status:draft.status});
      submitted=true;
      const after=await documentationService.listGalleryForAdmin();
      setItems(after.items);setTotal(after.total);
      const verified=after.items.find(item =>
        (draft.id ? item.id===draft.id : !oldIds.has(item.id)) && matchesSaved(item,draft,order)
      );
      if(verified){
        setForm(null);
        setNotice(`Tersimpan dan terverifikasi dari GAS/Spreadsheet. ID media: ${verified.id}. Status: ${verified.status}.`);
      } else {
        // Do not automatically repeat CREATE: a lost read/limited page may hide a successful write.
        setVerifyWarning('Permintaan Simpan telah diterima, tetapi record belum dapat diverifikasi pada daftar GAS (maksimum 100 media per pembacaan). Jangan klik Simpan lagi sebelum memeriksa sheet PublicGalleryMedia atau menyegarkan daftar agar tidak membuat duplikat.');
      }
    }catch(e){
      const message=e instanceof Error?e.message:'Gagal menghubungi GAS.';
      if(submitted){
        setVerifyWarning(`Permintaan Simpan sudah dikirim, tetapi verifikasi baca ulang gagal: ${message}. Periksa sheet PublicGalleryMedia sebelum mencoba menyimpan lagi agar tidak terjadi duplikasi.`);
      }else{
        setError(`Penyimpanan belum terkonfirmasi: ${message}. Jika koneksi terputus, periksa Spreadsheet sebelum mengulangi.`);
      }
    }finally{setSaving(false);}
  };
  const archive=async()=>{
    if(!archiveItem||saving)return;
    const target=archiveItem;
    setSaving(true);setError('');setNotice('');setVerifyWarning('');
    try{
      await documentationService.archiveGalleryUrl(target.id);
      const after=await documentationService.listGalleryForAdmin();
      setItems(after.items);setTotal(after.total);
      const saved=after.items.find(m=>m.id===target.id);
      if(saved?.status==='ARCHIVED'){
        setArchiveItem(null);
        setNotice(`Arsip berhasil diverifikasi dari GAS/Spreadsheet. ID media: ${target.id}.`);
      }else{
        setVerifyWarning(`Permintaan arsip dikirim tetapi status media ${target.id} belum terverifikasi dalam hasil baca ulang. Periksa Spreadsheet sebelum mengulangi.`);
      }
    }catch(e){setVerifyWarning(`Status arsip belum dapat dipastikan: ${e instanceof Error?e.message:'Koneksi GAS gagal'}. Periksa Spreadsheet sebelum mencoba kembali.`);}
    finally{setSaving(false);}
  };
  const thumb=(m:GalleryUrlRecord)=>m.thumbnail_url||info(m.source_url).image||(m.type==='PHOTO'?m.source_url:'');
  const activeInfo=info(form?.source_url||'');
  const formThumb=form?.thumbnail_url||activeInfo.image||(form?.type==='PHOTO'?form?.source_url:'');
  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6" aria-label="Manajemen Galeri Publik">
    <header className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-amber-50 p-5 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-1"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Pusat Dokumentasi SiEpang</p><h1 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Manajemen Galeri Foto & Video</h1><p className={`max-w-2xl text-sm ${muted}`}>Masukkan tautan Google Drive, YouTube, atau media sosial, atur pratinjau, lalu publikasikan tanpa mengubah source aplikasi.</p></div><div className="flex flex-wrap gap-2"><button type="button" className={btn} onClick={()=>void reload()} disabled={loading||saving}><RefreshCw size={16}/> Segarkan</button><button type="button" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800" onClick={()=>openForm()}><Plus size={18}/> Tambah Media</button></div></div>
    </header>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Ringkasan galeri">
      {([{label:'Foto',value:counts.photo,icon:ImageIcon},{label:'Video',value:counts.video,icon:Film},{label:'Dipublikasikan',value:counts.published,icon:CheckCircle2},{label:'Draft',value:counts.draft,icon:ClipboardPaste}] as const).map(c=><div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><c.icon className="mb-2 text-emerald-600" size={19}/><div className={`text-2xl font-bold ${text}`}>{loading?'—':c.value}</div><p className={`text-xs ${muted}`}>{c.label} dalam daftar termuat</p></div>)}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5" aria-label="Aksi cepat">
      <h2 className={`mb-3 font-bold ${text}`}>Tambahkan dokumentasi</h2><div className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={()=>openForm(undefined,'PHOTO')} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left hover:bg-emerald-100 dark:border-slate-700 dark:bg-slate-800"><ImageIcon className="text-emerald-700"/><span><strong className={`block text-sm ${text}`}>Tambah Foto</strong><small className={muted}>Link Google Drive atau gambar</small></span></button>
        <button type="button" onClick={()=>openForm(undefined,'VIDEO')} className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-left hover:bg-sky-100 dark:border-slate-700 dark:bg-slate-800"><Film className="text-sky-700"/><span><strong className={`block text-sm ${text}`}>Tambah Video</strong><small className={muted}>YouTube, Drive, atau MP4</small></span></button>
        <a className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left hover:bg-amber-100 dark:border-slate-700 dark:bg-slate-800" href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener noreferrer"><Cloud className="text-amber-700"/><span><strong className={`block text-sm ${text}`}>Buka Google Drive <ExternalLink className="inline" size={12}/></strong><small className={muted}>Unggah file di Drive, lalu salin link</small></span></a>
      </div><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Catatan: fitur ini menyimpan tautan dan metadata ke GAS/Spreadsheet. Unggah file langsung dari SiEpang membutuhkan endpoint Google Drive tersendiri.</p>
    </section>
    {error&&<div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="shrink-0" size={18}/><span>{error}</span></div>}
    {verifyWarning&&<div role="alert" className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"><AlertCircle className="shrink-0" size={18}/><span>{verifyWarning}</span></div>}
    {notice&&<div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="shrink-0" size={18}/><span>{notice}</span></div>}
    <section className="space-y-3" aria-label="Daftar media GAS"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className={`text-lg font-bold ${text}`}>Koleksi Galeri</h2><div className="flex flex-wrap gap-2"><div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400"/><input aria-label="Cari media" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari judul atau URL..." className={`${field} pl-9`}/></div><select aria-label="Filter jenis" className={field} value={filter} onChange={e=>setFilter(e.target.value as Kind)}><option value="ALL">Semua</option><option value="PHOTO">Foto</option><option value="VIDEO">Video</option></select></div></div>
      <p className="text-xs text-slate-500">{loading?'Memuat dari GAS...':`${visible.length} ditampilkan dari ${items.length} data yang dimuat (${total} total di server).`}{total>items.length?' Layanan saat ini hanya memuat maksimal 100 record pertama.':''}</p>
      {loading?<div className="flex justify-center gap-2 rounded-xl border p-10 text-slate-500"><Loader2 className="animate-spin"/> Memuat media...</div>:items.length===0&&!error?<div className="rounded-2xl border border-dashed p-10 text-center"><ImageIcon className="mx-auto mb-2 text-slate-400"/><p className={muted}>Belum ada media tersimpan. Tambahkan foto atau video dari tombol di atas.</p></div>:visible.length===0?<p className={`rounded-xl border p-6 text-center ${muted}`}>Tidak ada media yang cocok.</p>:<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(m=><article key={m.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="relative flex aspect-video items-center justify-center bg-slate-100 dark:bg-slate-800">{thumb(m)&&!broken[m.id]?<img loading="lazy" src={thumb(m)} alt={`Thumbnail ${m.title}`} className="h-full w-full object-cover" onError={()=>setBroken(p=>({...p,[m.id]:true}))}/>:m.type==='VIDEO'?<Film className="text-slate-400" size={36}/>:<ImageIcon className="text-slate-400" size={36}/>}<span className="absolute left-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-xs font-semibold text-white">{m.type==='PHOTO'?'Foto':'Video'}</span>{m.type==='VIDEO'&&<button type="button" aria-label={`Pratinjau ${m.title}`} onClick={()=>setPreview(m)} className="absolute inset-0 flex items-center justify-center"><PlayCircle className="text-white drop-shadow-lg" size={46}/></button>}</div><div className="space-y-3 p-4"><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${m.status==='PUBLISHED'?'bg-emerald-100 text-emerald-800':m.status==='ARCHIVED'?'bg-slate-200 text-slate-800':'bg-amber-100 text-amber-900'}`}>{m.status==='PUBLISHED'?'Terbit':m.status==='ARCHIVED'?'Arsip':'Draft'}</span><span className="text-xs text-slate-500">{info(m.source_url).provider||'Media'}</span></div><h3 className={`line-clamp-2 font-semibold ${text}`}>{m.title}</h3>{m.caption&&<p className={`line-clamp-2 text-sm ${muted}`}>{m.caption}</p>}<div className="flex flex-wrap gap-2"><button type="button" className={btn} onClick={()=>openForm(m)}><Pencil size={14}/> Edit</button><button type="button" className={btn} onClick={()=>setPreview(m)}><PlayCircle size={14}/> Lihat</button><a className={btn} href={m.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> URL</a>{m.status!=='ARCHIVED'&&<button type="button" className={`${btn} text-rose-700`} onClick={()=>setArchiveItem(m)}><Archive size={14}/> Arsip</button>}</div></div></article>)}</div>}
    </section>
    {form&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" role="presentation"><section role="dialog" aria-modal="true" aria-label={form.id?'Edit media':'Tambah media'} className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-emerald-700">{form.id?'UBAH DOKUMENTASI':'DOKUMENTASI BARU'}</p><h2 className={`text-xl font-bold ${text}`}>{form.id?'Edit Foto / Video':'Tambahkan Foto atau Video'}</h2><p className={`text-sm ${muted}`}>Tempel link publik, cek pratinjau, lalu simpan.</p></div><button className={btn} type="button" onClick={()=>setForm(null)} disabled={saving} aria-label="Tutup"><X size={18}/></button></div><form onSubmit={e=>void submit(e)} className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]"><div className="space-y-4"><div><p className={`mb-2 text-sm font-semibold ${text}`}>1. Jenis dokumentasi</p><div className="grid grid-cols-2 gap-2"><button type="button" disabled={saving} onClick={()=>update({type:'PHOTO'})} className={`rounded-xl border p-3 text-sm font-semibold ${form.type==='PHOTO'?'border-emerald-600 bg-emerald-50 text-emerald-900':'border-slate-200 dark:border-slate-600 dark:text-white'}`}><ImageIcon className="mb-1 inline" size={17}/> Foto</button><button type="button" disabled={saving} onClick={()=>update({type:'VIDEO'})} className={`rounded-xl border p-3 text-sm font-semibold ${form.type==='VIDEO'?'border-emerald-600 bg-emerald-50 text-emerald-900':'border-slate-200 dark:border-slate-600 dark:text-white'}`}><Film className="mb-1 inline" size={17}/> Video</button></div></div><label className={`block text-sm font-semibold ${text}`}>2. Link {form.type==='PHOTO'?'foto':'video'} *<div className="relative mt-2"><Link2 className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18}/><input required type="url" className={`${field} pl-10`} value={form.source_url} onChange={e=>update({source_url:e.target.value})} placeholder="https://drive.google.com/... atau https://youtube.com/..."/></div></label><p className={`text-xs ${muted}`}>{activeInfo.provider?`Terdeteksi: ${activeInfo.provider}. `:''}Pastikan akses file Google Drive adalah “Siapa saja yang memiliki link — Pelihat”. Link sosial media dapat dibuka di platform asal bila pemutar tertanam tidak didukung.</p><label className={`block text-sm font-semibold ${text}`}>3. Judul dokumentasi *<input required maxLength={160} className={`${field} mt-2`} value={form.title} onChange={e=>update({title:e.target.value})} placeholder="Contoh: Upacara Pembukaan Perkemahan"/></label><label className={`block text-sm font-semibold ${text}`}>Caption / Deskripsi<textarea className={`${field} mt-2`} rows={3} maxLength={2000} value={form.caption} onChange={e=>update({caption:e.target.value})} placeholder="Ceritakan momen kegiatan..."/></label><details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary className={`cursor-pointer text-sm font-semibold ${text}`}>Pengaturan tambahan (opsional)</summary><div className="mt-3 space-y-3"><label className={`block text-sm ${text}`}>URL thumbnail<input className={`${field} mt-1`} type="url" value={form.thumbnail_url} onChange={e=>update({thumbnail_url:e.target.value})} placeholder="https://.../thumbnail.jpg"/></label><label className={`block text-sm ${text}`}>ID Album<input className={`${field} mt-1`} value={form.album_id} onChange={e=>update({album_id:e.target.value})}/></label><label className={`block text-sm ${text}`}>Urutan tampil<input className={`${field} mt-1`} type="number" min={0} max={999999} step={1} value={form.display_order} onChange={e=>update({display_order:e.target.value})}/></label></div></details></div><div className="space-y-4"><div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"><div className="flex aspect-video items-center justify-center bg-slate-100 dark:bg-slate-800">{https(formThumb)&&form.type==='PHOTO'?<img src={formThumb} alt="Pratinjau foto" className="h-full w-full object-contain"/>:https(formThumb)&&form.type==='VIDEO'?<img src={formThumb} alt="Pratinjau thumbnail video" className="h-full w-full object-contain"/>:<div className="text-center text-slate-400">{form.type==='VIDEO'?<Film size={42} className="mx-auto"/>:<ImageIcon size={42} className="mx-auto"/>}<p className="mt-2 text-xs">Pratinjau setelah URL diisi</p></div>}</div><p className={`p-2 text-xs ${muted}`}>Thumbnail Drive dan media sosial bisa memerlukan izin publik atau URL thumbnail tersendiri.</p></div>{https(form.source_url)&&<a href={form.source_url} target="_blank" rel="noopener noreferrer" className={btn}><ExternalLink size={15}/> Uji buka tautan</a>}<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-slate-700 dark:bg-slate-800"><p className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-white"><ShieldCheck size={17}/> 4. Status publikasi</p><label className={`block text-sm ${text}`}>Tampilkan di Galeri Publik<select className={`${field} mt-2`} value={form.status} onChange={e=>update({status:e.target.value as FormValue['status']})}><option value="DRAFT">Simpan sebagai Draft</option><option value="PUBLISHED">Terbitkan ke Publik</option></select></label></div><button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{saving?<Loader2 className="animate-spin" size={18}/>:<Save size={18}/>} {saving?'Menyimpan dan memverifikasi...':'Simpan & Verifikasi'}</button><p className={`text-xs ${muted}`}>Status berhasil hanya diberikan setelah record cocok saat dibaca ulang melalui GAS. Jika verifikasi tidak pasti, cek sheet PublicGalleryMedia sebelum mengulangi.</p></div></form></section></div>}
    {archiveItem&&<div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-label="Konfirmasi arsip" className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-slate-900"><h2 className={`text-lg font-bold ${text}`}>Arsipkan media?</h2><p className={`my-3 text-sm ${muted}`}>“{archiveItem.title}” tidak lagi ditampilkan di publik. Metadata tetap tercatat di Spreadsheet.</p><div className="flex justify-end gap-2"><button className={btn} type="button" disabled={saving} onClick={()=>setArchiveItem(null)}>Batal</button><button type="button" className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={saving} onClick={()=>void archive()}>{saving?'Memproses...':'Arsipkan'}</button></div></section></div>}
    {preview&&<div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/80 p-3" role="presentation"><section role="dialog" aria-modal="true" aria-label="Pratinjau dokumentasi" className="w-full max-w-4xl rounded-2xl bg-white p-3 dark:bg-slate-900"><div className="mb-3 flex items-center justify-between"><strong className={`line-clamp-1 ${text}`}>{preview.title}</strong><button className={btn} type="button" onClick={()=>setPreview(null)} aria-label="Tutup pratinjau"><X size={18}/></button></div><div className="flex min-h-56 items-center justify-center overflow-hidden rounded-xl bg-black">{preview.type==='PHOTO'?<img src={preview.source_url} alt={preview.title} className="max-h-[70vh] max-w-full object-contain"/>:info(preview.source_url).embed?<iframe title={preview.title} src={info(preview.source_url).embed} className="aspect-video w-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:info(preview.source_url).direct?<video src={preview.source_url} controls className="max-h-[70vh] w-full"/>:<div className="p-8 text-center text-white"><p>Pemutaran tertanam tidak tersedia untuk sumber ini.</p><a href={preview.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 underline"><ExternalLink size={16}/> Buka di sumber asli</a></div>}</div></section></div>}
  </main>;
};
export default AdminPublicGalleryManager;
