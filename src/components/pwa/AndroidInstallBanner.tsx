import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { pwaInstallService } from '../../services/pwaInstallService';

export const AndroidInstallBanner: React.FC = () => {
  const state = useSyncExternalStore(pwaInstallService.subscribe, pwaInstallService.getSnapshot, pwaInstallService.getSnapshot);
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {const timer = window.setTimeout(() => setReady(true), 8000); return () => window.clearTimeout(timer);}, []);
  if (!ready || !state.android || state.standalone || state.dismissed) return null;

  const install = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (await pwaInstallService.install() === 'manual') setManual(true);
    } catch {
      setManual(true);
      setError('Dialog pemasangan belum dapat dibuka. Gunakan langkah manual berikut.');
    } finally {setBusy(false);}
  };
  const button: React.CSSProperties = {borderRadius:10, padding:'10px 14px', fontSize:13, fontWeight:700, cursor:'pointer', minHeight:44};
  return <aside id="siepang-android-install" aria-label="Pasang SiEpang di Android" style={{position:'fixed',left:12,right:12,bottom:'calc(88px + env(safe-area-inset-bottom, 0px))',zIndex:40,maxWidth:460,margin:'0 auto',background:'#fff',color:'#17212b',border:'1px solid #cbd5e1',borderRadius:18,padding:16,boxShadow:'0 8px 32px rgba(0,0,0,.18)',maxHeight:'55dvh',overflowY:'auto'}}>
    <style>{'@media print { #siepang-android-install { display: none !important; } }'}</style>
    <div style={{display:'flex',gap:12,alignItems:'center'}}>
      <img src="/icon-192.png" width={44} height={44} alt="" style={{borderRadius:10,flexShrink:0}}/>
      <div><strong style={{fontSize:15}}>Pasang SiEpang di layar utama</strong><p style={{fontSize:13,lineHeight:1.5,margin:'4px 0 0'}}>Buka aplikasi langsung dari ikon, tanpa mengetik alamat lagi.</p></div>
    </div>
    {manual && <div role="status" style={{marginTop:12,fontSize:13,lineHeight:1.6,background:'#f1f5f9',padding:12,borderRadius:10}}>
      {error && <p style={{margin:'0 0 8px',color:'#b91c1c'}}>{error}</p>}
      <p style={{margin:0}}>Buka menu browser (⋮), pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>, lalu konfirmasi.</p>
      <p style={{margin:'8px 0 0'}}>Jika dibuka dari WhatsApp/Instagram, buka alamat ini di browser Android terlebih dahulu. Jika ikon sudah ada, gunakan ikon tersebut untuk membuka SiEpang.</p>
    </div>}
    <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
      <button type="button" disabled={busy} onClick={pwaInstallService.dismiss} style={{...button,border:'1px solid #cbd5e1',background:'#fff',color:'#475569'}}>Nanti</button>
      {!manual && <button type="button" disabled={busy} onClick={() => void install()} style={{...button,border:0,background:'#166534',color:'#fff',opacity:busy ? 0.6 : 1}}>{busy ? 'Membuka…' : state.available ? 'Pasang' : 'Cara memasang'}</button>}
      {manual && state.available && <button type="button" disabled={busy} onClick={() => void install()} style={{...button,border:0,background:'#166534',color:'#fff'}}>Pasang</button>}
    </div>
  </aside>;
};
