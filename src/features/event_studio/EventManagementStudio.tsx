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
  BarChart3,
  Target,
  Megaphone,
  ClipboardList,
  SlidersHorizontal,
  type LucideIcon,
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
import { OperationsCommandCenter } from './OperationsCommandCenter';
import { ParticipantPreviewModal } from './ParticipantPreviewModal';
import { VisitorManagementStudio } from '../visitors/VisitorManagementStudio';
import { PublicationMediaCenter } from './PublicationMediaCenter';
import { QrPrintCenterModal } from '../documents/QrPrintCenterModal';
import { NavTab } from '../../components/navigation/MobileNavigation';
import campSceneIllustration from '../../assets/illustrations/camp-scene-arcane-2d.svg';

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
  icon: LucideIcon;
  description: string;
};

const MENU_ITEMS: MenuItem[] = [
  { id: 'overview', label: 'Ikhtisar', icon: BarChart3, description: 'Ringkasan kondisi event' },
  { id: 'readiness', label: 'Kesiapan', icon: Target, description: 'Cek kesiapan operasional' },
  { id: 'schedule', label: 'Jadwal', icon: Calendar, description: 'Agenda dan kegiatan' },
  { id: 'campsite', label: 'Kavling Buper', icon: Tent, description: 'Kavling dan tata ruang' },
  { id: 'competitions', label: 'Lomba', icon: Trophy, description: 'Lomba, juri dan voting' },
  { id: 'registration', label: 'Peserta', icon: Users, description: 'Pendaftaran dan kontingen' },
  { id: 'points_badges', label: 'Poin XP', icon: Zap, description: 'Poin, lencana dan QR' },
  { id: 'publication_media', label: 'Publikasi', icon: Megaphone, description: 'Media dan publikasi resmi' },
  { id: 'visitors', label: 'Buku Tamu', icon: ClipboardList, description: 'Kunjungan dan tamu' },
  { id: 'general', label: 'Pengaturan', icon: Settings, description: 'Informasi dasar event' },
  { id: 'features', label: 'Sakelar Fitur', icon: SlidersHorizontal, description: 'Aktivasi modul' },
  { id: 'pages_contacts', label: 'Bantuan', icon: FileText, description: 'Panduan dan kontak posko' },
];

