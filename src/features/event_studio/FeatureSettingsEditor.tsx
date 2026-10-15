/**
 * @license
 * SiEpang - Canonical Feature Control & Participant Home Layout Editor (PART B, Sections 21-35)
 * Allows administrators to manage system modules with hierarchical resolution,
 * dependency checking, parent locks, and participant home section reordering.
 * Light-theme first modern styling with dark-mode support.
 */

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  CheckCircle2,
  Layout,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Search,
  Filter,
  Check,
  RefreshCw,
  Info,
  Layers,
  Calendar,
  Compass,
  Trophy,
  Scale,
  Zap,
  Medal,
  Award,
  UserCheck,
  Ticket,
  Globe,
  Images,
  Image as ImageIcon,
  Film,
  Megaphone,
  Bell,
  HeartHandshake,
  PhoneCall,
  Contact,
  FileCheck2,
  Stethoscope,
  AlertOctagon,
  Package,
  Database,
  Activity,
  Shield,
  Tent,
} from 'lucide-react';
import { featureControlService, CANONICAL_FEATURE_DEFINITIONS } from '../../services/featureControlService';
import { eventStudioService } from '../../services/eventStudioService';
import { SystemFeatureKey, ScoutEvent } from '../../types';

// Icon mapping helper
const getFeatureIcon = (iconName: string, category: string) => {
  const iconProps = { className: 'w-4 h-4 shrink-0' };
  switch (iconName) {
    case 'UserPlus':
    case 'Users':
      return <UserCheck {...iconProps} className="w-4 h-4 text-blue-500" />;
    case 'ShieldCheck':
    case 'Shield':
      return <ShieldCheck {...iconProps} className="w-4 h-4 text-emerald-500" />;
    case 'Layers':
      return <Layers {...iconProps} className="w-4 h-4 text-indigo-500" />;
    case 'Calendar':
      return <Calendar {...iconProps} className="w-4 h-4 text-purple-500" />;
    case 'Compass':
      return <Compass {...iconProps} className="w-4 h-4 text-teal-500" />;
    case 'LogIn':
    case 'CheckCircle2':
      return <CheckCircle2 {...iconProps} className="w-4 h-4 text-emerald-500" />;
    case 'QrCode':
    case 'MapPin':
      return <Sparkles {...iconProps} className="w-4 h-4 text-amber-500" />;
    case 'Tent':
      return <Tent {...iconProps} className="w-4 h-4 text-emerald-600" />;
    case 'Trophy':
      return <Trophy {...iconProps} className="w-4 h-4 text-amber-500" />;
    case 'Scale':
      return <Scale {...iconProps} className="w-4 h-4 text-purple-500" />;
    case 'Zap':
      return <Zap {...iconProps} className="w-4 h-4 text-amber-400" />;
    case 'Award':
    case 'Medal':
      return <Award {...iconProps} className="w-4 h-4 text-pink-500" />;
    case 'Ticket':
      return <Ticket {...iconProps} className="w-4 h-4 text-orange-500" />;
    case 'Globe':
      return <Globe {...iconProps} className="w-4 h-4 text-blue-500" />;
    case 'Images':
    case 'Image':
      return <ImageIcon {...iconProps} className="w-4 h-4 text-purple-500" />;
    case 'Film':
      return <Film {...iconProps} className="w-4 h-4 text-pink-500" />;
    case 'HeartHandshake':
      return <HeartHandshake {...iconProps} className="w-4 h-4 text-amber-500" />;
    case 'Megaphone':
      return <Megaphone {...iconProps} className="w-4 h-4 text-rose-500" />;
    case 'Bell':
      return <Bell {...iconProps} className="w-4 h-4 text-amber-500" />;
    case 'PhoneCall':
      return <PhoneCall {...iconProps} className="w-4 h-4 text-emerald-500" />;
    case 'Contact':
    case 'FileCheck2':
      return <FileCheck2 {...iconProps} className="w-4 h-4 text-blue-500" />;
    case 'Stethoscope':
      return <Stethoscope {...iconProps} className="w-4 h-4 text-rose-500" />;
    case 'AlertOctagon':
      return <AlertOctagon {...iconProps} className="w-4 h-4 text-rose-600" />;
    case 'Package':
      return <Package {...iconProps} className="w-4 h-4 text-amber-600" />;
    case 'Database':
    case 'Activity':
      return <Activity {...iconProps} className="w-4 h-4 text-indigo-500" />;
    default:
      return <Sparkles {...iconProps} className="w-4 h-4 text-purple-500" />;
  }
};

