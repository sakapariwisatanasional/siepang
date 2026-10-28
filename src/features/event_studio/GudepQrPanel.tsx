import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { gudepQrService, GudepGateLog, GudepQrInfo } from '../../services/gudepQrService';

type Props = { gudepId: string; gudepName: string };
type Direction = 'CHECK_IN' | 'CHECK_OUT';

export const GudepQrPanel: React.FC<Props> = ({ gudepId, gudepName }) => {
  const [info,setInfo] = useState<GudepQrInfo | null>(null);
  const [image,setImage] = useState('');
  const [history,setHistory] = useState<GudepGateLog[]>([]);
  const [direction,setDirection] = useState<Direction>('CHECK_IN');
  const [tokenInput,setTokenInput] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [camera,setCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const scanning = useRef(false);

  const friendlyError = (error: any, fallback: string) => {
    const raw = String(error?.message || error || '');
    const messages: Record<string, string> = {
      AUTH_REQUIRED: 'Sesi login tidak valid. Silakan login kembali.',
      EVENT_NOT_CONFIGURED: 'Event aktif belum dikonfigurasi oleh administrator.',
      EVENT_SCOPE_MISMATCH: 'QR berasal dari event yang berbeda.',
      GUDEP_GATE_OFFICER_REQUIRED: 'Akun ini hanya dapat melihat QR Gudep, belum memiliki izin petugas gerbang.',
      GUDEP_ACCESS_DENIED: 'Akun ini tidak memiliki akses ke Gudep tersebut.',
      GUDEP_NOT_FOUND: 'Data Gudep tidak ditemukan pada event aktif.',
      INVALID_GUDEP_QR: 'QR tidak valid, bukan QR Gudep aktif, atau berasal dari event lain.',
      GUDEP_NOT_VERIFIED_ACTIVE: 'Gudep belum diverifikasi dan diaktifkan. Kehadiran belum dicatat.',
      GUDEP_NOT_CHECKED_IN: 'Check-out tidak dapat dilakukan karena Gudep belum check-in.',
      GUDEP_ALREADY_CHECKED_OUT: 'Gudep sudah check-out. Check-in ulang tidak diizinkan.',
      GUDEP_GATE_BUSY: 'Sistem sedang memproses scan lain. Tunggu sebentar lalu coba kembali.',
      GUDEP_QR_BUSY: 'QR sedang diproses oleh petugas lain. Coba kembali sebentar lagi.',
      ADMIN_ONLY_QR_ISSUE: 'Hanya administrator yang dapat menerbitkan QR Gudep.',
      GUDEP_GATE_LOG_SCHEMA_INVALID: 'Struktur sheet GudepGateLogs tidak sesuai. Hubungi administrator.'
    };
    const key = raw.split(':')[0].trim();
    return messages[key] || raw || fallback;
  };

  const reload = useCallback(async () => {
    const [qr, logs] = await Promise.all([gudepQrService.get(gudepId),gudepQrService.history(gudepId)]);
    setInfo(qr); setHistory(logs.history || []);
    setImage(qr.qr_token ? await QRCode.toDataURL(qr.qr_token,{width:340,margin:2,errorCorrectionLevel:'M'}) : '');
  },[gudepId]);
  useEffect(() => {setInfo(null);setImage('');setError('');void reload().catch(e=>setError(friendlyError(e,'Gagal membaca QR Gudep.')));},[reload]);
  useEffect(() => () => {cameraStream.current?.getTracks().forEach(t=>t.stop());},[]);
  const issue = async () => {
    setBusy(true);setError('');setMessage('');
    try {await gudepQrService.issue(gudepId);await reload();setMessage('QR Gudep tersedia. Token yang sudah ada tidak diganti.');}
    catch(e:any){setError(friendlyError(e,'Gagal menerbitkan QR.'));}finally{setBusy(false);}
  };
  const scan = async (value: string) => {
    if(busy || !value.trim()) return;
    scanning.current=true; setBusy(true);setError('');setMessage('');
    try {const r=await gudepQrService.scan(value.trim(),direction);setMessage(`${r.gudep_name}: ${r.message}`);setTokenInput('');await reload();}
    catch(e:any){setError(friendlyError(e,'Pemindaian ditolak GAS.'));}
    finally{setBusy(false);scanning.current=false;}
  };
  useEffect(()=>{
    if(!camera)return;
    let cancelled=false;
    const detectorClass=(window as any).BarcodeDetector;
    if(!detectorClass){setError('Browser ini belum mendukung pemindaian QR melalui kamera. Gunakan Chrome Android yang terbaru, scanner USB, atau masukkan token secara manual.');setCamera(false);return;}
    if (!navigator.mediaDevices?.getUserMedia) {setError('Akses kamera tidak tersedia. Buka aplikasi melalui HTTPS dan izinkan akses kamera, atau gunakan scanner USB/input manual.');setCamera(false);return;}
    const detector=new detectorClass({formats:['qr_code']});
    let frame=0;
    const start=async()=>{
      try {
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
        if(cancelled){stream.getTracks().forEach(t=>t.stop());return;}
        cameraStream.current=stream;
        if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
        const tick=async()=>{
          if(cancelled)return;
          if(videoRef.current?.readyState===4 && !scanning.current){
            try{const codes=await detector.detect(videoRef.current);if(codes[0]?.rawValue){await scan(codes[0].rawValue);setCamera(false);return;}}catch{/* tunggu frame berikutnya */}
          }
          if(!cancelled)frame=window.setTimeout(tick,250);
        };void tick();
      }catch(e:any){setError(friendlyError(e,'Kamera tidak tersedia.'));setCamera(false);}
    };void start();
    return()=>{cancelled=true;window.clearTimeout(frame);cameraStream.current?.getTracks().forEach(t=>t.stop());cameraStream.current=null;};
  // direction dipilih sebelum kamera dibuka; saat berganti arah, kamera dihentikan dan dibuka ulang
  },[camera,direction]);
  const print = () => {
    if(!image || !info)return;
    const w=window.open('','_blank','width=500,height=670');
    if(!w){setError('Izinkan pop-up browser untuk mencetak QR.');return;}
    w.document.write(`<!doctype html><html><head><title>QR Gudep</title><style>body{text-align:center;font-family:Arial;padding:24px}img{width:320px}small{display:block;margin-top:16px}</style></head><body><h2>${escapeHtml(gudepName)}</h2><p>${escapeHtml(info.gudep_number)}</p><img src="${image}"/><small>SiEpang — QR check-in/check-out rombongan</small></body></html>`);
    w.document.close();w.onload=()=>w.print();
  };
  return <section className="rounded-2xl border border-slate-200 p-4 dark:border-white/10 dark:bg-[#141418] space-y-4">
    <h3 className="font-bold text-sm text-slate-900 dark:text-white">QR Gudep — Kedatangan & Kepulangan</h3>
    <p className="text-xs text-slate-500">Satu QR untuk satu Gudep selama event. Tidak untuk presensi agenda dan tidak memberikan XP.</p>
    {error&&<p role="alert" className="rounded-lg bg-rose-100 p-3 text-sm text-rose-900">{error}</p>}
    {message&&<p role="status" className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{message}</p>}
    <div className="flex flex-wrap items-start gap-5">
      {image?<img src={image} alt={`QR Gudep ${gudepName}`} width={240} height={240} className="rounded-xl bg-white p-2"/>:<div className="flex h-48 w-48 items-center justify-center rounded-xl bg-slate-100 text-center text-xs text-slate-600 p-5">QR belum diterbitkan</div>}
      <div className="space-y-2 text-sm text-slate-800 dark:text-slate-100">
        <p><strong>Gudep:</strong> {gudepName}</p><p><strong>Status gerbang:</strong> {info?.gate_status || 'Memuat…'}</p>
        <p><strong>Status Gudep:</strong> {info?.verification_status} · {info?.activation_status}</p>
        <div className="flex flex-wrap gap-2">
          {!image&&<button type="button" disabled={busy} onClick={()=>void issue()} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Terbitkan QR (Admin)</button>}
          {image&&<button type="button" onClick={print} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Cetak QR</button>}
          <button type="button" onClick={()=>void reload().catch(e=>setError(friendlyError(e,'Gagal memuat ulang.')))} className="rounded-lg border px-3 py-2 text-xs dark:text-white">Muat Ulang</button>
        </div>
      </div>
    </div>
    {info?.can_scan ? <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10 space-y-3">
      <h4 className="text-sm font-bold dark:text-white">Scanner Petugas Gerbang</h4>
      <div className="flex gap-4 text-sm dark:text-white"><label><input type="radio" checked={direction==='CHECK_IN'} onChange={()=>{setCamera(false);setDirection('CHECK_IN');}}/> Check-in</label><label><input type="radio" checked={direction==='CHECK_OUT'} onChange={()=>{setCamera(false);setDirection('CHECK_OUT');}}/> Check-out</label></div>
      <form onSubmit={e=>{e.preventDefault();void scan(tokenInput);}} className="flex flex-wrap gap-2">
        <input type="text" value={tokenInput} onChange={e=>setTokenInput(e.target.value)} placeholder="Hasil scan QR / token Gudep" aria-label="Token QR Gudep" className="min-w-48 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" autoComplete="off"/>
        <button type="submit" disabled={busy||!tokenInput.trim()} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy?'Memproses…':'Catat Scan'}</button>
        <button type="button" disabled={busy} onClick={()=>setCamera(x=>!x)} className="rounded-lg border px-3 py-2 text-xs dark:text-white disabled:opacity-50">{camera?'Tutup Kamera':'Buka Kamera'}</button>
      </form>
      {camera&&<video ref={videoRef} muted playsInline className="max-h-64 w-full rounded-xl bg-black object-contain"/>}
    </div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      Scanner gerbang hanya tersedia untuk petugas yang diberi wewenang oleh GAS. Akun ini tetap dapat melihat QR Gudep jika memiliki akses, tetapi tidak dapat mencatat check-in/check-out.
    </div>}
    <div><h4 className="mb-2 text-sm font-bold dark:text-white">Riwayat Gerbang</h4>{!history.length?<p className="text-xs text-slate-500">Belum ada check-in atau check-out.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-xs dark:text-white"><thead><tr><th className="py-2">Aksi</th><th>Waktu (lokal)</th><th>Gerbang</th><th>Petugas</th></tr></thead><tbody>{history.map(h=><tr key={h.log_id} className="border-t border-slate-200 dark:border-white/10"><td className="py-2">{h.direction}</td><td>{new Date(h.created_at).toLocaleString('id-ID')}</td><td>{h.gate_name}</td><td>{h.officer_user_id}</td></tr>)}</tbody></table></div>}</div>
  </section>;
};
function escapeHtml(v:string):string{return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