export const EventManagementStudio: React.FC<EventManagementStudioProps> = ({
  onNavigateToTab,
}) => {
  const [activeSection, setActiveSection] = useState<StudioSection>('overview');
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
        return (
          <OperationsCommandCenter
            onNavigateSection={openSection}
            onNavigateTab={tab => onNavigateToTab?.(tab as any)}
          />
        );
    }
  };

  /*
   * Presentation layer only.
   * Data, services, API contracts, Spreadsheet and GAS are intentionally untouched.
   */
  return (
    <div className="w-full max-w-6xl mx-auto pb-8 sm:pb-12">
      {activeSection === 'overview' ? (
        <section className="overflow-hidden rounded-[28px] sm:rounded-[32px] border border-red-100 bg-white shadow-[0_10px_35px_rgba(160,20,20,0.08)]">
          {/* Red event hero */}
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#D71920_0%,#C51F1F_58%,#A71319_100%)] px-4 py-5 sm:px-7 sm:py-7 text-white">
            <div aria-hidden="true" className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/10 blur-xl" />
            <div aria-hidden="true" className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-[#F4D53F]/20 blur-xl" />
            <div className="relative grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold backdrop-blur-sm">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Kelola Kegiatan
                  </span>
                  {event.status && (
                    <span className="rounded-full bg-[#F4D53F] px-2.5 py-1 text-[10px] font-extrabold text-[#241B00]">
                      {event.status}
                    </span>
                  )}
                </div>
                <h1 className="break-words text-2xl font-black tracking-tight sm:text-3xl">{event.name}</h1>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
                  Kelola kegiatan, peserta, lomba, jadwal, publikasi, dan kebutuhan operasional dari satu tempat.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-start">
                <div className={`min-h-10 rounded-xl border px-3 text-[11px] font-bold flex items-center gap-1.5 ${
                  saveState.status === 'Saving…'
                    ? 'border-white/20 bg-white/10 text-white'
                    : saveState.status === 'Save Failed'
                    ? 'border-white/30 bg-black/15 text-white'
                    : saveState.status === 'Unsaved Changes'
                    ? 'border-[#F4D53F]/50 bg-[#F4D53F]/15 text-[#FFF3A8]'
                    : 'border-white/20 bg-white/10 text-white'
                }`}>
                  {saveState.status === 'Saving…' ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : saveState.status === 'Save Failed' || saveState.status === 'Unsaved Changes' ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span className="whitespace-nowrap">
                    {saveState.status === 'Saved ✓' ? `Tersimpan · ${saveState.lastSaved}` : saveState.status}
                  </span>
                </div>

                {saveState.status === 'Save Failed' ? (
                  <button type="button" onClick={handleManualSave}
                    className="min-h-10 rounded-xl bg-white px-3.5 text-xs font-extrabold text-[#C51F1F] inline-flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
                  </button>
                ) : saveState.hasUnsaved ? (
                  <button type="button" onClick={handleManualSave} disabled={saveState.status === 'Saving…'}
                    className="min-h-10 rounded-xl bg-white px-3.5 text-xs font-extrabold text-[#C51F1F] inline-flex items-center gap-1.5 disabled:opacity-60">
                    <Save className="h-3.5 w-3.5" /> Simpan
                  </button>
                ) : null}

                <button type="button" onClick={() => setShowQrPrintCenter(true)}
                  className="min-h-10 rounded-xl bg-black/15 px-3.5 text-xs font-bold text-white hover:bg-black/20 inline-flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Cetak QR</span>
                </button>
                <button type="button" onClick={() => setIsPreviewOpen(true)}
                  className="min-h-10 rounded-xl bg-black/15 px-3.5 text-xs font-bold text-white hover:bg-black/20 inline-flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Pratinjau</span>
                </button>
                <button type="button" onClick={() => setShowAuditDrawer(v => !v)} aria-label="Riwayat audit"
                  className="min-h-10 min-w-10 rounded-xl bg-black/15 text-white inline-flex items-center justify-center">
                  <History className="h-4 w-4" />
                </button>
              </div>

              <div className="relative min-h-[220px] overflow-hidden rounded-[26px] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.07)_100%)] p-3 shadow-[0_8px_28px_rgba(0,0,0,0.10)] backdrop-blur-sm sm:min-h-[250px] lg:min-h-[280px]">
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent" />
                <img
                  src={campSceneIllustration}
                  alt="Ilustrasi perkemahan transparan"
                  className="pointer-events-none absolute bottom-0 right-0 w-full max-w-[520px] select-none object-contain opacity-95"
                />
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div className="flex justify-end">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold text-white/90 backdrop-blur-sm">
                      <Tent className="h-3.5 w-3.5" />
                      2D transparan · non-3D
                    </span>
                  </div>
                  <div className="max-w-[260px] rounded-[22px] border border-white/20 bg-white/14 p-4 shadow-sm backdrop-blur-sm">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/70">Fokus Pengelolaan</p>
                    <h3 className="mt-2 text-lg font-black text-white">Navigasi kartu, satu fitur satu halaman.</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/80">
                      Tampilan dibuat lebih ramah HP dengan nuansa kegiatan perkemahan, tanpa mengubah integrasi GAS yang sudah berjalan.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature launchpad: no stacked feature pages */}
          <div className="p-4 sm:p-7">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#D71920]">Menu Utama</p>
                <h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">Kelola Event</h2>
                <p className="mt-0.5 text-xs text-slate-500">Pilih kartu untuk membuka satu fitur secara penuh.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {MENU_ITEMS.map((item, index) => {
                const accentClasses = [
                  'bg-red-50 text-[#C51F1F] border-red-100',
                  'bg-amber-50 text-amber-700 border-amber-100',
                  'bg-red-50 text-[#D71920] border-red-100',
                  'bg-emerald-50 text-emerald-700 border-emerald-100',
                  'bg-yellow-50 text-yellow-700 border-yellow-100',
                  'bg-purple-50 text-purple-700 border-purple-100',
                ][index % 6];
                return (
                  <button key={item.id} type="button" onClick={() => openSection(item.id)}
                    className="group min-h-[126px] rounded-[22px] border border-slate-200 bg-white p-3.5 text-left shadow-[0_3px_12px_rgba(0,0,0,0.035)] transition-all hover:-translate-y-0.5 hover:border-red-200 hover:shadow-[0_8px_22px_rgba(180,20,20,0.10)] active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D71920] sm:min-h-[138px] sm:p-4">
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-[16px] border ${accentClasses}`} aria-hidden="true">
                        <item.icon className="h-5 w-5 stroke-[2.2]" aria-hidden="true" />
                      </span>
                      <ChevronRight className="mt-1 h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#D71920]" />
                    </div>
                    <span className="block text-sm font-extrabold leading-tight text-slate-900">{item.label}</span>
                    <span className="mt-1 block text-[10px] leading-snug text-slate-500 sm:text-[11px]">{item.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {showAuditDrawer && (
            <div className="border-t border-red-50 bg-red-50/40 p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <History className="h-4 w-4 text-[#D71920]" /> Riwayat Perubahan
                </h3>
                <button type="button" onClick={() => setShowAuditDrawer(false)}
                  className="min-h-9 rounded-lg px-3 text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-900">
                  Tutup
                </button>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {eventStudioService.getAuditLogs().length === 0 ? (
                  <p className="py-2 text-xs text-slate-500">Belum ada riwayat perubahan.</p>
                ) : eventStudioService.getAuditLogs().map(log => (
                  <div key={log.id} className="rounded-xl border border-red-100 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase text-[#C51F1F]">{log.module || 'Audit'}</span>
                          <span className="text-xs font-semibold text-slate-800">{log.action}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">User: {log.user_id || log.actorName || '—'} · Workspace: {log.workspace_id || '—'}</div>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400">{log.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section>
          {/* Feature page: menu is intentionally not repeated above the content. */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <button type="button" onClick={goBackToDashboard}
              className="min-h-11 rounded-xl border border-red-100 bg-white px-4 text-sm font-extrabold text-[#C51F1F] shadow-sm hover:bg-red-50 inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Menu Event
            </button>
            <div className="hidden sm:flex min-h-10 items-center gap-1.5 rounded-xl bg-red-50 px-3 text-[11px] font-bold text-[#C51F1F]">
              <CheckCircle2 className="h-3.5 w-3.5" /> {saveState.status === 'Saved ✓' ? `Tersimpan · ${saveState.lastSaved}` : saveState.status}
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-red-100 bg-white shadow-[0_8px_28px_rgba(160,20,20,0.06)]">
            <div className="relative overflow-hidden bg-[linear-gradient(135deg,#D71920_0%,#C51F1F_58%,#A71319_100%)] px-4 py-5 text-white sm:px-7 sm:py-6">
              <div aria-hidden="true" className="absolute right-0 top-0 h-full w-[40%] bg-gradient-to-l from-white/5 to-transparent" />
              <img src={campSceneIllustration} alt="" className="pointer-events-none absolute bottom-0 right-0 h-[145px] max-w-[42%] object-contain opacity-20" />
              <div className="relative flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  <activeMenu.icon className="h-6 w-6 stroke-[2.2]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Kelola Kegiatan</p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight">{activeMenu.label}</h1>
                  <p className="mt-1 text-xs leading-relaxed text-white/80 sm:text-sm">{activeMenu.description} · {event.name}</p>
                </div>
              </div>
            </div>
            <main className="p-3 sm:p-5 lg:p-6">
              {renderSectionContent()}
            </main>
          </div>
        </section>
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
