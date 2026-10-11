/**
 * @license
 * SiEpang - Public Event Homepage (Refactored to Rich Public Activity Portal)
 * Complete visual camp portal integrating:
 * 1. Hero Banner
 * 2. Pengumuman / Informasi Penting
 * 3. Jadwal Kegiatan
 * 4. Ranking / Leaderboard Peserta (Top 5-10)
 * 5. Galeri Foto (Dedicated)
 * 6. Galeri Video (Dedicated)
 * 7. Scan QR Prominent Entry
 * 8. Visitor / Registrasi Tamu Pass
 * 9. Verifikasi Sertifikat & Dokumen
 * 10. Sponsor Active Strip
 * 11. Reusable Global Footer
 * Dynamic section_order & section_visibility support via portalConfigService & featureControlService.
 * Safe empty states, zero fake/dummy data.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Users,
  Image as ImageIcon,
  Film,
  Play,
  Monitor,
  Tablet,
  Smartphone,
  Check,
  X,
  Bell,
  LogIn,
  AlertTriangle,
  RefreshCw,
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  FileCheck,
  Trophy,
  Medal,
  Zap,
  Menu,
} from 'lucide-react';
import { eventService } from '../../services/eventService';
import { bootstrapService } from '../../services/bootstrapService';
import { documentationService } from '../../services/documentationService';
import { bannerSponsorService } from '../../services/bannerSponsorService';
import { featureControlService } from '../../services/featureControlService';
import { pointService } from '../../services/pointService';
import { documentStudioService } from '../../services/documentStudioService';
import {
  portalConfigService,
  PortalSectionKey,
  PublicPortalConfig,
} from '../../services/portalConfigService';
import { PublicHeroBanner } from '../../components/banners/PublicHeroBanner';
import { PublicInformationBanner } from '../../components/banners/PublicInformationBanner';
import { PublicSponsorStrip } from '../../components/banners/PublicSponsorStrip';
import { GlobalFooter } from '../../components/layout/GlobalFooter';
import { VisitorPublicRegistrationModal } from '../visitors/VisitorPublicRegistrationModal';
import { MediaItem, LeaderboardEntry, ScheduleItem, Announcement } from '../../types';

export type InstallationState = 'LOADING' | 'CONFIGURED' | 'NOT_CONFIGURED' | 'BACKEND_UNREACHABLE';

interface PublicEventHomepageProps {
  onNavigateToGallery?: (tab?: 'photos' | 'videos') => void;
  onNavigateToVisitorRegister?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToLeaderboard?: () => void;
  onOpenScanner?: () => void;
  onNavigateToLogin?: (prefillEmail?: string) => void;
  onRetryConnection?: () => Promise<void> | void;
  installationState?: InstallationState;
  installationError?: string | null;
}

export const PublicEventHomepage: React.FC<PublicEventHomepageProps> = ({
  onNavigateToGallery,
  onNavigateToVisitorRegister,
  onNavigateToSchedule,
  onNavigateToLeaderboard,
  onOpenScanner,
  onNavigateToLogin,
  onRetryConnection,
  installationState = 'CONFIGURED',
  installationError,
}) => {
  const [deviceViewport, setDeviceViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [activeVideoModal, setActiveVideoModal] = useState<MediaItem | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [officialCompetitions, setOfficialCompetitions] = useState<Array<{id:string;title:string;category:string;scheduleTime:string;location:string}>>([]);
  const [competitionLoading, setCompetitionLoading] = useState(true);
  const [competitionError, setCompetitionError] = useState('');
  const refreshOfficialCompetitions = async () => {
    setCompetitionLoading(true);
    setCompetitionError('');
    try {
      const backend = bootstrapService.getBackendUrl();
      if (!backend) throw new Error('URL GAS belum tersedia.');
      const endpoint = new URL(backend);
      endpoint.searchParams.set('action','competitions.public.list');
      const response = await fetch(endpoint.toString(), {method:'GET',redirect:'follow'});
      if (!response.ok) throw new Error(`Server merespons ${response.status}`);
      const result = await response.json();
      if (!result.ok || !Array.isArray(result.data?.competitions)) throw new Error(result.error?.message || 'Format daftar lomba tidak valid.');
      setOfficialCompetitions(result.data.competitions);
    } catch (e: any) {
      setCompetitionError(e?.message || 'Informasi lomba belum dapat dimuat.');
    } finally {setCompetitionLoading(false);}
  };
  useEffect(() => {void refreshOfficialCompetitions();}, []);


  // Certificate Verification Form State
  const [certQuery, setCertQuery] = useState('');
  const [certSearched, setCertSearched] = useState(false);
  const [certResult, setCertResult] = useState<any>(null);

  // Portal Config (section order & visibility)
  const [portalConfig, setPortalConfig] = useState<PublicPortalConfig>(
    portalConfigService.getConfig()
  );

  const isConfigured = installationState === 'CONFIGURED';
  const isNotConfigured = installationState === 'NOT_CONFIGURED';
  const isUnreachable = installationState === 'BACKEND_UNREACHABLE';
  const isLoading = installationState === 'LOADING';

  // Feature Control states
  const [features, setFeatures] = useState({
    heroBanner: featureControlService.isFeatureEnabled('HERO_BANNER'),
    infoBanner: featureControlService.isFeatureEnabled('INFORMATION_BANNER'),
    announcements: featureControlService.isFeatureEnabled('ANNOUNCEMENTS'),
    schedule: featureControlService.isFeatureEnabled('SCHEDULE'),
    photoDocumentation: featureControlService.isFeatureEnabled('PHOTO_DOCUMENTATION'),
    videoDocumentation: featureControlService.isFeatureEnabled('VIDEO_DOCUMENTATION'),
    visitorRegistration: featureControlService.isFeatureEnabled('VISITOR_REGISTRATION'),
    publicContacts: featureControlService.isFeatureEnabled('PUBLIC_CONTACTS'),
    leaderboard: featureControlService.isFeatureEnabled('POINTS_XP'),
    certificates: featureControlService.isFeatureEnabled('CERTIFICATE'),
    sponsors: featureControlService.isFeatureEnabled('SPONSOR_DISPLAY'),
  });

  useEffect(() => {
    const updateAll = () => {
      setFeatures({
        heroBanner: featureControlService.isFeatureEnabled('HERO_BANNER'),
        infoBanner: featureControlService.isFeatureEnabled('INFORMATION_BANNER'),
        announcements: featureControlService.isFeatureEnabled('ANNOUNCEMENTS'),
        schedule: featureControlService.isFeatureEnabled('SCHEDULE'),
        photoDocumentation: featureControlService.isFeatureEnabled('PHOTO_DOCUMENTATION'),
        videoDocumentation: featureControlService.isFeatureEnabled('VIDEO_DOCUMENTATION'),
        visitorRegistration: featureControlService.isFeatureEnabled('VISITOR_REGISTRATION'),
        publicContacts: featureControlService.isFeatureEnabled('PUBLIC_CONTACTS'),
        leaderboard: featureControlService.isFeatureEnabled('POINTS_XP'),
        certificates: featureControlService.isFeatureEnabled('CERTIFICATE'),
        sponsors: featureControlService.isFeatureEnabled('SPONSOR_DISPLAY'),
      });
      setPortalConfig(portalConfigService.getConfig());
    };

    const unsubFeature = featureControlService.subscribe(updateAll);
    const unsubPortal = portalConfigService.subscribe(updateAll);
    const unsubEvent = eventService.subscribe(updateAll);
    const unsubDoc = documentationService.subscribe(updateAll);
    const unsubBanner = bannerSponsorService.subscribe(updateAll);

    return () => {
      unsubFeature();
      unsubPortal();
      unsubEvent();
      unsubDoc();
      unsubBanner();
    };
  }, []);

  // Data fetching from existing services
  const event = eventService.getCurrentEvent();
  const announcements: Announcement[] = useMemo(() => {
    return isConfigured ? eventService.getAnnouncements().slice(0, 4) : [];
  }, [isConfigured]);

  const scheduleList: ScheduleItem[] = useMemo(() => {
    if (!isConfigured) return [];
    const all = eventService.getSchedule();
    return all.slice(0, 4);
  }, [isConfigured]);

  const leaderboardList: LeaderboardEntry[] = useMemo(() => {
    if (!isConfigured) return [];
    try {
      return pointService.getLeaderboard().slice(0, 5);
    } catch {
      return [];
    }
  }, [isConfigured]);

  const photoPreviews: MediaItem[] = useMemo(() => {
    if (!isConfigured) return [];
    return documentationService
      .getMediaItems({ type: 'PHOTO', publicationStatus: 'PUBLISHED' })
      .slice(0, 6);
  }, [isConfigured]);

  const videoPreviews: MediaItem[] = useMemo(() => {
    if (!isConfigured) return [];
    return documentationService
      .getMediaItems({ type: 'VIDEO', publicationStatus: 'PUBLISHED' })
      .slice(0, 4);
  }, [isConfigured]);

  const activeSponsors = useMemo(() => {
    if (!isConfigured) return [];
    try {
      return bannerSponsorService.getSponsors('PUBLISHED').filter(s => s.status !== 'INACTIVE');
    } catch {
      return [];
    }
  }, [isConfigured]);

  const handleRetry = async () => {
    if (!onRetryConnection || isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetryConnection();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleVerifyCert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!certQuery.trim()) return;
    setCertSearched(true);
    const res = documentStudioService.verifyPublicDocument(certQuery.trim());
    setCertResult(res);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const viewportWidthClass = {
    desktop: 'w-full',
    tablet: 'max-w-[768px] mx-auto shadow-2xl border-x border-black/10 dark:border-white/10',
    mobile: 'max-w-[390px] mx-auto shadow-2xl border-x border-black/10 dark:border-white/10',
  }[deviceViewport];

  // Helper to determine if a section should be rendered based on section_visibility & feature control
  const isSectionVisible = (key: PortalSectionKey): boolean => {
    if (portalConfig.section_visibility[key] === false) return false;

    switch (key) {
      case 'hero':
        return features.heroBanner !== false;
      case 'announcements':
        return features.announcements !== false;
      case 'schedule':
        return features.schedule !== false;
      case 'leaderboard':
        return features.leaderboard !== false;
      case 'photo_gallery':
        return features.photoDocumentation !== false;
      case 'video_gallery':
        return features.videoDocumentation !== false;
      case 'qr_scanner':
        return true;
      case 'visitor':
        return features.visitorRegistration !== false;
      case 'verification':
        return features.certificates !== false;
      case 'sponsors':
        return features.sponsors !== false;
      default:
        return true;
    }
  };

  // Section renderers
  const renderHeroSection = () => {
    if (isConfigured && features.heroBanner) {
      return (
        <section id="section-hero" className="space-y-4">
          <PublicHeroBanner
            onNavigateRoute={route => {
              if (route === 'gallery') onNavigateToGallery?.();
              else if (route === 'schedule') onNavigateToSchedule?.();
              else if (route === 'visitors') setShowVisitorModal(true);
              else if (route === 'scanner') onOpenScanner?.();
            }}
            location="PUBLIC_HOME_TOP"
          />

          {/* Event Metadata Hero Summary */}
          <div className="rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 p-5 sm:p-7 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#208C60]/10 text-[#208C60] dark:text-[#F47743] text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{event.organizationalLevel || 'Kwartir'} · Resmi</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  {event.name}
                </h1>
                {event.theme && (
                  <p className="text-sm font-semibold text-[#F47743] italic">
                    "{event.theme}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenScanner?.()}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan QR</span>
                </button>
                {features.visitorRegistration && (
                  <button
                    type="button"
                    onClick={() => setShowVisitorModal(true)}
                    className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    <span>Daftar Tamu</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 space-y-0.5">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#F47743]" />
                  <span>Lokasi:</span>
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {event.campGround || 'Bumi Perkemahan'}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 space-y-0.5">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-purple-600" />
                  <span>Tanggal:</span>
                </div>
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate">
                  {event.startDate || 'Diumumkan'} {event.endDate ? `- ${event.endDate}` : ''}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 space-y-0.5">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <Users className="w-3 h-3 text-blue-600" />
                  <span>Peserta:</span>
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {event.registeredCount || 0} Terdaftar
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 space-y-0.5">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Penyelenggara:</span>
                </div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  {event.organizer || 'Kwartir'}
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    // Unconfigured Neutral Hero
    return (
      <section
        id="section-hero"
        className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-[#141418] dark:via-[#101014] dark:to-black border border-black/5 dark:border-white/10 p-6 sm:p-10 lg:p-12 shadow-sm space-y-6"
      >
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#208C60]/10 dark:bg-[#208C60]/20 border border-[#208C60]/20 text-[#208C60] dark:text-[#F47743] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SiEpang — Sistem Informasi Perkemahan</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
            Portal Resmi Kegiatan Perkemahan Pramuka
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Pusat informasi publik terintegrasi untuk peserta, kontingen, panitia, dan orang tua. Menampilkan jadwal giat, perolehan ranking XP, album foto/video dokumentasi, dan verifikasi dokumen.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              ⚜️ Gerakan Pramuka
            </span>
            <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              🛡️ Terverifikasi Resmi
            </span>
            <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              🏕️ Portal Kegiatan Mandiri
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenScanner?.()}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <QrCode className="w-4 h-4" />
            <span>Buka Scanner QR</span>
          </button>

          {features.visitorRegistration && (
            <button
              type="button"
              onClick={() => setShowVisitorModal(true)}
              className="px-5 py-3 rounded-2xl bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 text-slate-800 dark:text-white border border-black/10 dark:border-white/10 font-bold text-xs sm:text-sm shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Daftar Tamu (Visitor)</span>
            </button>
          )}

          {features.schedule && onNavigateToSchedule && (
            <button
              type="button"
              onClick={onNavigateToSchedule}
              className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs sm:text-sm transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-amber-400 dark:text-amber-600" />
              <span>Jadwal Kegiatan</span>
            </button>
          )}
        </div>
      </section>
    );
  };

  const renderAnnouncementsSection = () => {
    return (
      <section id="section-announcements" className="space-y-4">
        {/* Render PublicInformationBanner if active */}
        {features.infoBanner && (
          <PublicInformationBanner
            onNavigateRoute={route => {
              if (route === 'visitors') setShowVisitorModal(true);
              else if (route === 'schedule') onNavigateToSchedule?.();
            }}
            location="PUBLIC_HOME_MIDDLE"
          />
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Pengumuman & Warta Buper
            </h2>
          </div>
        </div>

        {announcements.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400">
            Belum ada warta pengumuman yang dipublikasikan.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {announcements.map(ann => {
              const isUrgent =
                String(ann.priority).toLowerCase() === 'urgent' ||
                String(ann.priority).toUpperCase() === 'HIGH';
              const isWarning =
                String(ann.priority).toLowerCase() === 'important' ||
                String(ann.priority).toUpperCase() === 'NORMAL';

              return (
                <div
                  key={ann.id}
                  className={`p-4 rounded-2xl bg-white dark:bg-[#121215] border ${
                    isUrgent
                      ? 'border-rose-400 dark:border-rose-800/60 bg-rose-50/30'
                      : isWarning
                      ? 'border-amber-300 dark:border-amber-800/60'
                      : 'border-black/5 dark:border-white/10'
                  } shadow-xs space-y-2`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                        isUrgent
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                          : isWarning
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                      }`}
                    >
                      {isUrgent && <AlertTriangle className="w-3 h-3" />}
                      <span>{ann.category || (isUrgent ? 'URGENT' : isWarning ? 'PENTING' : 'INFO')}</span>
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {ann.timestamp || ann.date || 'Terkini'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ann.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {ann.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const renderScheduleSection = () => {
    return (
      <section id="section-schedule" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Jadwal & Agenda Kegiatan
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Agenda kegiatan terdekat di Bumi Perkemahan.
              </p>
            </div>
          </div>

          {onNavigateToSchedule && (
            <button
              type="button"
              onClick={onNavigateToSchedule}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Lihat Semua Jadwal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {scheduleList.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <Calendar className="w-6 h-6 mx-auto text-slate-400 opacity-60 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Tidak ada jadwal yang dipublikasikan.
            </p>
            <p>Jadwal perkemahan akan tampil begitu panitia mengaktifkan agenda resmi.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {scheduleList.map(sch => (
              <div
                key={sch.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-xs font-bold text-[#F47743] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{sch.time || `${sch.startTime || ''} - ${sch.endTime || ''}`}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                      {sch.category || 'Giat'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                    {sch.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>{sch.location || 'Lapangan Utama'}</span>
                  </p>
                </div>

                <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">
                    Hari ke-{sch.dayNumber || 1}
                  </span>
                  {sch.xpReward > 0 && (
                    <span className="font-bold text-[#F47743]">+{sch.xpReward} XP</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderLeaderboardSection = () => {
    return (
      <section id="section-leaderboard" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Ranking Peserta / Kontingen
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Peringkat keaktifan, gamifikasi XP, dan prestasi kepramukaan.
              </p>
            </div>
          </div>

          {onNavigateToLeaderboard && (
            <button
              type="button"
              onClick={onNavigateToLeaderboard}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Lihat Ranking Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {leaderboardList.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <Medal className="w-6 h-6 mx-auto text-slate-400 opacity-60 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Belum ada hasil peringkat.
            </p>
            <p>Skor dan perolehan XP akan dihitung realtime saat kegiatan dan penjurian dimulai.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {leaderboardList.map((entry, idx) => (
              <div
                key={entry.id || idx}
                className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs flex flex-col items-center text-center space-y-2 relative"
              >
                <div className="absolute top-2.5 left-2.5">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      entry.rank === 1
                        ? 'bg-amber-400 text-amber-950 shadow-md'
                        : entry.rank === 2
                        ? 'bg-slate-300 text-slate-900'
                        : entry.rank === 3
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {entry.rank}
                  </span>
                </div>

                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-[#208C60] to-[#F47743] p-[1.5px] mt-2">
                  <div className="w-full h-full rounded-full bg-slate-100 dark:bg-black overflow-hidden flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300">
                    {entry.avatar ? (
                      <img
                        src={entry.avatar}
                        alt={entry.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      entry.name?.substring(0, 2).toUpperCase() || 'PR'
                    )}
                  </div>
                </div>

                <div className="w-full">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {entry.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {entry.contingentName || 'Kontingen'}
                  </p>
                </div>

                <div className="w-full pt-1.5 border-t border-black/5 dark:border-white/5 flex items-center justify-center gap-1 text-xs font-black text-[#F47743]">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>{entry.xp} XP</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderPhotoGallerySection = () => {
    return (
      <section id="section-photo-gallery" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Galeri Foto Kegiatan
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dokumentasi resmi jepretan kamera panitia di Bumi Perkemahan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToGallery?.('photos')}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Lihat Semua Foto</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {photoPreviews.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <ImageIcon className="w-6 h-6 mx-auto text-slate-400 opacity-60 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Belum ada foto yang dipublikasikan.
            </p>
            <p>Album dokumentasi resmi akan dimuat otomatis dari Google Drive kegiatan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {photoPreviews.map(photo => (
              <div
                key={photo.media_id}
                onClick={() => onNavigateToGallery?.('photos')}
                className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 hover:border-[#208C60]/50 transition-all duration-300 flex flex-col shadow-xs"
              >
                <div className="aspect-square w-full overflow-hidden bg-slate-100 dark:bg-black/40">
                  <img
                    src={photo.thumbnail_url}
                    alt={photo.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-2.5">
                  <h3 className="text-[11px] font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-[#208C60] dark:group-hover:text-[#F47743] transition-colors">
                    {photo.title}
                  </h3>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                    {photo.event_date || 'Dokumentasi'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderVideoGallerySection = () => {
    return (
      <section id="section-video-gallery" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-[#F47743]" />
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Galeri Video & Siaran Resmi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sorotan video upacara pembukaan, pensi, api unggun, dan giat prestasi.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToGallery?.('videos')}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Lihat Semua Video</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {videoPreviews.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <Film className="w-6 h-6 mx-auto text-slate-400 opacity-60 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Belum ada video dokumentasi.
            </p>
            <p>Video resmi YouTube atau Google Drive akan ditayangkan di sini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {videoPreviews.map(video => (
              <div
                key={video.media_id}
                onClick={() => setActiveVideoModal(video)}
                className="group relative cursor-pointer overflow-hidden rounded-[24px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 hover:border-[#F47743]/50 transition-all shadow-xs flex flex-col"
              >
                <div className="aspect-video w-full overflow-hidden bg-black/80 relative">
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-[#208C60] via-[#F47743] to-[#FFD36A] shadow-2xl group-hover:scale-110 transition-transform">
                      <div className="w-full h-full rounded-full bg-black/75 backdrop-blur-xs flex items-center justify-center text-white">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-mono font-bold">
                      {video.duration}
                    </div>
                  )}
                </div>

                <div className="p-3.5 space-y-1">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#F47743] transition-colors line-clamp-1">
                    {video.title}
                  </h3>
                  {video.caption && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {video.caption}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderQrScannerSection = () => {
    return (
      <section id="section-qr-scanner">
        <div className="rounded-[32px] bg-gradient-to-br from-[#208C60]/10 via-[#F47743]/10 to-amber-500/10 dark:from-[#208C60]/20 dark:via-[#141418] dark:to-black border border-black/5 dark:border-white/10 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-start gap-4 max-w-xl">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#208C60] via-[#F47743] to-[#FFD36A] text-white flex items-center justify-center shrink-0 shadow-lg text-2xl">
              <QrCode className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/80 dark:bg-black/60 border border-black/5 dark:border-white/10 text-[10px] font-bold text-[#F47743]">
                <span>FITUR UTAMA PERKEMAHAN</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Scan QR Presensi & Checkpoint
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Gunakan pemindai QR untuk presensi apel, checkpoint kegiatan alam, validasi akses tiket tamu, atau verifikasi dokumen resmi.
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto shrink-0 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => onOpenScanner?.()}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <QrCode className="w-5 h-5" />
              <span>Buka Scanner QR</span>
            </button>
            {onNavigateToLogin && (
              <button
                type="button"
                onClick={() => onNavigateToLogin()}
                className="px-5 py-3.5 rounded-2xl bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 text-slate-800 dark:text-white border border-black/10 dark:border-white/10 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk</span>
              </button>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderVisitorSection = () => {
    return (
      <section id="section-visitor" className="space-y-4">
        <div className="rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Registrasi Tamu & Visitor Pass
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bagi orang tua, pembina, atau tamu umum yang berkunjung ke Buper.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Jam Kunjungan:</span>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {portalConfig.visitor_hours || '09:00 - 17:00 WIB'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Ketentuan:</span>
                  <div className="font-bold text-slate-900 dark:text-white">Wajib Identitas & ID Card</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Area Akses:</span>
                  <div className="font-bold text-slate-900 dark:text-white">Zona Tamu & Lapangan</div>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setShowVisitorModal(true)}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Users className="w-4 h-4" />
                <span>Daftar Visitor Pass</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderVerificationSection = () => {
    return (
      <section id="section-verification" className="space-y-4">
        <div className="rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Verifikasi Sertifikat & Piagam Digital
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pusat validasi keabsahan piagam penghargaan resmi yang diterbitkan Kwartir.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyCert} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={certQuery}
                onChange={e => setCertQuery(e.target.value)}
                placeholder="Masukkan Nomor Seri Piagam (contoh: PGM/JAMRAN/2026/001)..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#F47743]"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <FileCheck className="w-4 h-4" />
              <span>Verifikasi Dokumen</span>
            </button>
          </form>

          {certSearched && certResult && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-1">
              {certResult.isValid ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>DOKUMEN ASLI & TERVERIFIKASI RESMI</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Penerima:</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {certResult.recipientName}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Jenis:</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {certResult.documentType}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Nomor Seri:</span>
                      <strong className="font-mono text-slate-900 dark:text-white font-semibold">
                        {certResult.documentNumber}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Penandatangan:</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {certResult.signatoryName}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-center gap-3 text-xs text-rose-800 dark:text-rose-200">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-bold">Nomor Dokumen Tidak Ditemukan</div>
                    <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                      Pastikan nomor seri dokumen yang Anda masukkan sesuai dengan yang tertera pada piagam resmi.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderSponsorsSection = () => {
    return (
      <section id="section-sponsors" className="space-y-3">
        <div className="text-center space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Mitra & Pendukung Resmi Kegiatan
          </div>
        </div>

        {activeSponsors.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400">
            Belum ada sponsor yang ditampilkan.
          </div>
        ) : (
          <PublicSponsorStrip />
        )}
      </section>
    );
  };

  // Section dispatcher map
  const renderSectionByKey = (key: PortalSectionKey) => {
    if (!isSectionVisible(key)) return null;

    switch (key) {
      case 'hero':
        return <React.Fragment key={key}>{renderHeroSection()}</React.Fragment>;
      case 'announcements':
        return <React.Fragment key={key}>{renderAnnouncementsSection()}</React.Fragment>;
      case 'schedule':
        return <React.Fragment key={key}>{renderScheduleSection()}</React.Fragment>;
      case 'leaderboard':
        return <React.Fragment key={key}>{renderLeaderboardSection()}</React.Fragment>;
      case 'photo_gallery':
        return <React.Fragment key={key}>{renderPhotoGallerySection()}</React.Fragment>;
      case 'video_gallery':
        return <React.Fragment key={key}>{renderVideoGallerySection()}</React.Fragment>;
      case 'qr_scanner':
        return <React.Fragment key={key}>{renderQrScannerSection()}</React.Fragment>;
      case 'visitor':
        return <React.Fragment key={key}>{renderVisitorSection()}</React.Fragment>;
      case 'verification':
        return <React.Fragment key={key}>{renderVerificationSection()}</React.Fragment>;
      case 'sponsors':
        return <React.Fragment key={key}>{renderSponsorsSection()}</React.Fragment>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-[#F47743] selection:text-white transition-colors">
      {/* 1. Header Bar with Status & Quick Navigation */}
      <div className="bg-white/95 dark:bg-[#121215]/95 backdrop-blur-md border-b border-black/5 dark:border-white/10 px-3.5 sm:px-6 py-2 flex items-center justify-between text-xs z-40 sticky top-0 transition-colors">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          ) : isUnreachable ? (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
          <span className="font-bold text-slate-900 dark:text-white">
            {isLoading
              ? 'Memuat Portal SiEpang...'
              : isUnreachable
              ? 'Mode Arsip / Offline'
              : 'Portal Publik Resmi'}
          </span>
          <span className="text-slate-400 hidden sm:inline">· SiEpang Scouting Portal</span>
        </div>

        {/* Viewport switcher & Admin link */}
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden lg:flex items-center bg-slate-100 dark:bg-white/5 rounded-lg p-0.5 border border-black/5 dark:border-white/10 mr-2">
            <button
              type="button"
              onClick={() => setDeviceViewport('desktop')}
              className={`p-1 rounded-md transition-colors ${
                deviceViewport === 'desktop'
                  ? 'bg-white dark:bg-black/50 text-[#F47743] shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Desktop 100%"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceViewport('tablet')}
              className={`p-1 rounded-md transition-colors ${
                deviceViewport === 'tablet'
                  ? 'bg-white dark:bg-black/50 text-[#F47743] shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Tablet 768px"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceViewport('mobile')}
              className={`p-1 rounded-md transition-colors ${
                deviceViewport === 'mobile'
                  ? 'bg-white dark:bg-black/50 text-[#F47743] shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Mobile 390px"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          {onNavigateToLogin && (
            <button
              type="button"
              onClick={() => onNavigateToLogin()}
              className="relative z-50 px-3 py-2.5 sm:px-3 sm:py-1.5 rounded-xl bg-[#208C60]/10 hover:bg-[#208C60]/20 active:bg-[#208C60]/25 text-[#208C60] dark:text-[#F47743] border border-[#208C60]/30 font-bold transition-colors text-xs flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] cursor-pointer touch-manipulation shrink-0"
              title="Masuk ke SiEpang"
              aria-label="Masuk ke SiEpang"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>Masuk</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Responsive Container */}
      <div className={`transition-all duration-300 flex-1 flex flex-col justify-between ${viewportWidthClass}`}>
        {/* Top Navbar with Branding & Quick Anchor Navigation */}
        <nav className="bg-white/90 dark:bg-[#121215]/90 backdrop-blur-md border-b border-black/5 dark:border-white/10 px-4 sm:px-8 py-3.5 sticky top-10 z-30 transition-colors">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#208C60] via-[#F47743] to-[#FFD36A] p-[1.5px] shadow-sm flex items-center justify-center shrink-0">
                <div className="w-full h-full rounded-[14px] bg-white dark:bg-[#121215] flex items-center justify-center font-black text-lg">
                  ⚜️
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                  {isConfigured ? event.name : 'SiEpang'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                  {isConfigured
                    ? `${event.organizationalLevel || 'Kwartir'} · ${event.campGround || 'Buper'}`
                    : 'Sistem Informasi Perkemahan Pramuka'}
                </div>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <button
                type="button"
                onClick={() => scrollToSection('section-hero')}
                className="px-2.5 py-1.5 rounded-lg hover:text-[#F47743] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Beranda
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-schedule')}
                className="px-2.5 py-1.5 rounded-lg hover:text-[#F47743] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Jadwal
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-leaderboard')}
                className="px-2.5 py-1.5 rounded-lg hover:text-[#F47743] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Ranking
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-photo-gallery')}
                className="px-2.5 py-1.5 rounded-lg hover:text-[#F47743] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Galeri
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-qr-scanner')}
                className="px-2.5 py-1.5 rounded-lg hover:text-[#F47743] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Scan QR
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-visitor')}
                className="px-2.5 py-1.5 rounded-lg hover:text-[#F47743] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Visitor
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-verification')}
                className="px-2.5 py-1.5 rounded-lg hover:text-[#F47743] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Verifikasi
              </button>
            </div>

            {/* Quick Actions / Mobile Menu Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenScanner?.()}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-[#208C60] via-[#F47743] to-[#F4A53A] hover:opacity-95 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 min-w-[38px] min-h-[38px] cursor-pointer"
                title="Buka Scanner QR"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Scan QR</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 min-w-[38px] min-h-[38px] flex items-center justify-center"
                aria-label="Menu"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pt-3 pb-2 border-t border-black/5 dark:border-white/10 mt-3 space-y-1 text-xs">
              {onNavigateToLogin && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onNavigateToLogin();
                  }}
                  className="w-full min-h-[48px] text-left px-4 py-3 mb-2 rounded-xl bg-[#208C60]/10 text-[#208C60] dark:text-[#F47743] border border-[#208C60]/25 font-bold flex items-center gap-2 touch-manipulation active:bg-[#208C60]/20"
                >
                  <LogIn className="w-5 h-5" />
                  Masuk ke SiEpang
                </button>
              )}
              <button
                type="button"
                onClick={() => scrollToSection('section-hero')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 font-semibold"
              >
                Beranda
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-announcements')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 font-semibold"
              >
                Pengumuman
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-schedule')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 font-semibold"
              >
                Jadwal Kegiatan
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-leaderboard')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 font-semibold"
              >
                Ranking Peserta
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-photo-gallery')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 font-semibold"
              >
                Galeri Foto
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-video-gallery')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 font-semibold"
              >
                Galeri Video
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-qr-scanner')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 font-semibold"
              >
                Scan QR Presensi
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-visitor')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 font-semibold"
              >
                Registrasi Tamu (Visitor)
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('section-verification')}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 font-semibold"
              >
                Verifikasi Sertifikat
              </button>
            </div>
          )}
        </nav>

        {/* Main Portal Body */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8 flex-1 w-full">
          {/* STATE 4 — NON-BLOCKING LOADING INDICATOR */}
          {isLoading && (
            <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 p-3 text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="font-semibold">
                  Memuat data kegiatan perkemahan...
                </span>
              </div>
            </div>
          )}

          {/* NON-BLOCKING MINIMAL OFFLINE INDICATOR */}
          {isUnreachable && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span>Beberapa informasi belum dapat dimuat. Menampilkan data tersimpan di perangkat.</span>
              </div>
              {onRetryConnection && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-100 font-semibold cursor-pointer shrink-0"
                >
                  {isRetrying ? 'Memeriksa...' : 'Coba Lagi'}
                </button>
              )}
            </div>
          )}

          {/* Mata lomba hanya ditampilkan jika sudah disahkan panitia di Spreadsheet. */}
          <section className="mb-8 rounded-3xl bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-lg flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500"/> Mata Lomba Resmi</h2>
              <button type="button" onClick={() => void refreshOfficialCompetitions()} className="rounded-lg px-3 py-2 text-sm bg-slate-100 dark:bg-white/10">Muat Ulang</button>
            </div>
            {competitionLoading ? <p className="text-sm text-slate-500">Memuat mata lomba resmi…</p>
              : competitionError ? <p role="alert" className="text-sm text-rose-600">{competitionError}</p>
              : officialCompetitions.length === 0 ? <p className="text-sm text-slate-500">Belum ada mata lomba yang diresmikan panitia.</p>
              : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{officialCompetitions.map(comp => (
                <div key={comp.id} className="rounded-2xl bg-slate-50 dark:bg-white/5 p-4 border border-slate-200 dark:border-white/10">
                  <div className="font-bold">{comp.title}</div>
                  <div className="text-xs text-emerald-600 font-semibold mt-1">✓ Resmi · {comp.category}</div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{comp.scheduleTime} · {comp.location}</p>
                </div>
              ))}</div>}
          </section>

          {/* DYNAMIC ORDERED PORTAL SECTIONS */}
          <div className="space-y-10">
            {portalConfig.section_order.map(key => renderSectionByKey(key))}
          </div>
        </div>

        {/* Global Footer (Preserved reusable footer) */}
        <GlobalFooter />
      </div>

      {/* Public Visitor Registration Modal */}
      {showVisitorModal && (
        <VisitorPublicRegistrationModal onClose={() => setShowVisitorModal(false)} />
      )}

      {/* Safe Video Player Modal */}
      {activeVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-[#121215] border border-black/10 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl space-y-3">
            <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/10">
              <div className="min-w-0 pr-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {activeVideoModal.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {activeVideoModal.event_date} · {activeVideoModal.provider}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-video w-full bg-black">
              {activeVideoModal.embed_url ? (
                <iframe
                  src={activeVideoModal.embed_url}
                  title={activeVideoModal.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                  <Play className="w-12 h-12 text-[#F47743]" />
                  <p className="text-xs text-slate-300">
                    Video eksternal disematkan dari tautan resmi.
                  </p>
                  <a
                    href={activeVideoModal.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#208C60] to-[#F47743] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <span>Buka Video di Tab Baru</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 pt-1 flex items-center justify-between">
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {activeVideoModal.caption || 'Video liputan resmi Jambore Pramuka.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-semibold shrink-0 ml-3 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
