import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { apiTransport } from '../../services/apiTransport';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';

type Element = {id:string;field:string;x:number;y:number;w:number;h:number;fontSize:number;color:string;align:'left'|'center'|'right';text:string};
type Template = {id:string;name:string;category:string;status:string;widthMm:number;heightMm:number;backgroundUrl:string;elements:Element[]};
type RecordRow = Record<string, unknown>;
const get=(r:RecordRow,...keys:string[])=>{for(const k of keys){const value=r[k];if(value!==null&&value!==undefined&&String(value).trim())return String(value).trim();}return '';};
const extractImage=(url:string)=>{const value=url.trim();const m=value.match(/(?:\/file\/d\/|[?&]id=)([\w-]+)/);return m?`https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w1600`:value;};
const getId=(r:RecordRow)=>get(r,'id','participant_id');
const getName=(r:RecordRow)=>get(r,'name','fullName','full_name');
const getGudep=(r:RecordRow)=>get(r,'gudep_name','gudepName','contingentName','contingent_name','institution','schoolPangkalan');
const getRegu=(r:RecordRow)=>get(r,'regu_name','reguName','team_name','teamName');
const getRole=(r:RecordRow)=>get(r,'role','scout_level','scoutLevel','position','jabatan');
const getSerial=(r:RecordRow)=>get(r,'serial_number','serialNumber','participant_number','participantNumber','code','participant_code');

