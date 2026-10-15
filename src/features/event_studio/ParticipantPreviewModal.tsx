/** SiEpang interactive demo: session-only state, never calls production APIs. */
import React, { useEffect, useState } from 'react';
import { ArrowLeft, MonitorSmartphone, ShieldCheck, Smartphone, X } from 'lucide-react';
import { demoSessionService, DEMO_COMMITTEE_POSITIONS, type DemoLevel, type DemoMediaType, type DemoSession } from '../../services/demoSessionService';

interface ParticipantPreviewModalProps { isOpen: boolean; onClose: () => void; }
type MenuItem = {label:string;icon:string;description:string};
type Position = {title:string;menus:MenuItem[]};
const make = (entries:[string,string,string][]):MenuItem[] => entries.map(([label,icon,description])=>({label,icon,description}));
const publicMenus = make([
  ['Informasi Event', '📣', 'Informasi kegiatan dan pengumuman'],
  ['Jadwal', '📅', 'Agenda resmi perkemahan'],
  ['Galeri', '🖼️', 'Thumbnail foto dan video publik'],
  ['Lomba Foto / Video', '🏆', 'Karya yang sudah disetujui panitia'],
  ['Hasil Voting', '📊', 'Hasil yang telah dipublikasikan'],
  ['Pendaftaran', '📝', 'Informasi pendaftaran kegiatan'],
]);
const participantMenus = make([
  ['Profil Saya', '👤', 'Identitas pribadi peserta'],
  ['KTA Digital', '🪪', 'Kartu peserta dan QR'],
  ['Jadwal Saya', '📅', 'Agenda peserta'],
  ['Kavling', '⛺', 'Lokasi perkemahan yang ditetapkan'],
  ['Kirim Karya', '📷', 'Pengajuan URL foto atau video lomba'],
  ['Voting', '❤️', 'Pilih karya sesuai ketentuan lomba'],
]);

// Official committee positions. All menu entries here are PREVIEW-ONLY, not permissions.
const positions: Position[] = [
  { title: 'Pelindung', menus: make([['Ikhtisar Event','📊','Ringkasan kegiatan'],['Laporan','📄','Laporan penyelenggaraan']]) },
  { title: 'Penasehat', menus: make([['Ikhtisar Event','📊','Perkembangan event'],['Evaluasi','🔎','Masukan dan evaluasi']]) },
  { title: 'Ketua Pelaksana', menus: make([['Dashboard Event','🧭','Monitoring operasional event'],['Struktur Panitia','👥','Penugasan panitia'],['Persetujuan','✅','Tinjauan kegiatan'],['Laporan','📄','Ringkasan pelaksanaan']]) },
  { title: 'Sekretaris', menus: make([['Surat & Dokumen','📑','Administrasi kesekretariatan'],['Struktur Panitia','👥','Daftar panitia'],['Pengumuman','📣','Informasi kegiatan']]) },
  { title: 'Bendahara', menus: make([['Keuangan','💰','Administrasi anggaran bila modul tersedia'],['Laporan','📄','Rekap keuangan']]) },
  { title: 'Koordinator Lapangan', menus: make([['Jadwal Lapangan','📅','Agenda petugas'],['Peta Buper','🗺️','Lokasi dan fasilitas'],['Laporan Lapangan','📋','Catatan operasional']]) },
  { title: 'Bid. Kesekretariatan, Kerjasama dan Pameran', menus: make([['Surat & Dokumen','📑','Dokumen kegiatan'],['Kerjasama','🤝','Kemitraan'],['Pameran','🏕️','Koordinasi area pameran']]) },
  { title: 'Bid. Kegiatan', menus: make([['Jadwal','📅','Susunan acara'],['Perlombaan','🏆','Pengelolaan lomba'],['Presensi','✅','Kehadiran kegiatan']]) },
  { title: 'Bid. Perkemahan', menus: make([['Peta Buper','🗺️','Peta perkemahan'],['Kavling','⛺','Penempatan regu'],['Fasilitas','🏠','Fasilitas kemah']]) },
  { title: 'Bid. Keagamaan', menus: make([['Jadwal Keagamaan','🕌','Agenda ibadah dan pembinaan'],['Pengumuman','📣','Informasi kegiatan']]) },
  { title: 'Bid. Sarana, Prasarana dan Keamanan', menus: make([['Logistik','📦','Inventaris sarana'],['Fasilitas','🏠','Sarana perkemahan'],['Keamanan','🛡️','Laporan situasi']]) },
  { title: 'Bid. Kesehatan', menus: make([['Posko Kesehatan','❤️','Layanan kesehatan'],['Laporan Insiden','📋','Catatan kejadian']]) },
  { title: 'Bid. Pengawasan dan Evaluasi', menus: make([['Audit Aktivitas','🔎','Rekam aktivitas operasional'],['Evaluasi','📊','Penilaian pelaksanaan'],['Laporan','📄','Rekap pengawasan']]) },
  { title: 'Bid. Konsumsi', menus: make([['Distribusi Konsumsi','🍽️','Pembagian konsumsi'],['Persediaan','📦','Stok bahan dan logistik']]) },
  { title: 'Bid. Humas', menus: make([['Berita','📰','Publikasi informasi'],['Pengumuman','📣','Komunikasi publik'],['Mitra','🤝','Koordinasi hubungan luar']]) },
  { title: 'Bid. Dokumentasi dan Publikasi', menus: make([['Manajemen Galeri','🖼️','URL foto/video dan thumbnail'],['Album Dokumentasi','📁','Album kosong dan media pilihan'],['Verifikasi Karya','📷','Peninjauan karya media'],['Publikasi','📣','Status penerbitan']]) },
  { title: 'Sangga Kerja', menus: make([['Tugas Lapangan','📋','Daftar tugas yang diberikan'],['Jadwal','📅','Penugasan kegiatan'],['Presensi','✅','Kehadiran petugas']]) },
];