export const FeatureSettingsEditor: React.FC = () => {
  const event = eventStudioService.getEvent();
  const [homeSections, setHomeSections] = useState<ScoutEvent['homeSections']>([...event.homeSections]);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tick, setTick] = useState(0);
  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [featureLoadError, setFeatureLoadError] = useState<string | null>(null);
  const [savingFeature, setSavingFeature] = useState<SystemFeatureKey | null>(null);
  const [savingLayout, setSavingLayout] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const unsub = featureControlService.subscribe(() => {
      setTick(t => t + 1);
    });
    return () => unsub();
  }, []);

  // Server data is authoritative. Never treat seeded defaults as confirmed Spreadsheet values.
  useEffect(() => {
    let active = true;
    setLoadingFeatures(true);
    setFeatureLoadError(null);
    featureControlService.refreshAllFromSpreadsheet()
      .then(() => { if (active) setLoadingFeatures(false); })
      .catch((err: unknown) => {
        if (!active) return;
        setFeatureLoadError(err instanceof Error ? err.message : 'Gagal membaca konfigurasi dari GAS.');
        setLoadingFeatures(false);
      });
    return () => { active = false; };
  }, []);

  const retryFeatureLoad = async () => {
    setLoadingFeatures(true);
    setFeatureLoadError(null);
    try {
      await featureControlService.refreshAllFromSpreadsheet();
    } catch (err: unknown) {
      setFeatureLoadError(err instanceof Error ? err.message : 'Gagal membaca konfigurasi dari GAS.');
    } finally {
      setLoadingFeatures(false);
    }
  };

  // Canonical categories list
  const categories = [
    'ALL',
    'Publikasi & Media',
    'Kegiatan & Jadwal',
    'Registrasi & Kontingen',
    'Lomba & Penjurian',
    'Poin & Prestasi',
    'Kunjungan & Tamu',
    'Fasilitas & Penunjang',
    'Sistem & Operasional',
  ];

  // Map legacy event features for synchronization
  const legacyKeyMap: Record<string, keyof ScoutEvent['features']> = {
    ATTENDANCE: 'attendance',
    QR_CHECKPOINT: 'qrCheckpoint',
    COMPETITION: 'competition',
    VOTING: 'voting',
    POINTS_XP: 'xp',
    PARTICIPANT_LEADERBOARD: 'leaderboard',
    DIGITAL_SUBMISSION: 'digitalGallery',
    CERTIFICATE: 'certificate',
    HEALTH: 'healthPost',
    LOGISTICS: 'logistics',
    PUBLIC_DOCUMENTATION: 'publicDocumentation',
    PHOTO_DOCUMENTATION: 'photoGallery',
    VIDEO_DOCUMENTATION: 'videoGallery',
    HERO_BANNER: 'publicHeroBanner',
    SPONSOR_DISPLAY: 'sponsorDisplay',
    INFORMATION_BANNER: 'informationBanner',
  };

  const handleToggleFeature = async (key: SystemFeatureKey) => {
    if (savingFeature || loadingFeatures || featureLoadError) return;
    setSavingFeature(key);
    try {
      // GAS writes FeatureConfigs, verifies the row, and reloads authoritative state.
      const nextState = await featureControlService.toggleEventFeature(key);

      // Legacy feature flags may still be consumed by old SiEpang screens.
      // Keep them in sync with the verified value, never blindly invert a cached flag.
      const legacyKey = legacyKeyMap[key];
      if (legacyKey) {
        try {
          await eventStudioService.updateEventFeature(legacyKey, nextState);
        } catch (syncError: unknown) {
          showToast(`FeatureConfigs tersimpan, tetapi sinkronisasi fitur lama gagal: ${syncError instanceof Error ? syncError.message : String(syncError)}`);
          return;
        }
      }
      showToast(`Fitur ${key} tersimpan di Spreadsheet: ${nextState ? 'Aktif' : 'Nonaktif'}.`);
    } catch (err: unknown) {
      showToast(`❌ Gagal menyimpan: ${err instanceof Error ? err.message : String(err)}`);
      try { await featureControlService.refreshAllFromSpreadsheet(); }
      catch (reloadError: unknown) {
        setFeatureLoadError(reloadError instanceof Error ? reloadError.message : 'Gagal memuat ulang Feature Control.');
      }
    } finally {
      setSavingFeature(null);
    }
  };

  const handleToggleSection = async (sectionId: string) => {
    if (savingLayout) return;
    const previous = homeSections.map(s => ({ ...s }));
    const updated = homeSections.map(s => (s.id === sectionId ? { ...s, enabled: !s.enabled } : { ...s }));
    setSavingLayout(true);
    try {
      const confirmed = await eventStudioService.updateHomeSections(updated);
      setHomeSections(confirmed);
      showToast('Tampilan seksi beranda peserta berhasil disimpan.');
    } catch (err: unknown) {
      setHomeSections(previous);
      showToast(`❌ Gagal menyimpan tata letak: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingLayout(false);
    }
  };

  const handleMoveSection = async (index: number, direction: 'up' | 'down') => {
    if (savingLayout || (direction === 'up' && index === 0) || (direction === 'down' && index === homeSections.length - 1)) return;
    const previous = homeSections.map(s => ({ ...s }));
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = homeSections.map(s => ({ ...s }));
    [updated[index], updated[targetIdx]] = [updated[targetIdx], updated[index]];
    updated.forEach((s, idx) => { s.order = idx + 1; });
    setSavingLayout(true);
    try {
      const confirmed = await eventStudioService.updateHomeSections(updated);
      setHomeSections(confirmed);
      showToast('Urutan beranda berhasil disimpan.');
    } catch (err: unknown) {
      setHomeSections(previous);
      showToast(`❌ Gagal menyimpan urutan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingLayout(false);
    }
  };

  // Filter features
  const filteredFeatures = CANONICAL_FEATURE_DEFINITIONS.filter(def => {
    const matchCategory = selectedCategory === 'ALL' || def.category === selectedCategory;
    const matchSearch =
      !searchQuery ||
      def.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      def.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      def.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-5 right-5 p-3.5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold flex items-center justify-between shadow-xl animate-in fade-in z-50 gap-4">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-slate-400 hover:text-white dark:hover:text-black">✕</button>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-1">
        <div className="flex items-center gap-2 text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
          <Sliders className="w-3.5 h-3.5" />
          <span>Kendali Fitur & Hierarki Modul</span>
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          Aktivasi Modul & Fitur Operasional Event
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
          Sistem Feature Control hierarkis (System → Workspace → Event). Modul yang dinonaktifkan akan disembunyikan dari aplikasi tanpa menghapus data historis.
        </p>
      </div>

      {/* 2. Categorized Feature Flags Controller */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-5">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari modul atau fitur..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Menampilkan <strong>{filteredFeatures.length}</strong> modul</span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-black/5 dark:border-white/5 hover:border-black/20'
              }`}
            >
              {cat === 'ALL' ? 'Semua Kategori' : cat}
            </button>
          ))}
        </div>

        {loadingFeatures && (
          <div role="status" className="text-xs text-slate-500 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Membaca Feature Control dari Spreadsheet…
          </div>
        )}
        {featureLoadError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center justify-between gap-2">
            <span>Konfigurasi belum dapat diverifikasi dari Spreadsheet: {featureLoadError}</span>
            <button type="button" onClick={retryFeatureLoad} className="font-bold underline shrink-0">Coba lagi</button>
          </div>
        )}
        {/* Grid of Canonical Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredFeatures.map(def => {
            const detail = featureControlService.resolveFeatureDetail(def.key);
            const isEnabled = detail.effectiveEnabled;
            const isLocked = detail.isLocked;

            return (
              <div
                key={def.key}
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 text-xs ${
                  isEnabled
                    ? 'bg-slate-50/70 dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-purple-500/30'
                    : 'bg-slate-100/50 dark:bg-white/[0.01] border-dashed border-slate-200 dark:border-white/5 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 shrink-0 shadow-2xs">
                    {getFeatureIcon(def.icon, def.category)}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-slate-900 dark:text-white truncate">
                        {def.name}
                      </h4>
                      {isLocked && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Terkunci</span>
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {def.description}
                    </p>

                    {/* Dependencies info (only shown if missing/warning) */}
                    {detail.missingDependencies.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-500 font-semibold pt-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Memerlukan modul: {detail.missingDependencies.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* IOS Style Toggle Switch */}
                <button
                  type="button"
                  disabled={isLocked || loadingFeatures || !!featureLoadError || savingFeature !== null}
                  onClick={() => handleToggleFeature(def.key)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  aria-label={`Toggle ${def.name}`}
                  aria-busy={savingFeature === def.key}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Participant Home Layout & Sections Ordering */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Layout className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Tata Letak Beranda Peserta (Event Home Editor)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ubah urutan susunan dan visibilitas seksi beranda peserta agar setiap perkemahan memiliki susunan khas.
          </p>
        </div>

        <div className="space-y-2">
          {homeSections.map((sec, idx) => (
            <div
              key={sec.id}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200/50 font-mono text-[11px] font-bold flex items-center justify-center">
                  #{sec.order}
                </span>
                <span className={`font-semibold ${sec.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through'}`}>
                  {sec.title}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={savingLayout || idx === 0}
                  onClick={() => handleMoveSection(idx, 'up')}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-20 transition-colors"
                  title="Naikkan Urutan"
                  aria-label="Naik"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={savingLayout || idx === homeSections.length - 1}
                  onClick={() => handleMoveSection(idx, 'down')}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-20 transition-colors"
                  title="Turunkan Urutan"
                  aria-label="Turun"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSection(sec.id)}
                  disabled={savingLayout}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    sec.enabled
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200/50'
                      : 'bg-slate-200/60 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                  }`}
                >
                  {sec.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{sec.enabled ? 'Tampil' : 'Sembunyi'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
