import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiTransport } from '../../services/apiTransport';
import { DocumentTemplateStudio } from './DocumentTemplateStudio';
import { CreditCard, Plus, Save, Upload, ArrowLeft, RefreshCw, Trash2, Move, CheckCircle2 } from 'lucide-react';

type Category = 'ID_CARD_PARTICIPANT' | 'ID_CARD_COMMITTEE' | 'ID_CARD_OFFICIAL' | 'ID_CARD_JUDGE' | 'ID_CARD_VISITOR';
type Field = 'participant.full_name' | 'participant.nta' | 'participant.participant_number' | 'participant.photo' | 'participant.contingent' | 'participant.regu' | 'participant.gender' | 'participant.role' | 'participant.qr' | 'event.name' | 'event.location' | 'text.static';
type Element = { id:string; field:Field; x:number; y:number; w:number; h:number; fontSize:number; color:string; align:'left'|'center'|'right'; text:string };
type Template = { id:string;name:string;category:Category;status:'DRAFT'|'ACTIVE';widthMm:number;heightMm:number;backgroundUrl:string;backgroundFileId:string;elements:Element[];version?:number;updatedAt?:string };
const categories: {value:Category;label:string}[] = [
  {value:'ID_CARD_PARTICIPANT',label:'Peserta'}, {value:'ID_CARD_COMMITTEE',label:'Panitia'}, {value:'ID_CARD_OFFICIAL',label:'Pembina / Pejabat'}, {value:'ID_CARD_JUDGE',label:'Juri'}, {value:'ID_CARD_VISITOR',label:'Tamu'}
];
const fields:{value:Field;label:string}[]=[
  {value:'participant.full_name',label:'Nama lengkap'}, {value:'participant.contingent',label:'Pangkalan / Gudep'},
  {value:'participant.regu',label:'Nama regu'}, {value:'participant.nta',label:'NTA / KTA'},
  {value:'participant.participant_number',label:'Nomor peserta'}, {value:'participant.gender',label:'Jenis kelamin'},
  {value:'participant.role',label:'Golongan / jabatan'}, {value:'participant.photo',label:'Foto resmi'},
  {value:'participant.qr',label:'QR peserta'}, {value:'event.name',label:'Nama event'},
  {value:'event.location',label:'Lokasi event'}, {value:'text.static',label:'Teks bebas'}
];
// Preset adalah pilihan UI; ukuran akhir tetap disimpan dalam widthMm/heightMm ke GAS.
const cardSizePresets = [
  { id:'cr80', label:'Kartu PVC CR80 (85,6 × 54 mm)', w:85.6, h:54 },
  { id:'badge54', label:'ID Card 54 × 86 mm', w:54, h:86 },
  { id:'badge70', label:'ID Card 70 × 100 mm', w:70, h:100 },
  { id:'badge90', label:'ID Card 90 × 120 mm', w:90, h:120 },
  { id:'badge100', label:'ID Card 100 × 150 mm', w:100, h:150 },
  { id:'badge125', label:'ID Card 125 × 164 mm', w:125, h:164 },
  { id:'a7', label:'Kertas A7 (74 × 105 mm)', w:74, h:105 },
  { id:'a6', label:'Kertas A6 (105 × 148 mm)', w:105, h:148 },
];
function selectedSizePreset(widthMm:number,heightMm:number):string {
  const found=cardSizePresets.find(p => (Math.abs(p.w-widthMm)<0.01 && Math.abs(p.h-heightMm)<0.01) || (Math.abs(p.h-widthMm)<0.01 && Math.abs(p.w-heightMm)<0.01));
  return found?.id || 'custom';
}
type BackgroundCandidate = { url: string; label: string };
function backgroundCandidates(raw: string): BackgroundCandidate[] {
  const value = raw.trim();
  if (!value) return [];
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return [];
    const host = u.hostname.toLowerCase();
    if (host === 'drive.google.com' || host === 'www.drive.google.com' || host === 'drive.usercontent.google.com') {
      const fileId = u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1] || u.searchParams.get('id') || u.pathname.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1];
      if (fileId) return [
        {url:`https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`,label:'Google Drive thumbnail'},
        {url:`https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1600`,label:'Google Drive image'},
      ];
    }
    return [{url:value,label:'URL gambar'}];
  } catch { return []; }
}
function fieldLabel(f:Field) {return fields.find(x=>x.value===f)?.label || f;}
function blankTemplate():Template {return {id:'',name:'',category:'ID_CARD_PARTICIPANT',status:'DRAFT',widthMm:54,heightMm:86,backgroundUrl:'',backgroundFileId:'',elements:[]};}
function newElement(field:Field):Element {let image=field==='participant.photo'||field==='participant.qr';return {id:'el_'+(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'_'+Math.random()),field,x:20,y:25,w:image?40:60,h:image?28:9,fontSize:13,color:'#153B30',align:'center',text:''};}
export const IdCardDesigner:React.FC=()=>{
  const [showLegacy,setShowLegacy]=useState(false),[templates,setTemplates]=useState<Template[]>([]),[editing,setEditing]=useState<Template|null>(null);
  const [selectedId,setSelectedId]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [selectedField,setSelectedField]=useState<Field>('participant.full_name');const [previewMode,setPreviewMode]=useState(false);
  const [imageCandidateIndex,setImageCandidateIndex]=useState(0),[backgroundError,setBackgroundError]=useState(''),[backgroundLoaded,setBackgroundLoaded]=useState(false);
  const [drag,setDrag]=useState<{id:string;offsetX:number;offsetY:number}|null>(null),canvasRef=useRef<HTMLDivElement>(null),fileRef=useRef<HTMLInputElement>(null);
  const load=useCallback(async()=>{setLoading(true);setError('');try{const r=await apiTransport.send<Template[]>('idcard.templates.list',{}, {timeoutMs:30000});if(!r.ok)throw new Error(r.error?.message||'Gagal membaca template dari GAS.');setTemplates(Array.isArray(r.data)?r.data:[]);}catch(e:any){setError(e.message||String(e));}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  const update=(patch:Partial<Template>)=>setEditing(prev=>prev?{...prev,...patch}:prev);
  const updateElement=(id:string,patch:Partial<Element>)=>setEditing(prev=>prev?{...prev,elements:prev.elements.map(el=>el.id===id?{...el,...patch}:el)}:prev);
  const selected=editing?.elements.find(e=>e.id===selectedId);
  const candidates=backgroundCandidates(editing?.backgroundUrl||'');
  const candidate=candidates[imageCandidateIndex];
  useEffect(()=>{setImageCandidateIndex(0);setBackgroundError('');setBackgroundLoaded(false);},[editing?.backgroundUrl]);
  const onBackgroundError=()=>{if(imageCandidateIndex+1<candidates.length){setImageCandidateIndex(i=>i+1);setBackgroundLoaded(false);}else{setBackgroundError('Gambar latar tidak dapat ditampilkan. Periksa izin akses Google Drive (Siapa saja yang memiliki link → Pelihat), atau gunakan tautan HTTPS langsung ke gambar PNG/JPG/WebP.');setBackgroundLoaded(false);}};
  const save=async(status:'DRAFT'|'ACTIVE')=>{
    if(!editing||busy)return;
    if(!editing.name.trim()){setError('Nama template wajib diisi.');return;}
    setBusy(true);setError('');setNotice('');
    try {const r=await apiTransport.send<Template>('idcard.templates.save',{template:{...editing,status}},{timeoutMs:45000});if(!r.ok||!r.data?.id)throw new Error(r.error?.message||'GAS tidak mengonfirmasi penyimpanan.');
      const read=await apiTransport.send<Template[]>('idcard.templates.list',{}, {timeoutMs:30000});if(!read.ok||!Array.isArray(read.data)||!read.data.some(x=>x.id===r.data!.id))throw new Error('Penyimpanan belum dapat diverifikasi dari GAS; jangan ulangi tanpa memeriksa data.');
      setTemplates(read.data);setEditing(read.data.find(x=>x.id===r.data!.id)!);setNotice('Template tersimpan dan berhasil dibaca ulang dari GAS.');
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(false);}
  };
  const upload=async(file:File)=>{if(!editing||busy)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>6_000_000){setError('Gunakan PNG/JPG/WebP maksimal 6 MB.');return;}
    setBusy(true);setError('');setNotice('');try{const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=reject;reader.readAsDataURL(file);});
      const r=await apiTransport.send<{fileId:string;url:string;sharing:string}>('idcard.background.upload',{filename:file.name,mimeType:file.type,base64},{timeoutMs:50000});if(!r.ok||!r.data?.fileId)throw new Error(r.error?.message||'Upload tidak berhasil.');update({backgroundUrl:r.data.url,backgroundFileId:r.data.fileId});setNotice('Gambar sudah di Drive. Klik Simpan Draft untuk menyimpan referensi template. Akses gambar masih privat sampai Admin mengatur izin berbagi.');
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(false);if(fileRef.current)fileRef.current.value='';}
  };
  const beginDrag=(e:React.PointerEvent<HTMLDivElement>,el:Element)=>{if(!canvasRef.current)return;const bounds=canvasRef.current.getBoundingClientRect();setSelectedId(el.id);setDrag({id:el.id,offsetX:((e.clientX-bounds.left)/bounds.width*100)-el.x,offsetY:((e.clientY-bounds.top)/bounds.height*100)-el.y});e.currentTarget.setPointerCapture(e.pointerId);};
  const moveDrag=(e:React.PointerEvent<HTMLDivElement>,el:Element)=>{if(!drag||drag.id!==el.id||!canvasRef.current)return;const b=canvasRef.current.getBoundingClientRect();const nx=(e.clientX-b.left)/b.width*100-drag.offsetX,ny=(e.clientY-b.top)/b.height*100-drag.offsetY;updateElement(el.id,{x:Math.round(Math.max(0,Math.min(100-el.w,nx))*10)/10,y:Math.round(Math.max(0,Math.min(100-el.h,ny))*10)/10});};
  const control='w-full rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#24262B] text-slate-900 dark:text-white px-3 py-2 text-sm';
  if(showLegacy)return <div className="space-y-3"><button className="rounded-xl border px-4 py-2" onClick={()=>setShowLegacy(false)}>← Kembali ke ID Card GAS</button><DocumentTemplateStudio/></div>;
  return <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-16 space-y-5 text-slate-900 dark:text-white">
    <header className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#17181C] p-5 flex flex-wrap gap-4 justify-between items-start">
      <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">SiEpang · Template tersimpan GAS</p><h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard/> ID Card Canvas Designer</h1><p className="text-sm text-slate-500 dark:text-slate-400">Unggah latar, atur field peserta, simpan layout dan pilih template aktif.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={()=>{setEditing(null);void load();}} className="rounded-xl border px-3 py-2 text-sm flex items-center gap-2"><RefreshCw size={16}/> Muat ulang</button><button onClick={()=>setShowLegacy(true)} className="rounded-xl border px-3 py-2 text-sm">Studio Dokumen Lama</button><button onClick={()=>{setEditing(blankTemplate());setSelectedId('');setNotice('');setError('');}} className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm flex items-center gap-2"><Plus size={16}/> Buat Template</button></div>
    </header>
    {error&&<div role="alert" className="rounded-xl border border-rose-400 bg-rose-50 dark:bg-rose-950/30 p-3 text-rose-700 dark:text-rose-300">{error}</div>}
    {notice&&<div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-emerald-800 dark:text-emerald-300">{notice}</div>}
    {!editing?<section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#17181C] p-5"><h2 className="font-bold mb-4">Template ID Card dalam event aktif</h2>{loading?<p>Memuat template dari GAS…</p>:templates.length===0?<p className="text-sm text-slate-500">Belum ada template. Klik Buat Template untuk memulai.</p>:<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{templates.map(t=><button key={t.id} onClick={()=>{setEditing(JSON.parse(JSON.stringify(t)));setSelectedId('');setNotice('');}} className="text-left rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-2 hover:border-emerald-500"><strong className="block">{t.name}</strong><span className="block text-xs text-slate-500">{categories.find(c=>c.value===t.category)?.label} · {t.widthMm} × {t.heightMm} mm · v{t.version||1}</span><span className="text-xs font-bold text-emerald-600">{t.status==='ACTIVE'?'AKTIF':'DRAF'} · Edit →</span></button>)}</div>}</section>:
      <div className="grid lg:grid-cols-[270px_minmax(0,1fr)_280px] gap-4 items-start">
        <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#17181C] p-4 space-y-4"><h2 className="font-bold">Pengaturan Template</h2>
          <label className="block text-xs space-y-1">Nama template *<input className={control} maxLength={120} value={editing.name} onChange={e=>update({name:e.target.value})} placeholder="Masukkan nama template"/></label>
          <label className="block text-xs space-y-1">Jenis kartu<select className={control} value={editing.category} onChange={e=>update({category:e.target.value as Category})}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2"><label className="block text-xs space-y-1">Lebar (mm)<input className={control} type="number" min={30} max={300} value={editing.widthMm} onChange={e=>update({widthMm:Number(e.target.value)})}/></label><label className="block text-xs space-y-1">Tinggi (mm)<input className={control} type="number" min={30} max={300} value={editing.heightMm} onChange={e=>update({heightMm:Number(e.target.value)})}/></label></div>
          <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-white/10 p-3">
            <label className="block text-xs font-semibold" htmlFor="idcard-size-preset">Preset Ukuran Kartu</label>
            <select
              id="idcard-size-preset"
              className={control}
              value={selectedSizePreset(editing.widthMm,editing.heightMm)}
              onChange={e=>{
                const p=cardSizePresets.find(item=>item.id===e.target.value);
                if(p) update({widthMm:p.w,heightMm:p.h});
              }}
            >
              {cardSizePresets.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
              <option value="custom">Ukuran kustom — isi lebar & tinggi</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>update({widthMm:Math.min(editing.widthMm,editing.heightMm),heightMm:Math.max(editing.widthMm,editing.heightMm)})} className="rounded-xl border border-slate-300 dark:border-white/20 px-2 py-2 text-xs hover:border-emerald-500">Vertikal (Portrait)</button>
              <button type="button" onClick={()=>update({widthMm:Math.max(editing.widthMm,editing.heightMm),heightMm:Math.min(editing.widthMm,editing.heightMm)})} className="rounded-xl border border-slate-300 dark:border-white/20 px-2 py-2 text-xs hover:border-emerald-500">Horizontal (Landscape)</button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Memilih preset hanya mengubah lebar dan tinggi. Elemen, latar, dan status template tidak berubah. Ukuran tersimpan saat klik Simpan ke GAS.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);}}/>
          <button type="button" disabled={busy} onClick={()=>fileRef.current?.click()} className="w-full rounded-xl bg-sky-600 text-white px-3 py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50"><Upload size={16}/> Unggah latar ke Drive</button>
          <label className="block text-xs space-y-1">URL latar (opsional)<input className={control} value={editing.backgroundUrl||''} onChange={e=>update({backgroundUrl:e.target.value,backgroundFileId:''})} placeholder="Tautan file Google Drive atau gambar HTTPS"/></label>
          {editing.backgroundUrl&&<p className="text-xs text-slate-500">{backgroundLoaded?'✓ Gambar latar berhasil dimuat':backgroundError||'Memeriksa gambar latar…'}</p>}
          {editing.backgroundUrl&&!candidates.length&&<p role="alert" className="text-xs text-rose-600">URL gambar tidak valid. Gunakan tautan HTTPS.</p>}
          <p className="text-xs text-slate-500">Template disimpan ke sheet DocumentTemplates. File gambar disimpan di folder Drive yang ditetapkan Admin.</p>
          <hr className="dark:border-white/10"/><h3 className="text-sm font-bold">Tambah Field Dinamis</h3>
          <select className={control} value={selectedField} onChange={e=>setSelectedField(e.target.value as Field)}>{fields.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select>
          <button type="button" onClick={()=>{const el=newElement(selectedField);update({elements:[...editing.elements,el]});setSelectedId(el.id);}} className="w-full rounded-xl bg-slate-800 dark:bg-slate-600 px-3 py-2 text-sm text-white flex items-center justify-center gap-2"><Plus size={16}/> Tambah ke Canvas</button>
          <div className="space-y-1">{editing.elements.map(el=><button key={el.id} type="button" onClick={()=>setSelectedId(el.id)} className={`w-full text-left text-xs p-2 rounded-lg border ${selectedId===el.id?'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20':'border-slate-200 dark:border-white/10'}`}>{fieldLabel(el.field)}</button>)}</div>
        </section>
        <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#17181C] p-4 space-y-3 min-w-0"><div className="flex flex-wrap justify-between gap-2 items-center"><h2 className="font-bold flex gap-2 items-center"><Move size={16}/> Canvas Kartu</h2><label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={previewMode} onChange={e=>setPreviewMode(e.target.checked)}/> Pratinjau kosong</label></div>
          <p className="text-xs text-slate-500">Geser kotak untuk menempatkan elemen. Label field adalah placeholder, bukan data peserta dummy.</p>
          <div className="min-h-[430px] bg-slate-100 dark:bg-[#0D0F13] rounded-2xl flex items-center justify-center p-4 overflow-hidden">
            <div ref={canvasRef} className="relative bg-white shadow-xl border border-slate-300 overflow-hidden" style={{aspectRatio:`${editing.widthMm}/${editing.heightMm}`,width:editing.widthMm>editing.heightMm?'min(100%, 490px)':'min(100%, 320px)',maxHeight:600}}>
              {candidate&&<img key={candidate.url} src={candidate.url} alt="Latar desain ID Card" draggable={false} onLoad={()=>{setBackgroundLoaded(true);setBackgroundError('');}} onError={onBackgroundError} className="absolute inset-0 h-full w-full object-fill pointer-events-none select-none" />}
              {!editing.backgroundUrl&&<div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">Latar belum diunggah</div>}
              {editing.backgroundUrl&&(!candidates.length||backgroundError)&&<div role="alert" className="absolute inset-0 flex items-center justify-center bg-white/90 p-4 text-center text-xs text-rose-700">{backgroundError||'Format URL gambar tidak valid.'}</div>}
              {editing.elements.map(el=><div key={el.id} role="button" tabIndex={0} aria-label={`Pindahkan ${fieldLabel(el.field)}`} onPointerDown={e=>beginDrag(e,el)} onPointerMove={e=>moveDrag(e,el)} onPointerUp={()=>setDrag(null)} onPointerCancel={()=>setDrag(null)} className={`absolute select-none touch-none flex justify-center items-center overflow-hidden cursor-move border ${selectedId===el.id?'border-emerald-600 ring-1 ring-emerald-600':'border-dashed border-slate-400/70'}`} style={{left:`${el.x}%`,top:`${el.y}%`,width:`${el.w}%`,height:`${el.h}%`,color:el.color,textAlign:el.align,fontSize:Math.max(9,el.fontSize*0.8)}}>{!previewMode?(el.field==='participant.photo'?'FOTO':el.field==='participant.qr'?'QR':el.field==='text.static'?(el.text||'TEKS'):fieldLabel(el.field)):(el.field==='text.static'?el.text:'')}</div>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void save('DRAFT')} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-50"><Save size={16}/> Simpan Draft ke GAS</button><button disabled={busy} onClick={()=>void save('ACTIVE')} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"><CheckCircle2 size={16}/> Simpan & Aktifkan</button><button onClick={()=>setEditing(null)} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"><ArrowLeft size={16}/> Kembali</button></div>
        </section>
        <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#17181C] p-4 space-y-4"><h2 className="font-bold">Properti Elemen</h2>{!selected?<p className="text-sm text-slate-500">Klik elemen di canvas atau daftar field untuk mengaturnya.</p>:<>
          <div className="text-sm font-medium">{fieldLabel(selected.field)}</div>
          {selected.field==='text.static'&&<label className="block text-xs space-y-1">Isi teks<input className={control} value={selected.text} onChange={e=>updateElement(selected.id,{text:e.target.value})}/></label>}
          <div className="grid grid-cols-2 gap-2">{(['x','y','w','h'] as const).map(prop=><label key={prop} className="block text-xs space-y-1">{prop.toUpperCase()} (%)<input type="number" min={prop==='w'||prop==='h'?1:0} max={100} step={0.5} className={control} value={selected[prop]} onChange={e=>{let v=Number(e.target.value);if(!Number.isFinite(v))return;v=prop==='x'?Math.max(0,Math.min(100-selected.w,v)):prop==='y'?Math.max(0,Math.min(100-selected.h,v)):prop==='w'?Math.max(1,Math.min(100-selected.x,v)):Math.max(1,Math.min(100-selected.y,v));updateElement(selected.id,{[prop]:v});}}/></label>)}</div>
          <label className="block text-xs space-y-1">Ukuran teks<input type="number" min={6} max={60} value={selected.fontSize} onChange={e=>updateElement(selected.id,{fontSize:Number(e.target.value)})} className={control}/></label>
          <label className="block text-xs space-y-1">Warna teks<input type="color" value={/^#[0-9a-fA-F]{6}$/.test(selected.color)?selected.color:'#111827'} onChange={e=>updateElement(selected.id,{color:e.target.value})} className="w-full h-10"/></label>
          <label className="block text-xs space-y-1">Perataan<select className={control} value={selected.align} onChange={e=>updateElement(selected.id,{align:e.target.value as Element['align']})}><option value="left">Kiri</option><option value="center">Tengah</option><option value="right">Kanan</option></select></label>
          <button className="flex items-center gap-2 rounded-xl border border-rose-300 text-rose-600 px-3 py-2 text-sm" onClick={()=>{update({elements:editing.elements.filter(e=>e.id!==selected.id)});setSelectedId('');}}><Trash2 size={16}/> Hapus elemen</button></>}
          <p className="text-xs text-slate-500">Data yang ditempatkan pada canvas hanyalah nama field. Pencetakan dengan data peserta nyata perlu integrasi renderer cetak terpisah.</p>
        </section>
      </div>}
  </div>;
};
