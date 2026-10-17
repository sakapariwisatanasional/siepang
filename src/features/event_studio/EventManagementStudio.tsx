/**
 * @license
 * SiEpang - Comprehensive Event Management Studio
 *
 * UI-only navigation/layout revision:
 * - Dashboard hanya menampilkan grid navigator.
 * - Klik kartu membuka halaman fitur penuh, bukan section panjang di bawah dashboard.
 * - Seluruh service/GAS call tetap menggunakan implementasi existing.
 * - Tidak mengubah kontrak API, Spreadsheet, Drive, atau offline engine.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Tent,
  Trophy,
  Users,
  Zap,
  Settings,
  CheckCircle2,
  Smartphone,
  Save,
  History,
  ShieldCheck,
  Sparkles,
  FileText,
  Sliders,
  QrCode,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  LayoutDashboard,
  Image as ImageIcon,
  UsersRound,
  CalendarDays,
} from 'lucide-react';

import { eventStudioService } from '../../services/eventStudioService';
import { GeneralEventEditor } from './GeneralEventEditor';
import { ScheduleActivityEditor } from './ScheduleActivityEditor';
import { CampsiteManager } from './CampsiteManager';
import { CompetitionStudio } from './CompetitionStudio';
import { RegistrationContingentEditor } from './RegistrationContingentEditor';
import { PointsBadgesCheckpointEditor } from './PointsBadgesCheckpointEditor';
import { FeatureSettingsEditor } from './FeatureSettingsEditor';
import { CustomPagesAndContacts } from './CustomPagesAndContacts';
import { EventReadinessCenter } from './EventReadinessCenter';
import { ParticipantPreviewModal } from './ParticipantPreviewModal';
import { VisitorManagementStudio } from '../visitors/VisitorManagementStudio';
import { PublicationMediaCenter } from './PublicationMediaCenter';
import { QrPrintCenterModal } from '../documents/QrPrintCenterModal';
import { NavTab } from '../../components/navigation/MobileNavigation';

export type StudioSection =
  | 'overview'
  | 'readiness'
  | 'general'
  | 'schedule'
  | 'campsite'
  | 'competitions'
  | 'registration'
  | 'points_badges'
  | 'features'
  | 'pages_contacts'
  | 'visitors'
  | 'publication_media'
  | 'documentation'
  | 'banners_sponsors'
  | 'audit';

interface EventManagementStudioProps {
  onNavigateToTab?: (tab: NavTab) => void;
}

type MenuItem = {
  id: StudioSection;
  label: string;
  icon: string;
  description: string;
};

const MENU_ITEMS: MenuItem[] = [
  { id: 'overview', label: 'Ikhtisar', icon: '▦', description: 'Ringkasan kondisi event' },
  { id: 'readiness', label: 'Kesiapan Event', icon: '✓', description: 'Cek kesiapan operasional' },
  { id: 'general', label: 'Pengaturan Umum', icon: '⚙', description: 'Identitas dan status event' },
  { id: 'features', label: 'Sakelar Fitur', icon: '☷', description: 'Aktifkan modul kegiatan' },
  { id: 'schedule', label: 'Jadwal & Aktivitas', icon: '▦', description: 'Agenda dan kegiatan' },
  { id: 'registration', label: 'Peserta & Kontingen', icon: '♧', description: 'Pendaftaran dan kontingen' },
  { id: 'competitions', label: 'Lomba & Unjuk Karya', icon: '🏆', description: 'Lomba, juri dan voting' },
  { id: 'points_badges', label: 'Poin, XP & Checkpoint', icon: '⚡', description: 'Poin, lencana dan QR' },
  { id: 'campsite', label: 'Kavling Buper', icon: '⛺', description: 'Kavling dan tata ruang' },
  { id: 'visitors', label: 'Buku Tamu / Visitor', icon: '▤', description: 'Kunjungan dan tamu' },
  { id: 'publication_media', label: 'Photo, Video & Publikasi', icon: '▧', description: 'Media dan publikasi resmi' },
  { id: 'pages_contacts', label: 'Bantuan & Kontak', icon: 'ⓘ', description: 'Panduan dan kontak posko' },
];

type StudioCategory = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  sections: StudioSection[];
};

const STUDIO_CATEGORIES: StudioCategory[] = [
  { id: 'management', label: 'Manajemen Event', description: 'Ringkasan dan konfigurasi event', icon: LayoutDashboard, sections: ['overview', 'readiness', 'general', 'features'] },
  { id: 'activities', label: 'Kegiatan', description: 'Agenda dan aktivitas perkemahan', icon: CalendarDays, sections: ['schedule'] },
  { id: 'participants', label: 'Peserta & Kontingen', description: 'Pendaftaran dan pengelolaan peserta', icon: UsersRound, sections: ['registration'] },
  { id: 'achievements', label: 'Lomba & Prestasi', description: 'Kompetisi, penilaian, poin dan XP', icon: Trophy, sections: ['competitions', 'points_badges'] },
  { id: 'operations', label: 'Operasional', description: 'Kavling dan kunjungan', icon: Tent, sections: ['campsite', 'visitors'] },
  { id: 'publication', label: 'Publikasi & Dokumen', description: 'Media, publikasi, bantuan dan kontak', icon: ImageIcon, sections: ['publication_media', 'pages_contacts'] },
];

export const EventManagementStudio: React.FC<EventManagementStudioProps> = ({
  onNavigateToTab,
}) => {
  const [activeSection, setActiveSection] = useState<StudioSection>('overview');
  const [activeCategory, setActiveCategory] = useState<string>('management');
  const [saveState, setSaveState] = useState(eventStudioService.getSaveState());
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [showQrPrintCenter, setShowQrPrintCenter] = useState(false);

  const event = eventStudioService.getEvent();

  useEffect(() => {
    const unsub = eventStudioService.subscribe(() => {
      setSaveState(eventStudioService.getSaveState());
    });
    return () => unsub();
  }, []);

  // Setiap pergantian fitur kembali ke posisi paling atas.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeSection]);

  const handleManualSave = () => {
    eventStudioService.saveAll();
  };

  const openSection = (section: StudioSection) => {
    setShowAuditDrawer(false);
    setActiveSection(section);
  };

  const goBackToDashboard = () => {
    setShowAuditDrawer(false);
    setActiveSection('overview');
  };

  const activeMenu = useMemo(
    () => MENU_ITEMS.find(item => item.id === activeSection) ?? MENU_ITEMS[0],
    [activeSection],
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'readiness':
        return <EventReadinessCenter onNavigateSection={openSection} />;
      case 'general':
        return <GeneralEventEditor />;
      case 'schedule':
        return <ScheduleActivityEditor />;
      case 'campsite':
        return <CampsiteManager />;
      case 'competitions':
        return <CompetitionStudio />;
      case 'registration':
        return <RegistrationContingentEditor />;
      case 'points_badges':
        return <PointsBadgesCheckpointEditor />;
      case 'features':
        return <FeatureSettingsEditor />;
      case 'pages_contacts':
        return <CustomPagesAndContacts />;
      case 'visitors':
        return <VisitorManagementStudio />;
      case 'publication_media':
      case 'documentation':
      case 'banners_sponsors':
        return <PublicationMediaCenter onNavigateTab={tab => onNavigateToTab?.(tab as any)} />;
      case 'overview':
      default:
        return null;
    }
  };

  /*
   * Dashboard dan halaman fitur sengaja dipisahkan secara visual.
   * Tidak ada perubahan terhadap service/API/GAS; hanya layout/navigation presentation.
   */
  return (
    <div className="w-full max-w-7xl mx-auto px-1 sm:px-0 pb-8 sm:pb-12">
      {activeSection === 'overview' ? (
        <>
          {/* EVENT HEADER */}
          <section className="rounded-2xl sm:rounded-[24px] bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-5">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Kelola Kegiatan
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {event.status}
                      </span>
                    </div>

                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white break-words">
                      {event.name}
                    </h1>
                    <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400 max-w-3xl">
                      Kelola kegiatan, peserta, lomba, publikasi, dan kebutuhan operasional event.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 min-w-0 sm:shrink-0">
                    <div className={`min-h-9 px-2.5 sm:px-3 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 ${
                      saveState.status === 'Saving…'
                        ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200'
                        : saveState.status === 'Save Failed'
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200'
                        : saveState.status === 'Unsaved Changes'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                    }`}>
                      {saveState.status === 'Saving…' ? (
                        <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                      ) : saveState.status === 'Save Failed' || saveState.status === 'Unsaved Changes' ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span className="whitespace-nowrap">
                        {saveState.status === 'Saved ✓' ? `Tersimpan ✓ ${saveState.lastSaved}` : saveState.status}
                      </span>
                    </div>

                    {saveState.status === 'Save Failed' ? (
                      <button
                        type="button"
                        onClick={handleManualSave}
                        className="min-h-9 px-3 rounded-xl bg-rose-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Coba lagi
                      </button>
                    ) : saveState.hasUnsaved ? (
                      <button
                        type="button"
                        onClick={handleManualSave}
                        disabled={saveState.status === 'Saving…'}
                        className="min-h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Simpan
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setShowQrPrintCenter(true)}
                      className="min-h-9 px-3 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cetak QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPreviewOpen(true)}
                      className="min-h-9 px-3 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Pratinjau</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAuditDrawer(v => !v)}
                      aria-label="Riwayat audit"
                      className="min-h-9 min-w-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* CATEGORY NAVIGATION: kategori induk di kiri, kartu fitur di kanan */}
                <div className="border-t border-slate-100 dark:border-white/10 pt-4">
                  <div className="mb-3">
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Jelajahi Manajemen Event</h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pilih kategori di kiri, lalu buka fitur dari kartu di kanan.</p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(190px,220px)_minmax(0,1fr)] gap-3 sm:gap-4 items-start">
                    <nav aria-label="Kategori manajemen event" className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.025] p-2 no-scrollbar">
                      {STUDIO_CATEGORIES.map(category => {
                        const Icon = category.icon;
                        const selected = activeCategory === category.id;
                        return (
                          <button key={category.id} type="button" onClick={() => setActiveCategory(category.id)} aria-pressed={selected}
                            className={`min-w-[148px] lg:min-w-0 min-h-11 lg:min-h-[54px] flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${selected ? 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 ring-1 ring-red-200 dark:ring-red-900/60' : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/5'}`}>
                            <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${selected ? 'bg-red-100 dark:bg-red-900/50' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10'}`}><Icon className="w-4 h-4" /></span>
                            <span className="min-w-0 flex-1"><span className="block text-[11px] sm:text-xs font-bold leading-tight">{category.label}</span><span className="hidden md:block text-[10px] mt-1 opacity-75 leading-tight">{category.sections.length} fitur</span></span>
                            <ChevronRight className={`hidden md:block w-3.5 h-3.5 shrink-0 ${selected ? 'text-red-600' : 'text-slate-400'}`} />
                          </button>
                        );
                      })}
                    </nav>
                    <div className="min-w-0">
                      {STUDIO_CATEGORIES.filter(category => category.id === activeCategory).map(category => (
                        <div key={category.id}>
                          <div className="flex items-center justify-between gap-2 mb-2.5"><div className="min-w-0"><h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{category.label}</h3><p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{category.description}</p></div><span className="shrink-0 rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-300">{category.sections.length} fitur</span></div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-2.5 sm:gap-3">
                            {MENU_ITEMS.filter(item => category.sections.includes(item.id)).map(item => (
                              <button key={item.id} type="button" onClick={() => openSection(item.id)} className="group min-h-[84px] sm:min-h-[96px] rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.035] hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50/50 dark:hover:bg-red-950/15 p-3 sm:p-3.5 flex items-center gap-3 text-left shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 active:scale-[0.99]">
                                <span className="w-10 h-10 shrink-0 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 flex items-center justify-center text-xl font-bold" aria-hidden="true">{item.icon}</span>
                                <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-1.5"><span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white leading-snug">{item.label}</span><ChevronRight className="w-4 h-4 shrink-0 mt-0.5 text-slate-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition-transform" /></span><span className="block mt-1 text-[10px] sm:text-[11px] leading-snug text-slate-500 dark:text-slate-400">{item.description}</span></span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit is still a small overlay-like panel on dashboard only */}
            {showAuditDrawer && (
              <div className="border-t border-slate-100 dark:border-white/10 p-4 sm:p-5 bg-slate-50/70 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Riwayat Perubahan
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAuditDrawer(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    Tutup
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {eventStudioService.getAuditLogs().length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                      Belum ada riwayat perubahan.
                    </p>
                  ) : (
                    eventStudioService.getAuditLogs().map(log => (
                      <div key={log.id} className="p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                                {log.module || 'Audit'}
                              </span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-white">
                                {log.action}
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                              User: {log.user_id || log.actorName || '—'} · Workspace: {log.workspace_id || '—'}
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">{log.timestamp}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Existing overview content is intentionally retained here.
              It remains the event dashboard's overview, while other feature
              pages are no longer rendered underneath the navigator. */}
          <div className="mt-4 sm:mt-6">
            {renderSectionContent()}
          </div>
        </>
      ) : (
        <>
          {/* FEATURE PAGE — navigator is intentionally absent */}
          <section className="mb-4 sm:mb-5">
            <button
              type="button"
              onClick={goBackToDashboard}
              className="min-h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141418] text-slate-700 dark:text-slate-200 text-sm font-bold inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Menu Event
            </button>
          </section>

          <section className="rounded-2xl sm:rounded-[24px] bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/10 shadow-sm p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 mb-1">
                  <span>Kelola Kegiatan</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="text-emerald-600 dark:text-emerald-400">{activeMenu.label}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {activeMenu.label}
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {activeMenu.description} · {event.name}
                </p>
              </div>

              <div className={`self-start sm:self-auto min-h-9 px-3 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 ${
                saveState.status === 'Saving…'
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200'
                  : saveState.status === 'Save Failed'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200'
                  : saveState.status === 'Unsaved Changes'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200'
              }`}>
                {saveState.status === 'Saving…' ? (
                  <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                ) : saveState.status === 'Save Failed' || saveState.status === 'Unsaved Changes' ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span className="whitespace-nowrap">
                  {saveState.status === 'Saved ✓' ? `Tersimpan ✓ ${saveState.lastSaved}` : saveState.status}
                </span>
              </div>
            </div>
          </section>

          <main className="mt-4 sm:mt-5">
            {renderSectionContent()}
          </main>
        </>
      )}

      {showQrPrintCenter && (
        <QrPrintCenterModal onClose={() => setShowQrPrintCenter(false)} />
      )}

      <ParticipantPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
};
