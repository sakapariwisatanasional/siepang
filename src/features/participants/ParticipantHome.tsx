/** SiEpang — Participant dashboard. GAS-backed services only; never assume first participant is current user. */
import React, { useEffect, useState } from 'react';
import { CalendarDays, Trophy, QrCode, MapPin, UserRound, Images, Megaphone, Tent, ClipboardCheck, RefreshCw, ArrowRight, ShieldAlert, Award } from 'lucide-react';
import { eventService } from '../../services/eventService';
import { participantService } from '../../services/participantService';
import { authService } from '../../services/authService';
import { PersonalQrModal } from './PersonalQrModal';
import { NavTab } from '../../components/navigation/MobileNavigation';
import type { Participant } from '../../types';

interface ParticipantHomeProps { onNavigate: (tab: NavTab) => void; onOpenScanner: () => void; }
const baseCard = 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm';

function findOwnParticipant(rows: Participant[], user: ReturnType<typeof authService.getCurrentUser>): Participant | null {
  if (!user) return null;
  const id = String(user.id || '').trim();
  const email = String(user.email || '').trim().toLowerCase();
  // Match only an explicit, unique identifier; never show an arbitrary participant's identity/QR.
  const matches = rows.filter(p => (id && (p.id === id || (p as any).user_id === id || (p as any).userId === id)) || (email && String(p.email || '').trim().toLowerCase() === email));
  return matches.length === 1 ? matches[0] : null;
}

