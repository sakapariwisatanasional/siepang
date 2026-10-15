/** SiEpang — Pusat Publikasi & Media. Layout-only navigation refresh.
 * Existing GAS-backed documentation and banner services are unchanged.
 */
import React, { useState } from 'react';
import { Image as ImageIcon, Film, Layers, Award, Globe, ExternalLink, AlertTriangle, ChevronLeft, ShieldCheck, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react';
import { documentationService } from '../../services/documentationService';
import { eventService } from '../../services/eventService';
import { DocumentationManager } from './DocumentationManager';
import { BannerSponsorManager } from './BannerSponsorManager';

interface PublicationMediaCenterProps { onNavigateTab?: (tab: string) => void; }
type Section = 'overview' | 'albums' | 'photos' | 'videos' | 'hero_banner' | 'info_banner' | 'sponsors' | 'homepage_layout' | 'media_health';

const sections: Array<{ id: Exclude<Section,'overview'>; title: string; description: string; icon: typeof Film; group: string }> = [
  { id:'albums', title:'Album Foto', description:'Buat, edit, dan publikasikan album kegiatan.', icon:Layers, group:'Dokumentasi' },
  { id:'photos', title:'Foto Kegiatan', description:'Lihat dan kelola dokumentasi foto.', icon:ImageIcon, group:'Dokumentasi' },
  { id:'videos', title:'Video Kegiatan', description:'Unggah tautan video dan atur publikasi melalui Galeri GAS.', icon:Film, group:'Dokumentasi' },
  { id:'hero_banner', title:'Banner Utama', description:'Atur visual utama pada portal kegiatan.', icon:Sparkles, group:'Tampilan Portal' },
  { id:'info_banner', title:'Banner Informasi', description:'Kelola pengumuman dan banner informasi.', icon:ImageIcon, group:'Tampilan Portal' },
  { id:'sponsors', title:'Sponsor & Mitra', description:'Kelola sponsor dan banner mitra kegiatan.', icon:Award, group:'Tampilan Portal' },
  { id:'homepage_layout', title:'Pratinjau Portal Publik', description:'Buka tampilan yang dilihat pengunjung.', icon:Globe, group:'Tampilan Portal' },
  { id:'media_health', title:'Periksa Sumber Media', description:'Tinjau tautan media yang bermasalah.', icon:ShieldCheck, group:'Alat Bantu' },
];

export const PublicationMediaCenter: React.FC<PublicationMediaCenterProps> = ({onNavigateTab}) => {
  const [activeSection,setActiveSection] = useState<Section>('overview');
  const [notice,setNotice] = useState<string | null>(null);
  const event = eventService.getCurrentEvent();
  const albums = documentationService.getAlbums();
  const photos = documentationService.getMediaItems({type:'PHOTO'});
  const brokenCount = albums.filter(a=> ['PRIVATE','BROKEN_SOURCE','INVALID_URL'].includes(a.folder_access_status)).length +
    photos.filter(p=>['BROKEN_SOURCE','INVALID_URL','PRIVATE'].includes(p.metadata_status)).length;
  const active = sections.find(section=>section.id===activeSection);
  const checkSources = () => {
    const result = documentationService.refreshMediaMetadata();
    setNotice(`Pemeriksaan metadata lokal selesai: ${result.refreshedCount} entri diperiksa, ${result.brokenCount} terindikasi bermasalah. Status publikasi GAS diperiksa terpisah.`);
  };
  return <div className="space-y-5 pb-8">
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Pusat Publikasi & Media</p>
          <h1 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">{active ? active.title : 'Apa yang ingin Anda kelola?'}</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">{active ? active.description : 'Pilih satu pekerjaan di bawah. Hanya fitur yang Anda pilih akan ditampilkan, sehingga halaman lebih mudah digunakan.'}</p>
        </div>
        <button type="button" onClick={()=>onNavigateTab?.('public_home')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
          <Globe size={17}/> Lihat Portal Publik <ExternalLink size={14}/>
        </button>
      </div>
    </div>

    {activeSection !== 'overview' && <button type="button" onClick={()=>setActiveSection('overview')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"><ChevronLeft size={17}/> Kembali ke Pilihan Publikasi</button>}

    {activeSection === 'overview' && <div className="space-y-5">
      {['Dokumentasi','Tampilan Portal','Alat Bantu'].map(group=><section key={group} className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{group}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sections.filter(section=>section.group===group).map(section=>{
            const Icon = section.icon;
            return <button key={section.id} type="button" onClick={()=>setActiveSection(section.id)} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 dark:border-slate-700 dark:bg-slate-900">
              <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"><Icon size={21}/></span>
              <span className="min-w-0"><span className="block font-bold text-slate-900 dark:text-white">{section.title}</span><span className="mt-1 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">{section.description}</span>
                {section.id==='albums' && <span className="mt-2 block text-xs text-slate-500">Album terdaftar: {albums.length}</span>}
                {section.id==='videos' && <span className="mt-2 block text-xs text-slate-500">Jumlah video resmi dilihat di Galeri GAS</span>}
                {section.id==='media_health' && <span className="mt-2 block text-xs text-slate-500">Indikasi masalah lokal: {brokenCount}</span>}
              </span>
            </button>;
          })}
        </div>
      </section>)}
      <p className="text-xs text-slate-500 dark:text-slate-400">Data foto/video resmi dan status Terbit mengikuti Galeri GAS. Ringkasan lama dari memori browser tidak digunakan sebagai angka publikasi.</p>
    </div>}

    {(activeSection==='albums'||activeSection==='photos'||activeSection==='videos') && <DocumentationManager key={activeSection} initialTab={activeSection} embedded/>}
    {(activeSection==='hero_banner'||activeSection==='info_banner'||activeSection==='sponsors') && <BannerSponsorManager key={activeSection} initialTab={activeSection==='sponsors'?'sponsors':activeSection==='info_banner'?'info_banners':'hero'}/>}
    {activeSection==='media_health' && <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-900 dark:text-white">{brokenCount>0?<AlertTriangle className="text-amber-600" size={21}/>:<CheckCircle2 className="text-emerald-600" size={21}/>}<h2 className="font-bold">{brokenCount} indikasi masalah pada metadata lokal</h2></div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Pemeriksaan ini hanya melihat metadata lama dalam sesi aplikasi, bukan bukti bahwa seluruh tautan Galeri GAS dapat dibuka oleh pengunjung.</p>
      <button type="button" onClick={checkSources} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-white"><RefreshCw size={16}/> Periksa Metadata</button>
      {notice&&<p role="status" className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{notice}</p>}
    </section>}
    {activeSection==='homepage_layout' && <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="font-bold text-slate-900 dark:text-white">Portal Publik Kegiatan</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Pratinjau menampilkan konten yang tersedia bagi pengunjung tanpa masuk ke panel admin.</p>
      <p className="mt-3 break-all text-xs text-slate-500">Event aktif: {event.id}</p>
      <button type="button" onClick={()=>onNavigateTab?.('public_home')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"><Globe size={16}/> Buka Portal Publik <ExternalLink size={14}/></button>
    </section>}
  </div>;
};
