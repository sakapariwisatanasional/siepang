/**
 * @license
 * SiEpang - Event Readiness Center & Operational Integrity Center
 * Live computed readiness scoring, schedule conflicts, campsite overflow,
 * competition rubrics completion, and feature flag dependencies.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Tent,
  Trophy,
  Users,
  Sliders,
  Phone,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { eventStudioService } from '../../services/eventStudioService';
import {
  EventReadinessReport,
  ScheduleConflict,
  CampsiteCapacityReport,
  CompetitionReadiness,
} from '../../types';
import { StudioSection } from './EventManagementStudio';

interface EventReadinessCenterProps {
  onNavigateSection: (section: StudioSection) => void;
}


type BackendReadinessSummary = {
  eventId?: string;
  ready?: boolean;
  scheduleCount?: number;
  activityCount?: number;
  campsiteLotCount?: number;
  competitionCount?: number;
  scorePercentage?: number;
  calculatedAt?: string;
  status?: string;
  sections?: Record<string, any>;
  actionableWarnings?: any[];
};

const asFiniteNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeReadinessReport = (raw: unknown): EventReadinessReport => {
  const source = (raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw
    : {}) as BackendReadinessSummary & Record<string, any>;

  // Preserve the richer legacy report unchanged when the backend already sends it.
  if (
    typeof source.scorePercentage === 'number' &&
    source.sections &&
    typeof source.sections === 'object' &&
    Array.isArray(source.actionableWarnings)
  ) {
    return {
      ...source,
      calculatedAt: String(source.calculatedAt || new Date().toLocaleTimeString('id-ID')),
      status: String(source.status || 'operational_check'),
      scorePercentage: Math.max(0, Math.min(100, asFiniteNumber(source.scorePercentage))),
      actionableWarnings: source.actionableWarnings,
    } as unknown as EventReadinessReport;
  }

  const event = eventStudioService.getEvent();
  const scheduleCount = asFiniteNumber(source.scheduleCount);
  const activityCount = asFiniteNumber(source.activityCount);
  const campsiteLotCount = asFiniteNumber(source.campsiteLotCount);
  const competitionCount = asFiniteNumber(source.competitionCount);

  const hasIdentity = Boolean(
    source.ready &&
    event?.id &&
    event?.name &&
    event?.status
  );

  const contacts = event?.contacts || {};
  const hasEmergencyContact = Boolean(
    contacts.medical ||
    contacts.health ||
    contacts.security ||
    contacts.emergency ||
    contacts.helpdesk ||
    contacts.info
  );

  const enabledFeatures = event?.features
    ? Object.values(event.features).filter(Boolean).length
    : 0;

  const checks = [
    hasIdentity,
    scheduleCount > 0,
    activityCount > 0,
    campsiteLotCount > 0,
    competitionCount > 0,
    hasEmergencyContact,
    enabledFeatures > 0,
  ];

  const completed = checks.filter(Boolean).length;
  const scorePercentage = Math.round((completed / checks.length) * 100);

  const makeSection = (ready: boolean, summary: string, extra: Record<string, any> = {}) => ({
    ready,
    summary,
    ...extra,
  });

  const warnings: any[] = [];
  const pushWarning = (
    id: string,
    title: string,
    message: string,
    targetTab: StudioSection
  ) => {
    warnings.push({ id, title, message, targetTab });
  };

  if (!hasIdentity) {
    pushWarning(
      'identity',
      'Identitas kegiatan belum lengkap',
      'Lengkapi identitas dan status kegiatan pada Pengaturan Umum Event.',
      'general'
    );
  }
  if (scheduleCount === 0) {
    pushWarning(
      'schedule',
      'Jadwal kegiatan masih kosong',
      'Tambahkan minimal satu agenda agar kesiapan jadwal dapat diperiksa.',
      'schedule'
    );
  }
  if (activityCount === 0) {
    pushWarning(
      'activities',
      'Aktivitas belum tersedia',
      'Tambahkan aktivitas operasional yang digunakan dalam kegiatan.',
      'schedule'
    );
  }
  if (campsiteLotCount === 0) {
    pushWarning(
      'campsite',
      'Kavling perkemahan belum tersedia',
      'Tambahkan kavling atau area perkemahan untuk memvalidasi kapasitas.',
      'campsite'
    );
  }
  if (competitionCount === 0) {
    pushWarning(
      'competitions',
      'Cabang lomba belum tersedia',
      'Tambahkan cabang lomba bila fitur kompetisi digunakan.',
      'competitions'
    );
  }
  if (!hasEmergencyContact) {
    pushWarning(
      'contacts',
      'Kontak darurat belum lengkap',
      'Isi sedikitnya satu kontak posko medis, keamanan, atau helpdesk.',
      'pages_contacts'
    );
  }

  const featureWarnings: string[] = [];
  if (event?.features?.leaderboard && !event?.features?.xp) {
    featureWarnings.push('Leaderboard aktif tetapi modul XP tidak aktif.');
  }
  if (event?.features?.voting && !event?.features?.competition) {
    featureWarnings.push('Voting aktif tetapi modul kompetisi tidak aktif.');
  }
  if (event?.features?.qrCheckpoint && !event?.features?.xp) {
    featureWarnings.push('Pos QR aktif tetapi modul XP tidak aktif.');
  }

  if (featureWarnings.length > 0) {
    pushWarning(
      'features',
      'Dependensi fitur perlu diperiksa',
      featureWarnings.join(' '),
      'features'
    );
  }

  const status =
    scorePercentage >= 90
      ? 'siap_operasional'
      : scorePercentage >= 70
      ? 'perlu_perhatian'
      : 'belum_siap';

  return {
    eventId: String(source.eventId || event?.id || ''),
    calculatedAt: new Date().toLocaleTimeString('id-ID'),
    scorePercentage,
    status,
    actionableWarnings: warnings,
    sections: {
      identity: makeSection(hasIdentity, hasIdentity ? 'Identitas event tersedia' : 'Belum lengkap'),
      registration: makeSection(
        asFiniteNumber(event?.registeredCount) > 0,
        `${asFiniteNumber(event?.registeredCount)} peserta terdaftar`
      ),
      schedule: makeSection(scheduleCount > 0, `${scheduleCount} agenda`),
      campsite: makeSection(campsiteLotCount > 0, `${campsiteLotCount} kavling`),
      activities: makeSection(activityCount > 0, `${activityCount} aktivitas`),
      competitions: makeSection(competitionCount > 0, `${competitionCount} lomba`),
      certificates: makeSection(
        Boolean(event?.features?.certificate),
        event?.features?.certificate ? 'Modul sertifikat aktif' : 'Modul sertifikat tidak aktif'
      ),
      contacts: makeSection(
        hasEmergencyContact,
        hasEmergencyContact ? 'Kontak darurat tersedia' : 'Belum diisi'
      ),
      features: makeSection(
        featureWarnings.length === 0,
        featureWarnings.length === 0 ? 'Dependensi konsisten' : `${featureWarnings.length} peringatan`,
        { dependencyWarnings: featureWarnings }
      ),
    },
  } as unknown as EventReadinessReport;
};

const normalizeScheduleConflicts = (raw: unknown): ScheduleConflict[] => {
  if (!Array.isArray(raw)) return [];

  return raw.map((item: any, index: number) => ({
    ...item,
    id: String(item?.id || `conflict_${index}`),
    type: item?.type || 'venue',
    timeSlot: String(item?.timeSlot || item?.time_slot || ''),
    conflictDetail: String(
      item?.conflictDetail ||
      item?.reason ||
      'Terdapat bentrok pada jadwal kegiatan.'
    ),
  })) as ScheduleConflict[];
};

const normalizeCampsiteReport = (raw: unknown): CampsiteCapacityReport => {
  const source = (raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw
    : {}) as Record<string, any>;

  const totalCapacity = asFiniteNumber(source.totalCapacity);
  const totalAssigned = asFiniteNumber(
    source.totalAssigned ?? source.assignedCapacity
  );
  const remainingCapacity = asFiniteNumber(
    source.remainingCapacity ?? source.availableCapacity,
    Math.max(0, totalCapacity - totalAssigned)
  );

  return {
    ...source,
    totalCapacity,
    totalAssigned,
    remainingCapacity,
    isOverflow:
      typeof source.isOverflow === 'boolean'
        ? source.isOverflow
        : totalAssigned > totalCapacity && totalCapacity > 0,
    contingentsWithoutCampsite: Array.isArray(source.contingentsWithoutCampsite)
      ? source.contingentsWithoutCampsite
      : [],
  } as unknown as CampsiteCapacityReport;
};

const normalizeCompetitionReadiness = (raw: unknown): CompetitionReadiness[] => {
  if (!Array.isArray(raw)) return [];

  const competitions = eventStudioService.getCompetitions();

  return raw.map((item: any) => {
    const competitionId = String(item?.competitionId || item?.id || '');
    const existing = competitions.find(c => String(c.id) === competitionId);
    const judgeCount = asFiniteNumber(item?.checks?.judgeCount ?? item?.judgeCount);
    const criteriaCount = asFiniteNumber(item?.criteriaCount);
    const ready =
      typeof item?.isReady === 'boolean'
        ? item.isReady
        : Boolean(item?.ready);

    const issues = Array.isArray(item?.issues)
      ? item.issues
      : [
          ...(criteriaCount === 0 ? ['Kriteria penilaian belum tersedia.'] : []),
          ...(judgeCount === 0 ? ['Juri belum ditugaskan.'] : []),
        ];

    const completionPercentage =
      typeof item?.completionPercentage === 'number'
        ? item.completionPercentage
        : ready
        ? 100
        : Math.round(
            ((criteriaCount > 0 ? 1 : 0) + (judgeCount > 0 ? 1 : 0)) / 2 * 100
          );

    return {
      ...item,
      competitionId,
      competitionTitle:
        String(item?.competitionTitle || existing?.title || existing?.name || 'Cabang Lomba'),
      isReady: ready,
      completionPercentage,
      issues,
      checks: {
        ...(item?.checks || {}),
        judgeCount,
        criteriaCount,
      },
    };
  }) as CompetitionReadiness[];
};

export const EventReadinessCenter: React.FC<EventReadinessCenterProps> = ({ onNavigateSection }) => {
  const [report, setReport] = useState<EventReadinessReport | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [campsiteReport, setCampsiteReport] = useState<CampsiteCapacityReport | null>(null);
  const [compReadiness, setCompReadiness] = useState<CompetitionReadiness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Do not launch another expensive readiness batch while one is running.
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  const loadData = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (mountedRef.current) setIsLoading(true);
    setLoadError(null);

    try {
      const [repResult, confResult, campResult, compResult] = await Promise.allSettled([
        eventStudioService.getEventReadiness(),
        eventStudioService.detectScheduleConflicts(),
        eventStudioService.validateCampsiteCapacity(),
        eventStudioService.validateCompetitionReadiness(),
      ]);

      if (repResult.status === 'fulfilled') {
        setReport(normalizeReadinessReport(repResult.value));
      } else {
        console.error('Readiness summary failed:', repResult.reason);
        setLoadError(
          repResult.reason?.message ||
            'Laporan kesiapan utama gagal dimuat.'
        );
      }

      if (confResult.status === 'fulfilled') {
        setConflicts(normalizeScheduleConflicts(confResult.value));
      } else {
        console.error('Schedule conflict check failed:', confResult.reason);
        setConflicts([]);
      }

      if (campResult.status === 'fulfilled') {
        setCampsiteReport(normalizeCampsiteReport(campResult.value));
      } else {
        console.error('Campsite capacity check failed:', campResult.reason);
        setCampsiteReport(normalizeCampsiteReport(null));
      }

      if (compResult.status === 'fulfilled') {
        setCompReadiness(normalizeCompetitionReadiness(compResult.value));
      } else {
        console.error('Competition readiness check failed:', compResult.reason);
        setCompReadiness([]);
      }
    } catch (e: any) {
      console.error('Error loading readiness report:', e);
      setLoadError(e?.message || 'Gagal memuat pusat kesiapan event.');
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let mounted = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const safeLoad = async () => {
      if (!mounted || loadingRef.current) return;
      await loadData();
    };

    void safeLoad();

    // Debounce service notifications. Event Studio performs a large initial sync
    // and can notify several times in quick succession; readiness should not
    // fan those notifications into parallel GAS request storms.
    // Ignore service notifications while a batch is in flight. These can
    // otherwise create long queues against the same GAS deployment.
    const unsub = eventStudioService.subscribe(() => {
      if (loadingRef.current) return;
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        if (mounted && !loadingRef.current) void safeLoad();
      }, 1500);
    });

    return () => {
      mounted = false;
      mountedRef.current = false;
      if (reloadTimer) clearTimeout(reloadTimer);
      unsub();
    };
  }, []);

  if (isLoading && !report) {
    return (
      <div className="p-8 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 text-center space-y-3 shadow-xs">
        <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin mx-auto" />
        <p className="text-xs text-slate-600 dark:text-slate-300">Menghitung integritas operasional & kesiapan event…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 rounded-[28px] bg-white dark:bg-[#141418] border border-rose-200 dark:border-rose-500/30 space-y-3 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#171717] dark:text-white">
              Pusat Kesiapan belum dapat dimuat
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {loadError || 'Backend belum mengembalikan laporan kesiapan yang dapat ditampilkan.'}
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-2 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Coba Muat Ulang</span>
        </button>
      </div>
    );
  }

  const score = Math.max(0, Math.min(100, asFiniteNumber(report.scorePercentage)));
  const scoreColor =
    score >= 90
      ? 'from-emerald-500 to-teal-400 text-emerald-300 border-emerald-500/40'
      : score >= 70
      ? 'from-amber-500 to-yellow-400 text-amber-300 border-amber-500/40'
      : 'from-rose-500 to-red-400 text-rose-300 border-rose-500/40';

  return (
    <div className="space-y-6">
      {/* 1. Top Readiness Gauge Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#152a1d] via-[#102016] to-[#0c1710] border border-emerald-500/30 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pusat Kesiapan Lapangan</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Pembaruan: {report.calculatedAt}</span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">Event Readiness Center</h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Evaluasi otomatis integritas operasional perkemahan secara komprehensif tanpa data statis palsu.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Live Percentage Dial Badge */}
            <div className={`px-5 py-3 rounded-2xl bg-black/40 border ${scoreColor} text-center shadow-lg`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Skor Kesiapan</div>
              <div className="text-3xl font-black font-mono tracking-tight text-white mt-0.5">
                {score}%
              </div>
              <div className="text-[9px] font-bold mt-0.5 capitalize">
                {String(report.status || 'belum_siap').replace(/_/g, ' ')}
              </div>
            </div>

            <button
              onClick={loadData}
              className="p-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl border border-white/10 transition-colors"
              title="Hitung Ulang Kesiapan"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Progress Bar Gauge */}
        <div className="space-y-1.5">
          <div className="w-full bg-black/50 rounded-full h-3 p-0.5 border border-white/10">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${scoreColor} transition-all duration-700`}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Draf Awal (0%)</span>
            <span>Kesiapan Operasional Lapangan: {score}%</span>
            <span>100% Siap Kemah</span>
          </div>
        </div>

        {/* Operational Checklist Quick Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
          {Object.entries(report.sections || {}).map(([key, sec]) => {
            if (!sec) return null;
            const labelMap: Record<string, string> = {
              identity: 'Event Config',
              registration: 'Registration',
              schedule: 'Schedule',
              campsite: 'Campsite',
              activities: 'Activities',
              competitions: 'Kompetisi',
              certificates: 'Sertifikat',
              contacts: 'Kontak Darurat',
              features: 'Dependensi',
            };

            return (
              <div
                key={key}
                className={`p-2.5 rounded-2xl border text-center transition-all ${
                  sec.ready
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                }`}
              >
                <div className="text-base mb-0.5">{sec.ready ? '✓' : '⚠️'}</div>
                <div className="text-[11px] font-bold capitalize truncate">
                  {labelMap[key] || key}
                </div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5">{sec.summary}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Actionable Integrity Warnings */}
      {(report.actionableWarnings || []).length > 0 && (
        <div className="p-5 rounded-[28px] bg-amber-50/60 dark:bg-[#141418] border border-amber-200 dark:border-amber-500/30 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#171717] dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Perhatian Operasional & Catatan Integritas ({(report.actionableWarnings || []).length})</span>
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Klik 'Perbaiki' untuk membuka modul</span>
          </div>

          <div className="space-y-2.5">
            {(report.actionableWarnings || []).map(warn => (
              <div
                key={warn.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-black/40 border border-[#ECECEF] dark:border-white/5 hover:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors shadow-xs"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                  <div>
                    <div className="font-bold text-[#171717] dark:text-white">{warn.title}</div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5 text-[11px] leading-relaxed">{warn.message}</div>
                  </div>
                </div>

                <button
                  onClick={() => onNavigateSection(warn.targetTab as StudioSection)}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-[11px] flex items-center gap-1.5 self-start sm:self-center border border-amber-200 dark:border-amber-500/30 shrink-0 transition-colors cursor-pointer"
                >
                  <span>Perbaiki</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Detailed Validation Modules Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module A: Schedule Conflicts Inspector */}
        <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-[#171717] dark:text-white">Deteksi Bentrok Jadwal & Lokasi</h3>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              conflicts.length === 0 ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-transparent' : 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-transparent'
            }`}>
              {conflicts.length === 0 ? '✓ Tidak Ada Bentrok' : `${conflicts.length} Konflik`}
            </span>
          </div>

          {conflicts.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-black/30 border border-[#ECECEF] dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Seluruh slot agenda waktu dan lokasi lapangan aman tanpa tumpang tindih.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
              {conflicts.map(c => (
                <div key={c.id} className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 space-y-1">
                  <div className="font-bold text-rose-700 dark:text-rose-300 flex items-center justify-between">
                    <span>{c.type === 'venue' ? '🏟️ Bentrok Lapangan' : '👥 Bentrok Peserta'}</span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{c.timeSlot}</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-200">{c.conflictDetail}</p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => onNavigateSection('schedule')}
            className="w-full py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span>Buka Editor Jadwal & Aktivitas</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Module B: Campsite Capacity & Overflow */}
        <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tent className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-[#171717] dark:text-white">Daya Tampung Buper & Alokasi</h3>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              !campsiteReport?.isOverflow ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-transparent' : 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-transparent'
            }`}>
              {campsiteReport?.isOverflow ? '⚠️ Melebihi Kuota' : '✓ Kapasitas Cukup'}
            </span>
          </div>

          {campsiteReport && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Total Kuota</div>
                  <div className="text-sm font-black text-[#171717] dark:text-white font-mono mt-0.5">{campsiteReport.totalCapacity}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Terisi</div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{campsiteReport.totalAssigned}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Sisa Kuota</div>
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">{campsiteReport.remainingCapacity}</div>
                </div>
              </div>

              {campsiteReport.contingentsWithoutCampsite.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-200">
                  <strong>{campsiteReport.contingentsWithoutCampsite.length} Kontingen</strong> belum dialokasikan kavling tenda.
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => onNavigateSection('campsite')}
            className="w-full py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span>Buka Manajemen Tata Ruang Buper</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Module C: Competition Rubrics & Judges Readiness */}
        <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-[#171717] dark:text-white">Kesiapan Cabang Lomba & Juri</h3>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{compReadiness.length} Lomba</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
            {compReadiness.map(cr => (
              <div key={cr.competitionId} className="p-3 rounded-2xl bg-[#FAFAFA] dark:bg-black/40 border border-[#ECECEF] dark:border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#171717] dark:text-white">{cr.competitionTitle}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    cr.isReady ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-transparent' : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-transparent'
                  }`}>
                    {cr.completionPercentage}% Siap
                  </span>
                </div>
                {cr.issues.length > 0 ? (
                  <ul className="text-[10px] text-amber-700 dark:text-amber-300 space-y-0.5 pl-3 list-disc">
                    {cr.issues.map((iss, i) => (
                      <li key={i}>{iss}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Rubrik 100%, Juri ({cr.checks.judgeCount} orang) & arena siap.</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigateSection('competitions')}
            className="w-full py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span>Buka Studio Lomba & Penjurian</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Module D: Feature Flag Dependency Integrity */}
        <div className="p-5 rounded-[28px] bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-bold text-[#171717] dark:text-white">Konsistensi Dependensi Fitur</h3>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              report.sections?.features?.ready ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-transparent' : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-transparent'
            }`}>
              {report.sections?.features?.ready ? '✓ Sinkron' : '⚠️ Perlu Penyesuaian'}
            </span>
          </div>

          {(report.sections?.features?.dependencyWarnings || []).length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-black/30 border border-[#ECECEF] dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Seluruh relasi fitur (XP, Leaderboard, Voting, Pos QR) saling konsisten.</span>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {(report.sections?.features?.dependencyWarnings || []).map((w, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-200">
                  {w}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => onNavigateSection('features')}
            className="w-full py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span>Buka Sakelar Modul & Beranda</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