export const ParticipantPreviewModal: React.FC<ParticipantPreviewModalProps> = ({isOpen,onClose}) => {
  const [level,setLevel]=useState<DemoLevel>('public');
  const [position,setPosition]=useState<string>('Bid. Dokumentasi dan Publikasi');
  const [page,setPage]=useState('');
  const [device,setDevice]=useState<'mobile'|'desktop'>('mobile');
  const [session,setSession]=useState<DemoSession|null>(null);
  const [name,setName]=useState(''); const [unit,setUnit]=useState('');
  const [description,setDescription]=useState(''); const [url,setUrl]=useState('');
  const [thumbnail,setThumbnail]=useState(''); const [albumId,setAlbumId]=useState('');
  const [mediaType,setMediaType]=useState<DemoMediaType>('PHOTO');
  const [notice,setNotice]=useState(''); const [error,setError]=useState('');
  useEffect(()=>{
    if (!isOpen) {demoSessionService.end();setSession(null);return;}
    const unsub=demoSessionService.subscribe(()=>setSession(demoSessionService.snapshot()));
    demoSessionService.start('public');setPage('');setNotice('');setError('');
    return ()=>{unsub();demoSessionService.end();};
  },[isOpen]);
  useEffect(()=>{if(!isOpen)return;const handle=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(page)setPage('');else onClose();}};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle)},[isOpen,page,onClose]);
  const act=(fn:()=>{message:string})=>{try{setNotice(fn().message);setError('');setName('');setDescription('');setUrl('');setThumbnail('');}catch(e){setError(e instanceof Error?e.message:'Simulasi gagal.');setNotice('');}};
  const switchLevel=(next:DemoLevel,pos?:string)=>{demoSessionService.switchView(next,pos);setLevel(next);if(pos)setPosition(pos);setPage('');setNotice('');setError('')};
  const open=(p:string)=>{setPage(p);setError('');setNotice('')};
  if(!isOpen)return null;
  const posMenus=positions.find(p=>p.title===position)?.menus || positions[0].menus;
  const menus=level==='public'?publicMenus:level==='participant'?participantMenus:posMenus;
  const work=page.toLowerCase();
  const albumPage=/album/.test(work);
  const mediaPage=/galeri|foto|video|media|publikasi|karya|dokumentasi/.test(work);
  const votePage=/vot|hasil|lomba|peringkat/.test(work);
  const regPage=/pendaftaran|registrasi|verifikasi|peserta/.test(work);
  const btn='rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40';
  const input='w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900';
  const label='block text-xs font-semibold text-slate-600 dark:text-slate-300';
  return <div role="dialog" aria-modal="true" aria-label="Pusat Demonstrasi SiEpang" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-2 sm:p-6">
    <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-950">
      <header className="flex items-center justify-between gap-3 border-b p-4"><div className="flex gap-2 items-center"><ShieldCheck className="text-emerald-600"/><div><h2 className="font-bold dark:text-white">Pusat Demonstrasi SiEpang</h2><p className="text-xs text-slate-500">Simulasi interaktif — tidak menulis ke GAS, Drive, atau Spreadsheet</p></div></div><button type="button" aria-label="Tutup demonstrasi" onClick={onClose} className="p-2 dark:text-white"><X/></button></header>
      <div className="flex flex-wrap items-end gap-3 border-b p-3">
        <label className={label}>Level pengguna<select value={level} onChange={e=>switchLevel(e.target.value as DemoLevel)} className={input}><option value="public">Publik</option><option value="participant">Peserta</option><option value="committee">Panitia</option></select></label>
        {level==='committee'&&<label className={label}>Jabatan panitia<select value={position} className={input} onChange={e=>switchLevel('committee',e.target.value)}>{DEMO_COMMITTEE_POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}</select></label>}
        <button type="button" className={btn} onClick={()=>{demoSessionService.reset();setPage('');setNotice('Demo direset.');setError('')}}>Reset sesi</button>
        <div className="ml-auto flex gap-1"><button aria-label="Tampilan HP" type="button" onClick={()=>setDevice('mobile')} className="rounded border p-2 dark:text-white"><Smartphone size={18}/></button><button aria-label="Tampilan desktop" type="button" onClick={()=>setDevice('desktop')} className="rounded border p-2 dark:text-white"><MonitorSmartphone size={18}/></button></div>
      </div>
      <div className="overflow-y-auto bg-slate-100 p-3 dark:bg-slate-900"><div className={`mx-auto min-h-[380px] overflow-hidden rounded-xl bg-white shadow dark:bg-slate-950 ${device==='mobile'?'max-w-[390px]':'max-w-4xl'}`}>
        <div className="bg-emerald-900 p-4 text-white"><div className="text-xs font-bold text-amber-200">MODE DEMO · DATA SEMENTARA</div><div className="font-bold">{level==='public'?'Portal Publik':level==='participant'?'Dashboard Peserta':position}</div></div>
        <div className="space-y-3 p-4">
          {page?<button type="button" onClick={()=>open('')} className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={16}/> Kembali ke beranda demo</button>:<div className={`grid gap-2 ${device==='mobile'?'grid-cols-2':'grid-cols-3'}`}>{menus.map(m=><button type="button" key={m.label} onClick={()=>open(m.label)} className="rounded-lg border p-3 text-left hover:border-emerald-500 dark:text-white"><div className="text-2xl">{m.icon}</div><div className="text-sm font-bold">{m.label}</div><div className="text-xs text-slate-500">{m.description}</div></button>)}</div>}
          {page&&<><h3 className="font-bold dark:text-white">{page}</h3>
          {albumPage&&<><p className="text-xs text-slate-500">Album baru selalu kosong; tidak ada impor foto otomatis.</p><div className="space-y-1">{session?.albums.map(a=><div className="rounded-lg border p-2 text-sm dark:text-white" key={a.id}>📁 {a.name} <span className="text-xs text-slate-500">({session.media.filter(m=>m.albumId===a.id).length} media)</span></div>)}</div><label className={label}>Nama album<input className={input} value={name} onChange={e=>setName(e.target.value)} placeholder="Nama album demo"/></label><label className={label}>Deskripsi<input className={input} value={description} onChange={e=>setDescription(e.target.value)}/></label><button type="button" className={btn} onClick={()=>act(()=>demoSessionService.createAlbum({name,description}))}>Simpan album demo</button></>}
          {mediaPage&&<><p className="text-xs text-slate-500">Masukkan URL contoh. Hanya metadata demo yang berubah.</p><div className="space-y-2">{session?.media.map(m=><div key={m.id} className="rounded-lg border p-2 text-sm dark:text-white"><strong>{m.title}</strong> · {m.type} · {m.status}<div className="flex flex-wrap gap-2 mt-2"><button className="text-emerald-700 text-xs" type="button" onClick={()=>act(()=>demoSessionService.setMediaStatus(m.id,'PUBLISHED'))}>Publikasikan demo</button><button className="text-slate-600 text-xs" type="button" onClick={()=>act(()=>demoSessionService.setMediaStatus(m.id,'DRAFT'))}>Draft</button></div></div>)}</div><label className={label}>Jenis media<select className={input} value={mediaType} onChange={e=>setMediaType(e.target.value as DemoMediaType)}><option value="PHOTO">Foto</option><option value="VIDEO">Video</option></select></label><label className={label}>Judul<input className={input} value={name} onChange={e=>setName(e.target.value)}/></label><label className={label}>URL media HTTPS<input className={input} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label><label className={label}>URL thumbnail (opsional)<input className={input} value={thumbnail} onChange={e=>setThumbnail(e.target.value)}/></label><label className={label}>Album (opsional)<select className={input} value={albumId} onChange={e=>setAlbumId(e.target.value)}><option value="">Tanpa album</option>{session?.albums.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><button type="button" className={btn} onClick={()=>act(()=>demoSessionService.addMedia({type:mediaType,title:name,url,thumbnailUrl:thumbnail,albumId:albumId||null}))}>Tambah media demo</button></>}
          {votePage&&<><div className="space-y-2">{session?.media.filter(m=>m.status==='PUBLISHED').map(m=><div key={m.id} className="rounded-lg border p-3 dark:text-white"><strong>{m.title}</strong><p className="text-sm">{m.voteCount} suara demo</p><button type="button" disabled={session.votedMediaIds.includes(m.id)} className={btn} onClick={()=>act(()=>demoSessionService.vote(m.id))}>Vote demo</button></div>)}</div>{!session?.media.some(m=>m.status==='PUBLISHED')&&<p className="text-sm text-slate-500">Belum ada karya demo berstatus PUBLISHED. Tambahkan media di menu Galeri/Kirim Karya terlebih dahulu.</p>}</>}
          {regPage&&<><div className="space-y-2">{session?.registrations.map(r=><div key={r.id} className="rounded-lg border p-2 text-sm dark:text-white">{r.name} — {r.unit} · {r.status}<button type="button" className="ml-2 text-xs text-emerald-700" onClick={()=>act(()=>demoSessionService.verifyRegistration(r.id))}>Verifikasi demo</button></div>)}</div><label className={label}>Nama peserta<input className={input} value={name} onChange={e=>setName(e.target.value)}/></label><label className={label}>Pangkalan<input className={input} value={unit} onChange={e=>setUnit(e.target.value)}/></label><button type="button" className={btn} onClick={()=>act(()=>demoSessionService.register({name,unit}))}>Daftar peserta demo</button></>}
          {!albumPage&&!mediaPage&&!votePage&&!regPage&&<div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">Halaman simulasi {page}. Modul ini belum memiliki transaksi simulasi khusus. Tidak ada akses ke data produksi.</div>}
          </>}
          {!!notice&&<p role="status" className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{notice}</p>}
          {!!error&&<p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-800">{error}</p>}
          <p className="text-xs text-slate-500">{session?.albums.length||0} album demo · {session?.media.length||0} media demo · {session?.registrations.length||0} pendaftaran demo</p>
        </div></div></div>
    </div>
  </div>;
};
export default ParticipantPreviewModal;