export const IdCardBatchPrint:React.FC<{template:Template;onBack:()=>void}>=({template,onBack})=>{
 const [rows,setRows]=useState<RecordRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [gudep,setGudep]=useState(''),[regu,setRegu]=useState(''),[role,setRole]=useState(''),[query,setQuery]=useState('');
 const [selected,setSelected]=useState<string[]>([]),[qr,setQr]=useState<Record<string,string>>({});
 const refresh=async()=>{setLoading(true);setError('');try{const r=await apiTransport.send<{participants:RecordRow[]}>('participants.list',{}, {timeoutMs:45000});if(!r.ok||!Array.isArray(r.data?.participants))throw new Error(r.error?.message||'GAS tidak mengembalikan daftar peserta.');const usable=r.data.participants.filter(p=>getId(p)&&getName(p)&&String(p.active_status||p.activeStatus||'').toUpperCase()!=='ARCHIVED');setRows(usable);setSelected([]);}catch(e:any){setError(e?.message||String(e));}finally{setLoading(false);}};
 useEffect(()=>{void refresh();},[]);
 const unique=(f:(p:RecordRow)=>string)=>Array.from(new Set(rows.map(f).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'id'));
 const filtered=useMemo(()=>rows.filter(p=>(!gudep||getGudep(p)===gudep)&&(!regu||getRegu(p)===regu)&&(!role||getRole(p)===role)&&(!query||[getName(p),getId(p),getSerial(p)].some(s=>s.toLowerCase().includes(query.toLowerCase())))),[rows,gudep,regu,role,query]);
 const selectedRows=filtered.filter(p=>selected.includes(getId(p)));
 const uniqueSerials=new Set(selectedRows.map(getSerial).filter(Boolean));
 const serialOk=selectedRows.every(p=>!!getSerial(p))&&uniqueSerials.size===selectedRows.length;
 const qrReady=selectedRows.every(p=>!!qr[getId(p)]);
 useEffect(()=>{let canceled=false;const ids=selectedRows.map(getId).filter(id=>!qr[id]);if(!ids.length)return;Promise.all(ids.map(id=>QRCode.toDataURL(id,{width:320,margin:1,errorCorrectionLevel:'M'}).then(data=>({id,data})))).then(all=>{if(!canceled)setQr(prev=>({...prev,...Object.fromEntries(all.map(x=>[x.id,x.data]))}));}).catch(()=>{if(!canceled)setError('QR tidak berhasil disiapkan. Jangan cetak sebelum QR lengkap.');});return()=>{canceled=true;};},[selected.join('|')]);
 const field=(el:Element,p:RecordRow):React.ReactNode=>{switch(el.field){case 'participant.full_name':return getName(p);case 'participant.nta':return get(p,'pramuka_id','pramukaId','membershipNumber','nta');case 'participant.participant_number':return getSerial(p);case 'participant.contingent':return getGudep(p);case 'participant.regu':return getRegu(p);case 'participant.role':return getRole(p);case 'participant.gender':return get(p,'gender');case 'participant.photo':{const src=get(p,'profile_photo_url','photoUrl','photo_url');return src?<img src={extractImage(src)} className="w-full h-full object-cover" alt="Foto resmi peserta"/>:null;}case 'participant.qr':return qr[getId(p)]?<img src={qr[getId(p)]} className="w-full h-full object-contain" alt={`QR ${getId(p)}`}/>:null;case 'text.static':return el.text;default:return '';}};
 const toggle=(id:string)=>setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 return <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 text-slate-900 dark:text-white">
 <style>{`@media print { body * { visibility:hidden!important; } #siepang-idcard-print, #siepang-idcard-print * {visibility:visible!important;} #siepang-idcard-print {position:absolute;left:0;top:0;width:100%;display:flex!important;gap:0!important;flex-wrap:wrap!important;} .siepang-print-card {break-inside:avoid;page-break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact;} @page {size:A4; margin:8mm;} }`}</style>
 <div className="print:hidden flex flex-wrap justify-between gap-3 items-center"><div><h1 className="font-bold text-xl">Cetak ID Card Massal</h1><p className="text-sm text-slate-500">Template: {template.name} · Pilih peserta dari GAS berdasarkan Gudep, regu, dan jabatan.</p></div><div className="flex gap-2"><button type="button" onClick={onBack} className="border rounded-xl px-4 py-2 flex gap-2 items-center"><ArrowLeft size={16}/> Kembali</button><button type="button" onClick={()=>void refresh()} className="border rounded-xl px-4 py-2 flex gap-2 items-center"><RefreshCw size={16}/> Muat Ulang GAS</button></div></div>
 {error&&<p role="alert" className="print:hidden p-3 rounded-xl border border-rose-400 text-rose-600">{error}</p>}
 <div className="print:hidden grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
 <label className="text-sm">Gudep / Pangkalan<select className="mt-1 w-full rounded-lg p-2 border bg-white text-slate-900" value={gudep} onChange={e=>{setGudep(e.target.value);setRegu('');setSelected([]);}}><option value="">Semua Gudep</option>{unique(getGudep).map(v=><option key={v}>{v}</option>)}</select></label>
 <label className="text-sm">Regu<select className="mt-1 w-full rounded-lg p-2 border bg-white text-slate-900" value={regu} onChange={e=>{setRegu(e.target.value);setSelected([]);}}><option value="">Semua Regu</option>{unique(getRegu).map(v=><option key={v}>{v}</option>)}</select></label>
 <label className="text-sm">Golongan / Jabatan<select className="mt-1 w-full rounded-lg p-2 border bg-white text-slate-900" value={role} onChange={e=>{setRole(e.target.value);setSelected([]);}}><option value="">Semua Jabatan</option>{unique(getRole).map(v=><option key={v}>{v}</option>)}</select></label>
 <label className="text-sm">Cari nama / nomor<input className="mt-1 w-full rounded-lg p-2 border bg-white text-slate-900" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari peserta"/></label>
 </div>
 <div className="print:hidden border rounded-xl p-3"><div className="flex gap-2 justify-between flex-wrap items-center"><span className="text-sm">{loading?'Memuat peserta dari GAS...':`${filtered.length} peserta ditemukan · ${selectedRows.length} dipilih`}</span><div className="flex gap-2"><button type="button" className="text-sm border rounded-lg px-3 py-1.5" onClick={()=>setSelected(Array.from(new Set(filtered.map(getId))))}>Pilih Semua Hasil</button><button type="button" className="text-sm border rounded-lg px-3 py-1.5" onClick={()=>setSelected([])}>Batalkan</button></div></div>
 <div className="max-h-60 overflow-y-auto mt-3 space-y-1">{filtered.map(p=><label key={getId(p)} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-white/10 p-2 text-sm"><input type="checkbox" checked={selected.includes(getId(p))} onChange={()=>toggle(getId(p))}/><span className="flex-1">{getName(p)} <span className="text-slate-500">· {getGudep(p)} · {getRegu(p)} · {getRole(p)}</span></span><span className="font-mono text-xs">{getSerial(p)||'Nomor belum tersedia'}</span></label>)}</div></div>
 {!serialOk&&selectedRows.length>0&&<p role="alert" className="print:hidden text-amber-600 text-sm">Satu atau beberapa nomor seri tidak tersedia/duplikat di GAS. Cetak ditahan agar tidak menghasilkan nomor kartu palsu.</p>}
 <button type="button" disabled={!selectedRows.length||!serialOk||!qrReady||!!error} onClick={()=>window.print()} className="print:hidden px-5 py-3 rounded-xl bg-emerald-600 text-white disabled:opacity-50 flex gap-2 items-center"><Printer size={18}/> Cetak {selectedRows.length} Kartu A4</button>
 <div id="siepang-idcard-print" className="flex flex-wrap items-start content-start gap-2 bg-white p-3 rounded-lg text-black" >{selectedRows.map(p=><div key={getId(p)} className="siepang-print-card relative border border-slate-300 overflow-hidden shrink-0 bg-white" style={{width:`${template.widthMm}mm`,height:`${template.heightMm}mm`}}>{template.backgroundUrl&&<img src={extractImage(template.backgroundUrl)} alt="Latar kartu" className="absolute inset-0 w-full h-full"/>}{template.elements.map(el=><div key={el.id} className="absolute flex items-center justify-center overflow-hidden whitespace-pre-wrap" style={{left:`${el.x}%`,top:`${el.y}%`,width:`${el.w}%`,height:`${el.h}%`,fontSize:`${el.fontSize}pt`,color:el.color,textAlign:el.align}}>{field(el,p)}</div>)}</div>)}</div>
 <p className="print:hidden text-xs text-slate-500">Setiap QR berisi ID peserta resmi seperti QR Pass SiEpang. Nomor seri berasal dari data GAS, bukan nomor acak. Template tidak diubah saat mencetak. Gunakan skala cetak 100% dan aktifkan cetak background pada browser.</p>
 </div>;
};
