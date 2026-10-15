/**
 * @license
 * SiEpang - General Event Settings Editor
 * Allows authorized admins to configure event identity, dates, organizer,
 * capacity, venue, status, and contacts without spreadsheet edits.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  MapPin,
  Building2,
  Users,
  Layers,
  Phone,
  Save,
  ShieldAlert,
  Info,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ArrowRight,
  Image as ImageIcon,
  Eye,
} from 'lucide-react';
import { eventStudioService } from '../../services/eventStudioService';
import { EventCategory, EventStatus, OrganizationalLevel, ParticipationScope } from '../../types';

export const GeneralEventEditor: React.FC = () => {
  const event = eventStudioService.getEvent();
  type SettingsSection = 'identity' | 'dates' | 'registration' | 'contacts' | 'media' | 'publication';
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
  const sections: { id: SettingsSection; title: string; description: string; icon: React.ElementType }[] = [
    { id: 'identity', title: 'Identitas Event', description: 'Nama, penyelenggara dan profil kegiatan', icon: Building2 },
    { id: 'dates', title: 'Tanggal & Lokasi', description: 'Hari pelaksanaan, lokasi dan bumi perkemahan', icon: Calendar },
    { id: 'registration', title: 'Pendaftaran', description: 'Jadwal pendaftaran dan kuota peserta', icon: Users },
    { id: 'contacts', title: 'Kontak Panitia', description: 'Medis, keamanan, helpdesk dan informasi', icon: Phone },
    { id: 'media', title: 'Logo & Banner', description: 'Identitas visual resmi kegiatan', icon: ImageIcon },
    { id: 'publication', title: 'Publikasi Portal', description: 'Status operasional dan penayangan event', icon: Eye },
  ];
  const [isSaving, setIsSaving] = useState(false);
  const [eventLoadStatus, setEventLoadStatus] = useState(eventStudioService.getEventLoadStatus());
  const [isReloading, setIsReloading] = useState(false);
  const hasEditedForm = useRef(false);
  const buildForm = (event: ReturnType<typeof eventStudioService.getEvent>) => ({
    name: event.name,
    shortName: event.shortName,
    eventCode: event.eventCode || '',
    category: event.category,
    organizationalLevel: event.organizationalLevel || ('' as OrganizationalLevel),
    organizer: event.organizer || '',
    description: event.description || '',
    theme: event.theme,
    startDate: event.startDate,
    endDate: event.endDate,
    registrationStart: event.registrationStart || '',
    registrationEnd: event.registrationEnd || '',
    location: event.location,
    venue: event.venue || '',
    campGround: event.campGround,
    participantCapacity: event.participantCapacity ?? 0,
    status: event.status || ('' as EventStatus),
    participation_scope: (event.participation_scope || 'CHILD_ORGANIZATIONS') as ParticipationScope,
    allowed_organization_ids: event.allowed_organization_ids ?? [],
    logoUrl: event.logoUrl || '',
    bannerUrl: event.bannerUrl || '',
    contacts: {
      medical: event.contacts?.medical || '',
      security: event.contacts?.security || '',
      info: event.contacts?.info || '',
      emergency: event.contacts?.emergency || '',
      helpdesk: event.contacts?.helpdesk || '',
    },
  });
  const [formData, setFormState] = useState(() => buildForm(event));
  const setFormData: typeof setFormState = (value) => {
    hasEditedForm.current = true;
    setFormState(value);
  };

  const [saveState, setSaveState] = useState(eventStudioService.getSaveState());

  useEffect(() => {
    const unsub = eventStudioService.subscribe(() => {
      setSaveState(eventStudioService.getSaveState());
      const nextStatus = eventStudioService.getEventLoadStatus();
      setEventLoadStatus(nextStatus);
      if (nextStatus.ready && !hasEditedForm.current) {
        setFormState(buildForm(eventStudioService.getEvent()));
      }
    });
    return () => {
      unsub();
    };
  }, []);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const statusOptions: { value: EventStatus; label: string; color: string; desc: string }[] = [
    { value: 'DRAFT', label: 'DRAFT', color: 'bg-slate-700 text-slate-200 border-slate-600', desc: 'Penyusunan awal panitia, belum dapat diakses peserta' },
    { value: 'REGISTRATION', label: 'REGISTRASI', color: 'bg-sky-950 text-sky-300 border-sky-500/50', desc: 'Pendaftaran kontingen dan peserta dibuka' },
    { value: 'UPCOMING', label: 'AKAN DATANG', color: 'bg-amber-950 text-amber-300 border-amber-500/50', desc: 'Verifikasi berkas selesai, menunggu hari-H buper' },
    { value: 'ONGOING', label: 'SEDANG BERJALAN', color: 'bg-emerald-950 text-emerald-300 border-emerald-500/50', desc: 'Kemah aktif, operasional presensi, lomba & voting' },
    { value: 'COMPLETED', label: 'SELESAI', color: 'bg-purple-950 text-purple-300 border-purple-500/50', desc: 'Kegiatan usai, piagam dan pelaporan dapat diunduh' },
    { value: 'ARCHIVED', label: 'DIARSIPKAN', color: 'bg-stone-900 text-stone-400 border-stone-700', desc: 'Arsip kegiatan, akses baca-saja' },
  ];

  const handleFieldChange = (updates: Partial<typeof formData>) => {
    const next = { ...formData, ...updates };
    setFormData(next);
    // This editor saves explicitly. Avoid a competing debounced autosave.
    eventStudioService.markDirty(next, false);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      if (!formData.name.trim() || !formData.startDate || !formData.endDate) {
        throw new Error('Nama event, tanggal mulai, dan tanggal selesai harus diisi.');
      }
      if (formData.endDate < formData.startDate) {
        throw new Error('Tanggal selesai tidak boleh mendahului tanggal mulai.');
      }
      if (!eventStudioService.getEventLoadStatus().ready) {
        throw new Error('Pengaturan event belum berhasil dimuat dari GAS. Muat ulang data terlebih dahulu.');
      }
      await eventStudioService.updateGeneralSettings(formData);
      hasEditedForm.current = false;
      setFormState(buildForm(eventStudioService.getEvent()));
      setToast({ msg: '✅ Pengaturan umum event berhasil disimpan ke cloud database!', type: 'success' });
    } catch (err: any) {
      setToast({ msg: `❌ Gagal menyimpan: ${err.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (!eventLoadStatus.ready) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-slate-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-slate-100">
        <h2 className="font-bold text-base">Pengaturan Event belum tersedia</h2>
        <p className="mt-2 text-sm">{eventLoadStatus.error || 'Sedang mengambil data event resmi dari Google Apps Script. Form dinonaktifkan untuk mencegah penyimpanan data sementara.'}</p>
        <button type="button" disabled={isReloading} onClick={async () => {
          setIsReloading(true);
          try { await eventStudioService.refreshGeneralEvent(); }
          catch (error) { console.error('Gagal memuat data event:', error); }
          finally { setIsReloading(false); }
        }} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-white text-sm font-bold disabled:opacity-50">
          {isReloading ? 'Memuat…' : 'Muat Ulang Data Event'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="rounded-[28px] border border-[#ECECEF] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#141418] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Event Studio / Pengaturan Umum</p>
            <h1 className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">{formData.name || 'Pengaturan Event'}</h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Seluruh perubahan menggunakan data event dari Google Apps Script.</p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Data event GAS dimuat
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-700 dark:text-slate-200">
          {formData.startDate && formData.endDate && <span className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-white/10">{formData.startDate} — {formData.endDate}</span>}
          {formData.status && <span className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-white/10">{formData.status}</span>}
          {formData.participantCapacity > 0 && <span className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-white/10">Kapasitas: {formData.participantCapacity.toLocaleString('id-ID')} peserta</span>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs dark:border-white/10">
          <span className="text-slate-500 dark:text-slate-400">{saveState.status === 'Unsaved Changes' ? 'Ada perubahan belum disimpan' : saveState.status === 'Saving…' ? 'Sedang menyimpan' : saveState.status === 'Save Failed' ? 'Penyimpanan terakhir gagal' : 'Data siap dikelola'}</span>
          <button type="button" disabled={isReloading || isSaving || saveState.status === 'Unsaved Changes'} onClick={async () => {
            setIsReloading(true);
            try { await eventStudioService.refreshGeneralEvent(); }
            catch (error) { console.error('Gagal memuat event:', error); }
            finally { setIsReloading(false); }
          }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10">
            <RefreshCw className="h-4 w-4" /> {isReloading ? 'Memuat...' : 'Muat Ulang dari GAS'}
          </button>
        </div>
      </div>
      {activeSection === null ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ id, title, description, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActiveSection(id)} className="group flex min-h-36 flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-500 hover:shadow-md dark:border-white/10 dark:bg-[#141418] dark:hover:border-emerald-500">
              <Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <span className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{title}</span>
              <span className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</span>
              <ArrowRight className="mt-auto self-end text-slate-400 group-hover:text-emerald-600" size={17} />
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#141418] sm:p-5">
          <button type="button" onClick={() => setActiveSection(null)} className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"><ChevronLeft className="h-4 w-4" /> Kembali ke Pilihan Pengaturan</button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{sections.find(section => section.id === activeSection)?.title}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sections.find(section => section.id === activeSection)?.description}</p>
        </div>
      )}
      {toast && (
        <div className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-lg ${
          toast.type === 'error'
            ? 'bg-rose-950/90 border-rose-500/50 text-rose-300'
            : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
        }`}>
          <span>{toast.msg}</span>
          <button type="button" onClick={() => setToast(null)} className="hover:text-white">✕</button>
        </div>
      )}

      {(activeSection === 'publication') && (
        <>
      {/* 1. Status Lifecycle Selector */}
      <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#F47743]" />
              <span>Status Operasional Event</span>
            </h2>
            <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-0.5">
              Menentukan hak akses sistem dan alur kegiatan kepramukaan saat ini.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black border uppercase tracking-wider bg-pink-50 text-[#F47743] border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800">
            {formData.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {statusOptions.map(st => (
            <button
              key={st.value}
              type="button"
              onClick={() => setFormData({ ...formData, status: st.value })}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                formData.status === st.value
                  ? `${st.color} font-bold ring-2 ring-[#E1306C]/40 scale-102 shadow-xs`
                  : 'bg-[#FAFAFA] border-[#ECECEF] text-[#6B7280] hover:bg-gray-100 dark:bg-white/5 dark:border-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-black">{st.label}</div>
              <div className="text-[9px] opacity-75 mt-1 leading-tight line-clamp-2">{st.desc}</div>
            </button>
          ))}
        </div>
      </div>

        </>
      )}
      {(activeSection === 'identity') && (
        <>
      {/* 2. Core Identity Fields */}
      <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#F47743]" />
          <span>Identitas Event & Penyelenggara</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="text-[#171717] dark:text-slate-300 font-semibold block mb-1.5">Nama Resmi Event Perkemahan:</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white font-medium focus:border-[#F47743] focus:outline-none"
              placeholder="Contoh: Jambore Ranting / Cabang 2026"
              required
            />
          </div>

          <div>
            <label className="text-[#171717] dark:text-slate-300 font-semibold block mb-1.5">Nama Pendek / Singkatan:</label>
            <input
              type="text"
              value={formData.shortName}
              onChange={e => setFormData({ ...formData, shortName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white font-medium focus:border-[#F47743] focus:outline-none"
              placeholder="Contoh: Jamcab BWI 2026"
              required
            />
          </div>

          <div>
            <label className="text-[#171717] dark:text-slate-300 font-semibold block mb-1.5">Kode Unik Event (ID Pas Digital):</label>
            <input
              type="text"
              value={formData.eventCode}
              onChange={e => setFormData({ ...formData, eventCode: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#F47743] font-mono font-bold focus:border-[#F47743] focus:outline-none"
              placeholder="JC-BWI-2026"
              required
            />
          </div>

          <div>
            <label className="text-[#171717] dark:text-slate-300 font-semibold block mb-1.5">Kategori / Jenis Perkemahan:</label>
            <select
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value as EventCategory })}
              className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white focus:border-[#F47743] focus:outline-none"
            >
              <option value="Jambore">Jambore (Penggalang)</option>
              <option value="Raimuna">Raimuna (Penegak/Pandega)</option>
              <option value="Lomba Tingkat">Lomba Tingkat (LT-I s.d. LT-V)</option>
              <option value="Perkemahan Wirakarya">Perkemahan Wirakarya / Bakti</option>
              <option value="Persami">Persami (Sabtu Minggu)</option>
              <option value="Kemah Bakti">Kemah Bakti Saka</option>
            </select>
          </div>

          <div className="sm:col-span-2 pt-2 space-y-2">
            <label htmlFor="siepang-organizer" className="text-[#171717] dark:text-slate-300 font-semibold block mb-1.5">
              Nama Penyelenggara Kegiatan:
            </label>
            <input
              id="siepang-organizer"
              type="text"
              value={formData.organizer}
              onChange={e => setFormData({ ...formData, organizer: e.target.value })}
              maxLength={180}
              className="w-full px-3.5 py-3 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white font-medium focus:border-[#F47743] focus:outline-none"
              placeholder="Contoh: Kwartir Ranting Sawangan / Event Organizer / Sekolah"
            />
            <p className="text-[11px] text-[#6B7280] dark:text-slate-400 leading-relaxed">
              Nama penyelenggara dapat berupa organisasi Pramuka, sekolah, komunitas, atau Event Organizer.
              Tidak perlu memilih tingkatan kwartir. Data organisasi lama tetap dipertahankan demi kompatibilitas.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="text-[#171717] dark:text-slate-300 font-semibold block mb-1.5">Tema Resmi Perkemahan:</label>
            <input
              type="text"
              value={formData.theme}
              onChange={e => setFormData({ ...formData, theme: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-amber-700 dark:text-amber-300 font-medium italic focus:border-[#F47743] focus:outline-none"
              placeholder="Pramuka Tangguh, Berkarakter & Melek Digital Menuju Generasi Emas"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[#171717] dark:text-slate-300 font-semibold block mb-1.5">Deskripsi Lengkap Kegiatan:</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white focus:border-[#F47743] focus:outline-none"
              placeholder="Jelaskan tujuan, sasaran peserta, dan keunikan kegiatan perkemahan ini..."
            />
          </div>
        </div>
      </div>

      {/* Model A: legacy participation scope is retained silently for GAS compatibility.
          Do not overwrite participation_scope or allowed_organization_ids while editing identity.
          Existing server-side restrictions, if any, require separate backend migration. */}
      <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100 text-xs leading-relaxed">
        <strong>Catatan kompatibilitas Model A:</strong> formulir hierarki kwartir disembunyikan.
        Pengaturan cakupan pendaftaran lama tetap tersimpan dan mungkin masih diterapkan oleh backend.
        Perubahan aturan siapa yang boleh mendaftar akan dilakukan secara terpisah setelah pemeriksaan GAS.
      </div>

        </>
      )}
      {(activeSection === 'media') && (
        <>
      {/* 2c. Branding Media (Logo & Banner) */}
      <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>Identitas Visual & Media Promosi (Logo & Banner)</span>
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Terapkan logo penyelenggara atau event dan banner kegiatan untuk portal peserta dan kartu pengenal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Logo Input & Preview */}
          <div className="space-y-2">
            <label className="text-slate-700 dark:text-slate-300 font-semibold block">URL Logo Resmi Event:</label>
            <input
              type="text"
              value={formData.logoUrl}
              onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white font-mono text-xs focus:border-emerald-500 focus:bg-white dark:focus:bg-black/60 focus:outline-none"
              placeholder="https://..."
            />
            <div className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/30 border border-[#ECECEF] dark:border-white/5 flex items-center gap-3">
              <img
                src={formData.logoUrl}
                alt="Logo Event Preview"
                className="w-12 h-12 rounded-xl object-cover border border-[#ECECEF] dark:border-white/10 bg-white dark:bg-black/50"
              />
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Pratinjau Logo</span>
                <p>Tampil pada header aplikasi, kartu pengenal, dan piagam.</p>
              </div>
            </div>
          </div>

          {/* Banner Input & Preview */}
          <div className="space-y-2">
            <label className="text-slate-700 dark:text-slate-300 font-semibold block">URL Banner / Spanduk Kegiatan:</label>
            <input
              type="text"
              value={formData.bannerUrl}
              onChange={e => setFormData({ ...formData, bannerUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white font-mono text-xs focus:border-emerald-500 focus:bg-white dark:focus:bg-black/60 focus:outline-none"
              placeholder="https://..."
            />
            <div className="h-20 rounded-2xl overflow-hidden border border-[#ECECEF] dark:border-white/10 relative bg-slate-100 dark:bg-black/40">
              <img
                src={formData.bannerUrl}
                alt="Banner Event Preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent flex items-end p-2 text-[10px] text-white font-bold">
                Pratinjau Banner Beranda
              </div>
            </div>
          </div>
        </div>
      </div>

        </>
      )}
      {(activeSection === 'dates' || activeSection === 'registration') && (
        <>
      {/* 3. Dates & Capacity */}
      <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <span>Jadwal Waktu & Kuota Peserta</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {activeSection === 'dates' && (
            <>
          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1.5">Mulai Kemah:</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2.5 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white focus:border-emerald-500 focus:bg-white dark:focus:bg-black/60 focus:outline-none"
              required
            />
          </div>

            </>
          )}
          {activeSection === 'dates' && (
            <>
          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1.5">Selesai Kemah:</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={e => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-3 py-2.5 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white focus:border-emerald-500 focus:bg-white dark:focus:bg-black/60 focus:outline-none"
              required
            />
          </div>

            </>
          )}
          {activeSection === 'registration' && (
            <>
          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1.5">Buka Pendaftaran:</label>
            <input
              type="date"
              value={formData.registrationStart}
              onChange={e => setFormData({ ...formData, registrationStart: e.target.value })}
              className="w-full px-3 py-2.5 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white focus:border-emerald-500 focus:bg-white dark:focus:bg-black/60 focus:outline-none"
            />
          </div>

            </>
          )}
          {activeSection === 'registration' && (
            <>
          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1.5">Tutup Pendaftaran:</label>
            <input
              type="date"
              value={formData.registrationEnd}
              onChange={e => setFormData({ ...formData, registrationEnd: e.target.value })}
              className="w-full px-3 py-2.5 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white focus:border-emerald-500 focus:bg-white dark:focus:bg-black/60 focus:outline-none"
            />
          </div>

            </>
          )}
          {activeSection === 'registration' && (
            <>
          <div className="sm:col-span-2">
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1.5">Kapasitas Maksimal Peserta:</label>
            <div className="relative">
              <input
                type="number"
                min="10"
                max="50000"
                value={formData.participantCapacity || ''}
                onChange={e => setFormData({ ...formData, participantCapacity: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white font-mono focus:border-emerald-500 focus:bg-white dark:focus:bg-black/60 focus:outline-none"
              />
              <span className="absolute right-3.5 top-2.5 text-slate-400 dark:text-slate-500 text-xs">Orang</span>
            </div>
          </div>

            </>
          )}
          {activeSection === 'dates' && (
            <>
          <div className="sm:col-span-2">
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1.5">Bumi Perkemahan / Venue:</label>
            <input
              type="text"
              value={formData.campGround}
              onChange={e => setFormData({ ...formData, campGround: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-2xl text-[#171717] dark:text-white focus:border-emerald-500 focus:bg-white dark:focus:bg-black/60 focus:outline-none"
              placeholder="Contoh: Bumi Perkemahan Utama"
            />
          </div>
            </>
          )}
        </div>
      </div>

        </>
      )}
      {(activeSection === 'contacts') && (
        <>
      {/* 4. Important Contacts */}
      <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-[#171717] dark:text-white tracking-tight flex items-center gap-2">
          <Phone className="w-4 h-4 text-emerald-500" />
          <span>Kontak Darurat & Helpdesk Panitia</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Posko Medis / Kesehatan:</label>
            <input
              type="text"
              value={formData.contacts.medical}
              onChange={e => setFormData({ ...formData, contacts: { ...formData.contacts, medical: e.target.value } })}
              className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Pos Keamanan Buper:</label>
            <input
              type="text"
              value={formData.contacts.security}
              onChange={e => setFormData({ ...formData, contacts: { ...formData.contacts, security: e.target.value } })}
              className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Pusat Informasi:</label>
            <input
              type="text"
              value={formData.contacts.info}
              onChange={e => setFormData({ ...formData, contacts: { ...formData.contacts, info: e.target.value } })}
              className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Piket Darurat 24 Jam:</label>
            <input
              type="text"
              value={formData.contacts.emergency}
              onChange={e => setFormData({ ...formData, contacts: { ...formData.contacts, emergency: e.target.value } })}
              className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-rose-600 dark:text-rose-400 font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Helpdesk Kontingen / Sekretariat:</label>
            <input
              type="text"
              value={formData.contacts.helpdesk}
              onChange={e => setFormData({ ...formData, contacts: { ...formData.contacts, helpdesk: e.target.value } })}
              className="w-full px-3 py-2 bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/10 rounded-xl text-[#171717] dark:text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

        </>
      )}
      {activeSection !== null && (
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
            saveState.status === 'Saving…'
              ? 'bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/40 animate-pulse'
              : saveState.status === 'Save Failed'
              ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/40'
              : saveState.status === 'Unsaved Changes'
              ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40'
              : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
          }`}>
            {saveState.status === 'Saving…' ? (
              <div className="w-3.5 h-3.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            ) : saveState.status === 'Save Failed' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            ) : saveState.status === 'Unsaved Changes' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            )}
            <span>
              {saveState.status === 'Saving…' && 'Saving…'}
              {saveState.status === 'Save Failed' && 'Save Failed'}
              {saveState.status === 'Unsaved Changes' && 'Unsaved Changes'}
              {saveState.status === 'Saved ✓' && `Saved ✓ (${saveState.lastSaved || 'Tersimpan'})`}
            </span>
          </div>

          {saveState.status === 'Save Failed' && (
            <button
              type="button"
              onClick={() => handleSave()}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow animate-pulse"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all active:scale-98 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Menyimpan ke Backend…' : 'Simpan Pengaturan Umum Event'}</span>
        </button>
      </div>
      )}
    </form>
  );
};
