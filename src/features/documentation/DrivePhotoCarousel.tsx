import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Image as ImageIcon, Loader2, Pause, Play, RefreshCw } from 'lucide-react';
import { apiTransport } from '../../services/apiTransport';

type Photo = { id: string; title: string; thumbnail_url: string; fallback_url: string; source_url: string };
type CarouselData = { carousel: boolean; configured: boolean; items: Photo[]; folder_url?: string; truncated?: boolean; message?: string };
const https = (value?: string) => { try { const u = new URL(value || ''); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };

const SlideImage: React.FC<{ photo: Photo }> = ({ photo }) => {
  const [attempt, setAttempt] = useState(0);
  const urls = [https(photo.thumbnail_url), https(photo.fallback_url)];
  if (attempt > 1 || !urls[attempt]) return <div role="status" className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-slate-200"><ImageIcon className="h-10 w-10"/><p>Pratinjau foto belum dapat dimuat.</p><a href={https(photo.source_url)} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-900">Buka foto di Drive</a></div>;
  return <img src={urls[attempt]} onError={() => setAttempt(x => x + 1)} alt={photo.title} referrerPolicy="no-referrer" decoding="async" className="h-full w-full object-contain"/>;
};

/** Photo list comes exclusively from the configured GAS folder, never browser-generated IDs. */
export const DrivePhotoCarousel: React.FC = () => {
  const [data, setData] = useState<CarouselData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const photos = data?.items || [];

  useEffect(() => {
    let active = true; setLoading(true); setError('');
    apiTransport.send<CarouselData>('gallery.public.list', { view: 'DRIVE_CAROUSEL' }, {skipAuth: true, timeoutMs: 45000}).then(result => {
      if (!result.ok || !result.data) throw new Error(result.error?.message || 'Foto dokumentasi gagal dimuat dari GAS.');
      if (!result.data.carousel || !Array.isArray(result.data.items)) throw new Error('Backend carousel belum tersedia. Perbarui deployment GAS.');
      if (active) {setData(result.data); setIndex(0);}
    }).catch(e => {if (active) setError(e instanceof Error ? e.message : 'Gagal membaca dokumentasi.');})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [revision]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPlaying(!media.matches);
    const reduced = () => {if (media.matches) setPlaying(false);};
    const change = () => setVisible(!document.hidden);
    media.addEventListener('change', reduced); document.addEventListener('visibilitychange', change);
    return () => {media.removeEventListener('change', reduced); document.removeEventListener('visibilitychange', change);};
  }, []);
  useEffect(() => {
    if (!playing || interacting || !visible || photos.length < 2) return;
    const timer = window.setInterval(() => setIndex(x => (x + 1) % photos.length), 6000);
    return () => window.clearInterval(timer);
  }, [playing, interacting, visible, photos.length]);
  const move = (delta: number) => {setPlaying(false); setIndex(x => (x + delta + photos.length) % photos.length);};
  const current = photos[index];

  return <div role="region" aria-roledescription="carousel" aria-label="Carousel dokumentasi kegiatan" className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><h3 className="font-bold text-[#203C33] dark:text-white">Momen Perkemahan</h3><p className="text-xs text-slate-500">Dokumentasi foto dari folder resmi panitia</p></div><button type="button" disabled={loading} onClick={() => setRevision(x => x + 1)} className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-semibold text-emerald-800 disabled:opacity-40 dark:text-emerald-200"><RefreshCw className="h-4 w-4"/>Muat ulang</button></div>
    {loading && <p role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin"/>Memuat foto dokumentasi...</p>}
    {error && <p role="alert" className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error} Gunakan Muat ulang untuk mencoba kembali.</p>}
    {!loading && !error && !photos.length && <p role="status" className="p-8 text-center text-sm text-slate-500">{data?.configured ? 'Belum ada foto dengan akses publik yang dapat ditampilkan dari folder ini.' : data?.message || 'Carousel belum dikonfigurasi di GAS.'}</p>}
    {!loading && !error && current && <>
      <div className="relative aspect-[4/3] bg-[#132B24] sm:aspect-[16/9]" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={e => {if (!e.currentTarget.contains(e.relatedTarget as Node)) setInteracting(false);}}
        onTouchStart={e => {touch.current = {x:e.touches[0].clientX,y:e.touches[0].clientY};setPlaying(false);}}
        onTouchEnd={e => {if (!touch.current) return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;touch.current=null;if (Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)) move(dx<0?1:-1);}}>
        <SlideImage key={current.id} photo={current}/>
        {photos.length > 1 && <><button type="button" aria-label="Foto sebelumnya" onClick={() => move(-1)} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"><ChevronLeft/></button><button type="button" aria-label="Foto berikutnya" onClick={() => move(1)} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"><ChevronRight/></button></>}
      </div>
      <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><p className="min-w-0 break-words text-sm font-semibold text-[#203C33] dark:text-white">{current.title}</p><span className="shrink-0 text-xs text-slate-500" aria-live={playing?'off':'polite'}>{index+1} / {photos.length}</span></div>
        <div className="flex flex-wrap items-center gap-2">{photos.length > 1 && <button type="button" onClick={() => setPlaying(x => !x)} aria-pressed={playing} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#C62828] px-4 text-xs font-semibold text-white">{playing?<Pause className="h-4 w-4"/>:<Play className="h-4 w-4"/>}{playing?'Jeda':'Putar otomatis'}</button>}
          <a href={https(current.source_url)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200"><ExternalLink className="h-4 w-4"/>Buka foto</a>
          {https(data?.folder_url) && <a href={https(data?.folder_url)} target="_blank" rel="noopener noreferrer" className="min-h-11 px-3 py-3 text-xs font-semibold text-emerald-800 underline dark:text-emerald-200">Semua foto di Drive</a>}
        </div><p className="text-[11px] text-slate-500">Geser foto ke kiri atau kanan di HP.{data?.truncated?' Menampilkan hingga 60 foto; buka folder Drive untuk dokumentasi lainnya.':''}</p>
      </div>
    </>}
  </div>;
};