export const ParticipantHome: React.FC<ParticipantHomeProps> = ({ onNavigate }) => {
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const reload = async () => {
    setLoading(true); setError('');
    try { await participantService.loadParticipants(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Gagal memuat data peserta dari GAS.'); }
    finally { setLoading(false); setRevision(v => v + 1); }
  };
  useEffect(() => {
    const stop = participantService.subscribe(() => setRevision(v => v + 1));
    void reload();
    return () => { stop(); };
  }, []);
  void revision;

  const user = authService.getCurrentUser();
  const participant = findOwnParticipant(participantService.getParticipants(), user);
  const event = eventService.getCurrentEvent();
  const schedule = eventService.getSchedule().filter(s => !s.archived && s.isPublished !== false).slice(0, 3);
  const notices = eventService.getAnnouncements().slice(0, 2);
  const name = user?.name || 'Peserta';
  const avatar = user?.avatar || participant?.photoUrl || '';
  const tiles: Array<{ title: string; subtitle: string; icon: React.ComponentType<{className?: string}>; tab: NavTab; tint: string }> = [
    { title: 'Profil Saya', subtitle: 'Perbarui biodata', icon: UserRound, tab: 'profile', tint: 'bg-emerald-50 text-emerald-700' },
    { title: 'Jadwal', subtitle: 'Agenda kegiatan', icon: CalendarDays, tab: 'schedule', tint: 'bg-blue-50 text-blue-700' },
    { title: 'Perlombaan', subtitle: 'Daftar kegiatan', icon: Trophy, tab: 'competitions', tint: 'bg-amber-50 text-amber-700' },
    { title: 'Galeri', subtitle: 'Dokumentasi', icon: Images, tab: 'public_gallery', tint: 'bg-purple-50 text-purple-700' },
    { title: 'Peringkat', subtitle: 'Capaian peserta', icon: Award, tab: 'leaderboard', tint: 'bg-rose-50 text-rose-700' },
    { title: 'Informasi', subtitle: 'Info acara', icon: Megaphone, tab: 'public_home', tint: 'bg-cyan-50 text-cyan-700' },
  ];

  return <div className="mx-auto max-w-5xl space-y-5 pb-8">
    <section className={`${baseCard} p-4 sm:p-6`}>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 text-xl font-bold text-emerald-800">
          {avatar && !avatarFailed ? <img src={avatar} alt="Foto profil" className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} /> : name.trim().slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{event?.shortName || 'SiEpang'}</p>
          <h1 className="truncate text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Halo, {name.split(' ')[0]}!</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Layanan dan informasi perkemahan Anda</p>
        </div>
        <button type="button" onClick={() => void reload()} disabled={loading} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10" aria-label="Muat ulang data GAS" title="Muat ulang data GAS"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      {error && <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    </section>

    <section aria-label="Menu peserta" className="space-y-3">
      <h2 className="text-base font-bold text-slate-900 dark:text-white">Layanan Peserta</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {tiles.map(tile => { const Icon = tile.icon; return <button type="button" key={tile.title} onClick={() => onNavigate(tile.tab)} className={`${baseCard} flex min-h-32 flex-col items-start gap-2 p-4 text-left transition hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600`}>
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tile.tint}`}><Icon className="h-5 w-5" /></span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">{tile.title}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{tile.subtitle}</span>
        </button>; })}
      </div>
    </section>

    <section className={`${baseCard} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-900 dark:text-white">Kartu Peserta & Kavling</h2><Tent className="h-5 w-5 text-emerald-600" /></div>
      {participant ? <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-slate-500">Identitas peserta</p><p className="font-semibold text-slate-900 dark:text-white">{participant.name}</p><p className="text-xs text-slate-500">{participant.code || 'Nomor peserta belum tersedia'}</p></div>
          <div><p className="text-xs text-slate-500">Kontingen / Pangkalan</p><p className="font-semibold text-slate-900 dark:text-white">{participant.contingentName || 'Belum ditetapkan'}</p></div>
          <div><p className="text-xs text-slate-500">Kelurahan / lokasi tenda</p><p className="font-semibold text-slate-900 dark:text-white">{participant.subCamp || 'Belum dialokasikan'}</p></div>
          <div><p className="text-xs text-slate-500">Kavling</p><p className="font-semibold text-slate-900 dark:text-white">{participant.tentNumber || 'Belum dialokasikan'}</p></div>
        </div>
        {participant.code ? <button onClick={() => setQrOpen(true)} type="button" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><QrCode className="h-4 w-4" /> Lihat Kartu / QR Peserta</button> : <p className="text-xs text-amber-700">Kode QR belum tersedia dari GAS.</p>}
      </div> : <div className="flex gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><ShieldAlert className="h-5 w-5 shrink-0"/><span>Belum ditemukan data peserta yang cocok secara unik dengan akun login. Silakan periksa pendaftaran atau hubungi panitia. Kartu QR tidak ditampilkan untuk mencegah salah identitas.</span></div>}
    </section>

    <div className="grid gap-4 md:grid-cols-2">
      <section className={`${baseCard} p-4 sm:p-5`}><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-900 dark:text-white">Agenda Kegiatan</h2><CalendarDays className="h-5 w-5 text-blue-600"/></div>
        {schedule.length ? <div className="space-y-2">{schedule.map(s => <button type="button" key={s.id} onClick={() => onNavigate('schedule')} className="flex w-full items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-left dark:bg-slate-800"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{s.title}</p><p className="text-xs text-slate-500">{[s.date, s.time, s.location].filter(Boolean).join(' · ')}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-slate-400" /></button>)}</div> : <p className="text-sm text-slate-500">Belum ada jadwal yang dipublikasikan.</p>}
      </section>
      <section className={`${baseCard} p-4 sm:p-5`}><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-900 dark:text-white">Pengumuman</h2><Megaphone className="h-5 w-5 text-amber-600" /></div>
        {notices.length ? <div className="space-y-3">{notices.map(a => <div key={a.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-sm font-semibold text-slate-900 dark:text-white">{a.title}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{a.content}</p></div>)}</div> : <p className="text-sm text-slate-500">Belum ada pengumuman.</p>}
      </section>
    </div>
    {participant && <PersonalQrModal isOpen={qrOpen} onClose={() => setQrOpen(false)} participant={participant} />}
  </div>;
};
