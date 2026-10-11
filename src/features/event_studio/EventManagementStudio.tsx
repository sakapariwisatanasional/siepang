/**
 * @license
 * SiEpang - Comprehensive Event Management Studio
 * Dedicated operational command center for event administrators to configure
 * and manage camp events without manual spreadsheet editing.
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Tent,
  Trophy,
  Users,
  Bell,
  Zap,
  CreditCard,
  Settings,
  MapPin,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Smartphone,
  Save,
  History,
  ShieldCheck,
  ChevronRight,
  Flame,
  FileText,
  Boxes,
  Stethoscope,
  Heart,
  Sliders,
  Scale,
  QrCode,
  AlertTriangle,
  RefreshCw,
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
import { DocumentationManager } from './DocumentationManager';
import { BannerSponsorManager } from './BannerSponsorManager';
import { PublicationMediaCenter } from './PublicationMediaCenter';
import { QrPrintCenterModal } from '../documents/QrPrintCenterModal';
import { NavTab } from '../../components/navigation/MobileNavigation';
import { authService } from '../../services/authService';

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

export const EventManagementStudio: React.FC<EventManagementStudioProps> = ({
  onNavigateToTab,
}) => {
  const [activeSection, setActiveSection] = useState<StudioSection>('overview');
  const [saveState, setSaveState] = useState(eventStudioService.getSaveState());
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [showQrPrintCenter, setShowQrPrintCenter] = useState(false);
  const event = eventStudioService.getEvent();
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    const unsub = eventStudioService.subscribe(() => {
      setSaveState(eventStudioService.getSaveState());
    });
    return () => {
      unsub();
    };
  }, []);

  const handleManualSave = () => {
    eventStudioService.saveAll();
  };

  const operationalCards = [
    {
      id: 'readiness' as StudioSection,
      title: 'Pusat Kesiapan Event (Readiness)',
      badge: 'Live Audit',
      desc: 'Skor kesiapan operasional, bentrok jadwal, kuota buper & juri',
      icon: ShieldCheck,
      color: 'from-teal-700/40 to-emerald-900/40 border-teal-500/30 text-teal-300',
    },
    {
      id: 'general' as StudioSection,
      title: 'Pengaturan Umum Event',
      badge: event.status,
      desc: `${event.category} · ${event.organizationalLevel}`,
      icon: Settings,
      color: 'from-emerald-700/40 to-emerald-900/40 border-emerald-500/30 text-emerald-300',
    },
    {
      id: 'schedule' as StudioSection,
      title: 'Jadwal & Agenda',
      badge: `${eventStudioService.getSchedule().length} Agenda`,
      desc: 'Alokasi waktu, giat materi, & XP presensi',
      icon: Calendar,
      color: 'from-amber-700/40 to-amber-900/40 border-amber-500/30 text-amber-300',
    },
    {
      id: 'campsite' as StudioSection,
      title: 'Tata Ruang Buper & Kavling',
      badge: `${eventStudioService.getCampsiteLots().length} Kavling`,
      desc: 'Peta interaktif, zona tenda, & fasilitas umum',
      icon: Tent,
      color: 'from-emerald-700/40 to-emerald-900/40 border-emerald-500/30 text-emerald-300',
    },
    {
      id: 'competitions' as StudioSection,
      title: 'Kompetisi, Juri & Voting',
      badge: `${eventStudioService.getCompetitions().length} Lomba`,
      desc: 'Rubrik 100%, kunci nilai, & voting galeri',
      icon: Trophy,
      color: 'from-amber-700/40 to-amber-900/40 border-amber-500/30 text-amber-300',
    },
    {
      id: 'registration' as StudioSection,
      title: 'Pendaftaran & Kontingen',
      badge: `${event.registeredCount} Peserta`,
      desc: 'Formulir dinamis, kuota, & level kwartir',
      icon: Users,
      color: 'from-sky-700/40 to-sky-900/40 border-sky-500/30 text-sky-300',
    },
    {
      id: 'points_badges' as StudioSection,
      title: 'Gamifikasi, Poin & Pos QR',
      badge: `${eventStudioService.getCheckpoints().length} Pos QR`,
      desc: 'Aturan XP, lencana luhur, & pos petualangan',
      icon: Zap,
      color: 'from-amber-700/40 to-amber-900/40 border-amber-500/30 text-amber-300',
    },
    {
      id: 'features' as StudioSection,
      title: 'Aktivasi Modul & Beranda',
      badge: '10 Modul',
      desc: 'Sakelar fitur & susunan seksi beranda peserta',
      icon: Sliders,
      color: 'from-purple-700/40 to-purple-900/40 border-purple-500/30 text-purple-300',
    },
    {
      id: 'pages_contacts' as StudioSection,
      title: 'Panduan Teknis & Kontak Posko',
      badge: `${eventStudioService.getCustomPages().length} Halaman`,
      desc: 'Tata tertib buper, jadwal sholat, & nomor darurat',
      icon: FileText,
      color: 'from-emerald-700/40 to-emerald-900/40 border-emerald-500/30 text-emerald-300',
    },
    {
      id: 'publication_media' as StudioSection,
      title: 'Publikasi & Media Resmi',
      badge: 'Foto, Video & Banner',
      desc: 'Album foto Google Drive, video highlight, hero banner & sponsor',
      icon: Sparkles,
      color: 'from-purple-700/40 to-pink-900/40 border-purple-500/30 text-purple-300',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header Bar with Dynamic Status, Autosave & Preview Triggers */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-3 py-1 rounded-full bg-[#208C60]/10 text-[#208C60] dark:text-[#F47743] text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Kelola Kegiatan</span>
              </span>

              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-black uppercase font-mono">
                {event.status}
              </span>

              <span className="text-xs text-slate-500 dark:text-slate-400">
                Tingkat: <strong className="text-slate-800 dark:text-white">{event.organizationalLevel}</strong>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-[#171717] dark:text-white tracking-tight">
              {event.name}
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Instalasi SiEpang ini terikat pada kegiatan <strong>{event.name}</strong>. Seluruh editor dan modul operasional otomatis bekerja terhadap kegiatan aktif ini.
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Saved / Saving Status */}
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              saveState.status === 'Saving…'
                ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-300 animate-pulse'
                : saveState.status === 'Save Failed'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300'
                : saveState.status === 'Unsaved Changes'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 animate-pulse'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300'
            }`}>
              {saveState.status === 'Saving…' ? (
                <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
              ) : saveState.status === 'Save Failed' || saveState.status === 'Unsaved Changes' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>
                {saveState.status === 'Saved ✓' ? `Tersimpan ✓ (${saveState.lastSaved})` : saveState.status}
              </span>
            </div>

            {saveState.status === 'Save Failed' ? (
              <button
                onClick={handleManualSave}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            ) : saveState.hasUnsaved ? (
              <button
                onClick={handleManualSave}
                disabled={saveState.status === 'Saving…'}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Sekarang</span>
              </button>
            ) : null}

            {/* QR Print Center Modal Trigger */}
            <button
              onClick={() => setShowQrPrintCenter(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-[#208C60]" />
              <span>Cetak QR</span>
            </button>

            {/* Preview as Participant */}
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span>Pratinjau</span>
            </button>

            {/* Audit Log Drawer Trigger */}
            <button
              onClick={() => setShowAuditDrawer(!showAuditDrawer)}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
              title="Riwayat Audit"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Menu kegiatan: grid kartu responsif, tanpa gulir horizontal. */}
        <nav aria-label="Menu pengelolaan kegiatan" className="border-t border-[#ECECEF] dark:border-white/10 pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-[#234538] dark:text-white">Menu Pengelolaan Event</h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Pilih kartu untuk membuka fitur</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
            {[
              { id: 'overview' as StudioSection, label: 'Ikhtisar', icon: '📊' },
              { id: 'readiness' as StudioSection, label: 'Kesiapan', icon: '🎯' },
              { id: 'schedule' as StudioSection, label: 'Jadwal', icon: '📅' },
              { id: 'campsite' as StudioSection, label: 'Kavling Buper', icon: '⛺' },
              { id: 'competitions' as StudioSection, label: 'Lomba', icon: '🏆' },
              { id: 'registration' as StudioSection, label: 'Peserta', icon: '👥' },
              { id: 'points_badges' as StudioSection, label: 'Poin XP', icon: '⚡' },
              { id: 'publication_media' as StudioSection, label: 'Publikasi', icon: '📢' },
              { id: 'visitors' as StudioSection, label: 'Buku Tamu', icon: '📋' },
              { id: 'general' as StudioSection, label: 'Pengaturan', icon: '⚙️' },
              { id: 'features' as StudioSection, label: 'Sakelar Fitur', icon: '🎛️' },
              { id: 'pages_contacts' as StudioSection, label: 'Bantuan', icon: '📄' },
            ].map(tab => {
              const selected = activeSection === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={`group min-w-0 min-h-[76px] sm:min-h-[84px] rounded-2xl border px-2 py-3 flex flex-col items-center justify-center gap-1.5 text-center transition-colors duration-150 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98] ${
                    selected
                      ? 'bg-[#234538] border-[#234538] text-white shadow-sm dark:bg-emerald-700 dark:border-emerald-600'
                      : 'bg-[#FAFAF7] border-[#E3E9E4] text-[#234538] hover:bg-emerald-50 hover:border-emerald-300 dark:bg-white/5 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="text-[23px] leading-none" aria-hidden="true">{tab.icon}</span>
                  <span className="text-xs sm:text-[13px] font-bold leading-tight break-words">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* 2. Audit Log Drawer Modal / Dropdown */}
      {showAuditDrawer && (
        <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 animate-in fade-in shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-[#F47743]" />
              <span>Log Audit Perubahan Event (Enterprise Compliance)</span>
            </h3>
            <button onClick={() => setShowAuditDrawer(false)} className="text-[#6B7280] hover:text-[#171717] dark:text-slate-400 dark:hover:text-white text-xs cursor-pointer">Tutup</button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {eventStudioService.getAuditLogs().map(log => (
              <div key={log.id} className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-white/5 border border-[#ECECEF] dark:border-white/5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-pink-50 text-[#F47743] border border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800 font-mono text-[10px] font-bold">
                      {log.module || 'Audit'}
                    </span>
                    <span className="font-semibold text-[#171717] dark:text-white">{log.action}</span>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] dark:text-slate-500 font-mono shrink-0">{log.timestamp}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#6B7280] dark:text-slate-400">
                  <span>User: <strong className="text-[#171717] dark:text-slate-200">{log.user_id || log.actorName}</strong></span>
                  <span>Workspace: <strong className="text-[#171717] dark:text-slate-200">{log.workspace_id}</strong></span>
                  <span>Entity: <strong className="text-emerald-400 font-mono">{log.entity_id || log.target}</strong></span>
                  {log.new_data && (
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-amber-300 font-mono text-[9px]">
                      Payload Tersimpan ✓
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. SECTION CONTENT ROUTING */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <OperationsCommandCenter
            onNavigateSection={setActiveSection}
            onNavigateTab={tab => onNavigateToTab?.(tab as any)}
          />
        </div>
      )}

      {activeSection === 'readiness' && (
        <EventReadinessCenter onNavigateSection={setActiveSection} />
      )}

      {activeSection === 'general' && <GeneralEventEditor />}

      {activeSection === 'schedule' && <ScheduleActivityEditor />}

      {activeSection === 'campsite' && <CampsiteManager />}

      {activeSection === 'competitions' && <CompetitionStudio />}

      {activeSection === 'registration' && <RegistrationContingentEditor />}

      {activeSection === 'points_badges' && <PointsBadgesCheckpointEditor />}

      {activeSection === 'features' && <FeatureSettingsEditor />}

      {activeSection === 'pages_contacts' && <CustomPagesAndContacts />}

      {activeSection === 'visitors' && <VisitorManagementStudio />}

      {(activeSection === 'publication_media' || activeSection === 'documentation' || activeSection === 'banners_sponsors') && (
        <PublicationMediaCenter onNavigateTab={tab => onNavigateToTab?.(tab as any)} />
      )}

      {/* QR Print Center Modal (Req 59, 60, 61) */}
      {showQrPrintCenter && (
        <QrPrintCenterModal onClose={() => setShowQrPrintCenter(false)} />
      )}

      {/* Participant Viewport Live Preview Modal (Requirement 31) */}
      <ParticipantPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
};
