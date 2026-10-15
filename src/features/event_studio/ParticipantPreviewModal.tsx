/**
 * SiEpang — Isolated, read-only multi-role demonstration.
 * Drop-in replacement for src/features/event_studio/ParticipantPreviewModal.tsx.
 * Intentionally does NOT import services, user lists, API clients, or storage.
 * All contents are clearly labeled examples, never production data.
 */
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, LockKeyhole, MonitorSmartphone, ShieldCheck, Smartphone, X } from 'lucide-react';

interface ParticipantPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Level = 'public' | 'participant' | 'committee';
type MenuItem = { label: string; icon: string; description: string };

type Position = { title: string; menus: MenuItem[] };

const make = (entries: [string, string, string][]): MenuItem[] =>
  entries.map(([label, icon, description]) => ({ label, icon, description }));

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

export const ParticipantPreviewModal: React.FC<ParticipantPreviewModalProps> = ({ isOpen, onClose }) => {
  const [level, setLevel] = useState<Level>('public');
  const [positionIndex, setPositionIndex] = useState(0);
  const [page, setPage] = useState<string | null>(null);
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');

  useEffect(() => { setPage(null); }, [level, positionIndex]);
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (page) setPage(null); else onClose(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, page]);
  if (!isOpen) return null;

  const menus = level === 'public' ? publicMenus : level === 'participant' ? participantMenus : positions[positionIndex].menus;
  const title = level === 'public' ? 'Portal Publik' : level === 'participant' ? 'Dashboard Peserta' : positions[positionIndex].title;
  const selected = menus.find(m => m.label === page);

  return (
    <div role="dialog" aria-modal="true" aria-label="Pusat Demonstrasi SiEpang" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600"/><div><h2 className="font-bold text-slate-900 dark:text-white">Pusat Demonstrasi SiEpang</h2><p className="text-xs text-slate-500">Simulasi aman • tanpa transaksi dan tanpa data pengguna asli</p></div></div>
          <button type="button" onClick={onClose} aria-label="Tutup demonstrasi" className="rounded-lg p-2 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"><X size={20}/></button>
        </header>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
          <label className="flex min-w-[160px] flex-col gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Level pengguna
            <select value={level} onChange={e=>setLevel(e.target.value as Level)} className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:bg-slate-900 dark:text-white"><option value="public">Publik</option><option value="participant">Peserta</option><option value="committee">Committee / Panitia</option></select>
          </label>
          {level==='committee' && <label className="flex min-w-[230px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Jabatan panitia
            <select value={positionIndex} onChange={e=>setPositionIndex(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:bg-slate-900 dark:text-white">{positions.map((p,i)=><option key={p.title} value={i}>{i+1}. {p.title}</option>)}</select>
          </label>}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700"><button type="button" onClick={()=>setDevice('mobile')} aria-label="Tampilan mobile" aria-pressed={device==='mobile'} className={`p-2 ${device==='mobile'?'bg-emerald-100 text-emerald-800':'text-slate-500'}`}><Smartphone size={19}/></button><button type="button" onClick={()=>setDevice('desktop')} aria-label="Tampilan desktop" aria-pressed={device==='desktop'} className={`p-2 ${device==='desktop'?'bg-emerald-100 text-emerald-800':'text-slate-500'}`}><MonitorSmartphone size={19}/></button></div>
        </div>
        <div className="overflow-y-auto bg-slate-100 p-4 dark:bg-slate-900 sm:p-6">
          <div className={`mx-auto min-h-[400px] rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950 ${device==='mobile'?'max-w-[390px]':'max-w-4xl'}`}>
            <div className="flex items-center justify-between rounded-t-2xl bg-emerald-900 p-4 text-white"><div><div className="text-[10px] font-bold tracking-widest text-amber-200">MODE DEMO · READ ONLY</div><h3 className="mt-1 font-bold">{title}</h3></div><Eye size={23}/></div>
            {page ? (
              <div className="space-y-4 p-4"><button type="button" onClick={()=>setPage(null)} className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><ArrowLeft size={16}/> Kembali ke beranda</button><div className="rounded-xl border border-dashed border-emerald-300 p-6 text-center dark:text-white"><div className="text-4xl">{selected?.icon}</div><h4 className="mt-3 font-bold">{page}</h4><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{selected?.description}</p><div className="mt-5 flex items-center justify-center gap-2 text-xs text-amber-700"><LockKeyhole size={15}/> Hanya demonstrasi. Tidak ada aksi simpan, upload, atau vote asli.</div></div></div>
            ) : (
              <div className="p-4"><p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Pilih fitur untuk membuka halaman contoh sesuai level yang dipilih.</p><div className={`grid gap-3 ${device==='mobile'?'grid-cols-2':'grid-cols-3'}`}>{menus.map(m=><button key={m.label} type="button" onClick={()=>setPage(m.label)} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-emerald-500 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"><span className="text-3xl" aria-hidden>{m.icon}</span><div className="mt-2 text-sm font-bold">{m.label}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{m.description}</div></button>)}</div></div>
            )}
          </div>
          <p className="mx-auto mt-3 max-w-xl text-center text-xs text-slate-500">Menu demo adalah ilustrasi alur, bukan bukti bahwa semua modul produksi telah tersedia atau izin GAS sudah aktif. Tampilan ini tidak menggunakan data nyata.</p>
        </div>
      </div>
    </div>
  );
};

export default ParticipantPreviewModal;
