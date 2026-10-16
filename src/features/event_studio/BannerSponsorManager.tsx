/**
 * @license
 * SiEpang - Banner & Sponsor Management Studio (Part A, Sections 1-20 & Milestone v1.4)
 * - Hero Banners, Public Information Banners
 * - Sponsor Logo Carousel Management & Settings
 * - Icon-first reordering (Naik, Turun, Aktif/Nonaktif, Edit, Hapus)
 * - Real-time logo validation (CHECKING, ACCESSIBLE, INVALID_URL, PRIVATE, etc.)
 * - Live Marquee Carousel Preview
 * - Light-theme first modern styling with dark-mode support
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Sliders,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Layers,
  Award,
  Bell,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  Globe,
  RefreshCw,
  Gauge,
  Image as ImageIcon,
  Check,
  X,
  Play,
  RotateCcw,
} from 'lucide-react';
import { bannerSponsorService } from '../../services/bannerSponsorService';
import { mediaResolverService } from '../../services/mediaResolverService';
import {
  BannerItem,
  SponsorItem,
  BannerType,
  BannerPreset,
  BannerFitMode,
  BannerPriority,
  SponsorTier,
  MediaPublicationStatus,
  MediaAccessStatus,
  SponsorCarouselConfig,
} from '../../types';

interface BannerSponsorManagerProps {
  initialTab?: 'hero' | 'sponsors' | 'info_banners' | 'rotator_settings';
}

export const BannerSponsorManager: React.FC<BannerSponsorManagerProps> = ({
  initialTab = 'hero',
}) => {
  const [activeTab, setActiveTab] = useState<'hero' | 'sponsors' | 'info_banners' | 'rotator_settings'>(
    initialTab === ('partner' as any) ? 'sponsors' : initialTab
  );
  const [banners, setBanners] = useState<BannerItem[]>(bannerSponsorService.getBanners());
  const [sponsors, setSponsors] = useState<SponsorItem[]>(bannerSponsorService.getSponsors());
  const [rotatorConfig, setRotatorConfig] = useState(bannerSponsorService.getRotatorConfig());
  const [carouselConfig, setCarouselConfig] = useState<SponsorCarouselConfig>(
    bannerSponsorService.getCarouselConfig()
  );

  // Toast state
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const reloadData = () => {
    setBanners(bannerSponsorService.getBanners());
    setSponsors(bannerSponsorService.getSponsors());
    setRotatorConfig(bannerSponsorService.getRotatorConfig());
    setCarouselConfig(bannerSponsorService.getCarouselConfig());
  };

  useEffect(() => {
    const unsub = bannerSponsorService.subscribe(reloadData);
    bannerSponsorService.refreshSettingsFromGas().catch(err => showToast(`Gagal memuat pengaturan GAS: ${err.message}`));
    return () => unsub();
  }, []);

  // Sync initial tab when changed from props
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab === ('partner' as any) ? 'sponsors' : initialTab);
    }
  }, [initialTab]);

  // ==================== HERO / INFO BANNER MODAL STATE ====================
  const [showAddBannerModal, setShowAddBannerModal] = useState(false);
  const [bannerForm, setBannerForm] = useState({
    banner_type: 'HERO' as BannerType,
    title: '',
    subtitle: '',
    image_url: '',
    desktop_preset: 'BILLBOARD' as BannerPreset,
    mobile_preset: 'LARGE_MOBILE_BANNER' as BannerPreset,
    fit_mode: 'COVER' as BannerFitMode,
    focal_x: 50,
    focal_y: 50,
    target_type: 'INTERNAL_ROUTE' as 'NONE' | 'INTERNAL_ROUTE' | 'EXTERNAL_URL',
    target_url: 'schedule',
    cta_label: 'Lihat Selengkapnya',
    display_location: 'PUBLIC_HOME_TOP' as any,
    priority: 'NORMAL' as BannerPriority,
    publish_start: '2026-10-01',
    publish_end: '2026-10-15',
  });

  // ==================== SPONSOR MODAL STATE & VALIDATION ====================
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);
  const [sponsorForm, setSponsorForm] = useState({
    logo_url: '',
    target_url: '',
    sponsor_name: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [logoValidationStatus, setLogoValidationStatus] = useState<MediaAccessStatus>('CHECKING');
  const [logoValidationMsg, setLogoValidationMsg] = useState<string>('');
  const [isValidatingLogo, setIsValidatingLogo] = useState(false);

  // Validate logo URL on change
  useEffect(() => {
    if (!showSponsorModal) return;

    const trimmedUrl = sponsorForm.logo_url.trim();
    if (!trimmedUrl) {
      setLogoValidationStatus('INVALID_URL');
      setLogoValidationMsg('Masukkan URL logo yang valid.');
      return;
    }

    setIsValidatingLogo(true);
    setLogoValidationStatus('CHECKING');
    setLogoValidationMsg('Memeriksa aksesibilitas logo...');

    const timer = setTimeout(() => {
      // Validate via MediaResolver
      const resolved = mediaResolverService.resolveMedia(trimmedUrl);
      if (!resolved.isValid || resolved.accessStatus === 'INVALID_URL') {
        setLogoValidationStatus('INVALID_URL');
        setLogoValidationMsg('Logo tidak dapat dimuat. Periksa URL gambar.');
        setIsValidatingLogo(false);
        return;
      }

      if (resolved.accessStatus === 'PRIVATE') {
        setLogoValidationStatus('PRIVATE');
        setLogoValidationMsg('Berkas logo berstatus privat. Pastikan akses dibagikan ke Publik.');
        setIsValidatingLogo(false);
        return;
      }

      if (resolved.accessStatus === 'BROKEN_SOURCE' || resolved.accessStatus === 'NOT_FOUND') {
        setLogoValidationStatus('BROKEN_SOURCE');
        setLogoValidationMsg('Logo tidak dapat dimuat. Periksa URL gambar.');
        setIsValidatingLogo(false);
        return;
      }

      // Preload image test
      const img = new Image();
      img.onload = () => {
        setLogoValidationStatus('ACCESSIBLE');
        setLogoValidationMsg('Logo siap digunakan (Akses publik terverifikasi).');
        setIsValidatingLogo(false);
      };
      img.onerror = () => {
        setLogoValidationStatus('BROKEN_SOURCE');
        setLogoValidationMsg('Logo tidak dapat dimuat. Periksa URL gambar.');
        setIsValidatingLogo(false);
      };
      img.src = resolved.thumbnailUrl || trimmedUrl;
    }, 400);

    return () => clearTimeout(timer);
  }, [sponsorForm.logo_url, showSponsorModal]);

  const handleOpenAddSponsor = () => {
    setEditingSponsorId(null);
    setSponsorForm({
      logo_url: '',
      target_url: '',
      sponsor_name: '',
      status: 'ACTIVE',
    });
    setLogoValidationStatus('CHECKING');
    setLogoValidationMsg('');
    setShowSponsorModal(true);
  };

  const handleOpenEditSponsor = (sponsor: SponsorItem) => {
    setEditingSponsorId(sponsor.sponsor_id);
    setSponsorForm({
      logo_url: sponsor.logo_url,
      target_url: sponsor.target_url || sponsor.website_url || '',
      sponsor_name: sponsor.sponsor_name || '',
      status: sponsor.status || 'ACTIVE',
    });
    setShowSponsorModal(true);
  };

  const handleSaveSponsor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorForm.logo_url.trim()) return;

    if (logoValidationStatus === 'INVALID_URL' || logoValidationStatus === 'BROKEN_SOURCE') {
      alert('Logo tidak dapat dimuat. Periksa URL gambar sebelum menyimpan.');
      return;
    }

    try {
      if (editingSponsorId) {
        bannerSponsorService.updateSponsor(editingSponsorId, {
          logo_url: sponsorForm.logo_url.trim(),
          target_url: sponsorForm.target_url.trim() || undefined,
          website_url: sponsorForm.target_url.trim() || undefined,
          sponsor_name: sponsorForm.sponsor_name.trim() || undefined,
          status: sponsorForm.status,
          publication_status: sponsorForm.status === 'ACTIVE' ? 'PUBLISHED' : 'ARCHIVED',
        });
        showToast('✓ Logo sponsor berhasil diperbarui.');
      } else {
        bannerSponsorService.createSponsor({
          logo_url: sponsorForm.logo_url.trim(),
          target_url: sponsorForm.target_url.trim() || undefined,
          sponsor_name: sponsorForm.sponsor_name.trim() || undefined,
          status: sponsorForm.status,
        });
        showToast('✓ Logo sponsor baru berhasil ditambahkan.');
      }
      setShowSponsorModal(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleSponsor = (id: string) => {
    try {
      const res = bannerSponsorService.toggleSponsorStatus(id);
      showToast(`Status logo diubah menjadi ${res.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReorder = (id: string, dir: 'UP' | 'DOWN') => {
    bannerSponsorService.reorderSponsor(id, dir);
  };

  const handleDeleteSponsor = (id: string) => {
    if (confirm('Hapus logo sponsor ini dari sistem?')) {
      bannerSponsorService.deleteSponsor(id);
      showToast('Logo sponsor berhasil dihapus.');
    }
  };

  // Carousel config handlers
  const handleUpdateCarouselSpeed = async (seconds: number) => {
    try {
      const updated = await bannerSponsorService.updateCarouselConfig({ carousel_duration_seconds: seconds });
      setCarouselConfig(updated);
    } catch (err: any) { showToast(`Gagal menyimpan ke GAS: ${err.message}`); }
  };

  const handleToggleCarousel = async (enabled: boolean) => {
    try {
      const updated = await bannerSponsorService.updateCarouselConfig({ enabled });
      setCarouselConfig(updated);
      showToast(`Carousel sponsor ${enabled ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err: any) { showToast(`Gagal menyimpan ke GAS: ${err.message}`); }
  };

  const handleCreateBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerForm.title || !bannerForm.image_url) return;

    try {
      bannerSponsorService.createBanner(bannerForm);
      setShowAddBannerModal(false);
      setBannerForm({
        banner_type: 'HERO',
        title: '',
        subtitle: '',
        image_url: '',
        desktop_preset: 'BILLBOARD',
        mobile_preset: 'LARGE_MOBILE_BANNER',
        fit_mode: 'COVER',
        focal_x: 50,
        focal_y: 50,
        target_type: 'INTERNAL_ROUTE',
        target_url: 'schedule',
        cta_label: 'Lihat Selengkapnya',
        display_location: 'PUBLIC_HOME_TOP',
        priority: 'NORMAL',
        publish_start: '2026-10-01',
        publish_end: '2026-10-15',
      });
      showToast('✓ Banner berhasil dibuat.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const heroBanners = banners.filter(b => b.banner_type === 'HERO');
  const infoBanners = banners.filter(b => b.banner_type === 'INFORMATION' || b.banner_type === 'PUBLIC_SERVICE');
  const activeSponsors = sponsors.filter(s => s.status !== 'INACTIVE');

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 p-3.5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold flex items-center justify-between shadow-xl animate-in fade-in z-50 gap-4">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white dark:hover:text-black">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            <Award className="w-3.5 h-3.5" />
            <span>Manajemen Banner & Sponsor Resmi</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Banner & Sponsor Portal Publik
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            Kelola hero billboard, carousel sponsor, running logo partner, dan pengumuman visual di portal perkemahan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'sponsors' ? (
            <button
              type="button"
              onClick={handleOpenAddSponsor}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#208C60] to-[#F47743] text-white text-xs font-bold flex items-center gap-2 shadow-xs hover:opacity-95 active:scale-98 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Logo Sponsor</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setBannerForm({
                  ...bannerForm,
                  banner_type: activeTab === 'info_banners' ? 'INFORMATION' : 'HERO',
                });
                setShowAddBannerModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#208C60] to-[#F47743] text-white text-xs font-bold flex items-center gap-2 shadow-xs hover:opacity-95 active:scale-98 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{activeTab === 'info_banners' ? 'Tambah Info Banner' : 'Tambah Hero Banner'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-[#1A1A1E] border border-black/5 dark:border-white/5">
        <button
          type="button"
          onClick={() => setActiveTab('sponsors')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'sponsors'
              ? 'bg-white dark:bg-[#121215] text-[#208C60] dark:text-[#F47743] shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-amber-500" />
          <span>Sponsor & Partner ({sponsors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hero')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'hero'
              ? 'bg-white dark:bg-[#121215] text-[#208C60] dark:text-[#F47743] shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span>Hero Banners ({heroBanners.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('info_banners')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'info_banners'
              ? 'bg-white dark:bg-[#121215] text-[#208C60] dark:text-[#F47743] shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-pink-500" />
          <span>Info Darurat ({infoBanners.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rotator_settings')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'rotator_settings'
              ? 'bg-white dark:bg-[#121215] text-[#208C60] dark:text-[#F47743] shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-orange-500" />
          <span>Pengaturan Rotasi</span>
        </button>
      </div>

      {/* ==================== TAB: SPONSORS (Part A, Sections 1-20) ==================== */}
      {activeTab === 'sponsors' && (
        <div className="space-y-6">
          {/* SECTION 11-14: PENGATURAN CAROUSEL & LIVE PREVIEW */}
          <div className="rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/5 dark:border-white/5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Pengaturan Carousel Sponsor</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Konfigurasi running logo marquee tanpa celah (seamless continuous loop).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Status Carousel:
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleCarousel(!carouselConfig.enabled)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    carouselConfig.enabled
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/10 dark:text-slate-400 dark:border-white/10'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${carouselConfig.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span>{carouselConfig.enabled ? 'Aktif (Running)' : 'Nonaktif (Static)'}</span>
                </button>
              </div>
            </div>

            {/* Speed & Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Speed Presets & Slider */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Kecepatan Putaran Marquee
                  </span>
                  <span className="font-mono font-bold text-[#208C60] dark:text-[#F47743] bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-md border border-purple-200/50 dark:border-purple-500/30">
                    {carouselConfig.carousel_duration_seconds} detik
                  </span>
                </div>

                {/* Preset Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateCarouselSpeed(15)}
                    className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-center ${
                      carouselConfig.carousel_duration_seconds === 15
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white dark:bg-[#18181B] text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/10 hover:border-purple-400'
                    }`}
                  >
                    Cepat (15s)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateCarouselSpeed(30)}
                    className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-center ${
                      carouselConfig.carousel_duration_seconds === 30
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white dark:bg-[#18181B] text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/10 hover:border-purple-400'
                    }`}
                  >
                    Normal (30s)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateCarouselSpeed(60)}
                    className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-center ${
                      carouselConfig.carousel_duration_seconds === 60
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white dark:bg-[#18181B] text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/10 hover:border-purple-400'
                    }`}
                  >
                    Lambat (60s)
                  </button>
                </div>

                {/* Slider */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Lambat (120s)</span>
                    <span>Sangat Cepat (10s)</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={carouselConfig.carousel_duration_seconds}
                    onChange={e => handleUpdateCarouselSpeed(Number(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                </div>
              </div>

              {/* Behavior & Options */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Arah Gerak & Interaksi Pengguna
                </span>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#18181B] border border-black/5 dark:border-white/10">
                  <span className="text-slate-700 dark:text-slate-300">Arah Gerak Marquee:</span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1 font-mono">
                    Kanan → Kiri
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#18181B] border border-black/5 dark:border-white/10">
                  <span className="text-slate-700 dark:text-slate-300">Jeda saat Hover Mouse:</span>
                  <input
                    type="checkbox"
                    checked={carouselConfig.pauseOnHover}
                    onChange={async e => {
                      try { const updated = await bannerSponsorService.updateCarouselConfig({
                        pauseOnHover: e.target.checked,
                      });
                      setCarouselConfig(updated); } catch (err: any) { showToast(`Gagal menyimpan ke GAS: ${err.message}`); }
                    }}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#18181B] border border-black/5 dark:border-white/10">
                  <span className="text-slate-700 dark:text-slate-300">Jeda saat Sentuhan Mobile:</span>
                  <input
                    type="checkbox"
                    checked={carouselConfig.pauseOnTouch}
                    onChange={async e => {
                      try { const updated = await bannerSponsorService.updateCarouselConfig({
                        pauseOnTouch: e.target.checked,
                      });
                      setCarouselConfig(updated); } catch (err: any) { showToast(`Gagal menyimpan ke GAS: ${err.message}`); }
                    }}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 14: LIVE CAROUSEL PREVIEW */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-purple-600" />
                  <span>Preview Carousel (Real-time Durasi {carouselConfig.carousel_duration_seconds}s)</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Arah: Kanan → Kiri · Latar: Putih Bersih
                </span>
              </div>

              {/* Strict white background preview container */}
              <div className="rounded-2xl bg-white border border-slate-200/90 p-4 overflow-hidden relative shadow-inner">
                {activeSponsors.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Belum ada logo sponsor aktif. Klik "Tambah Logo Sponsor" untuk memulai.
                  </div>
                ) : (
                  <div
                    className="relative w-full overflow-hidden bg-white"
                    style={{ '--marquee-duration': `${carouselConfig.carousel_duration_seconds}s` } as React.CSSProperties}
                  >
                    <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10" />
                    <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />

                    <div className={carouselConfig.enabled ? 'animate-marquee' : 'flex flex-wrap items-center justify-center gap-6'}>
                      {/* Track A */}
                      <div className="flex items-center gap-8 shrink-0 pr-8">
                        {activeSponsors.map((s, idx) => (
                          <div
                            key={`prevA_${s.sponsor_id}_${idx}`}
                            className="h-12 w-28 flex items-center justify-center p-1 shrink-0"
                          >
                            <img
                              src={s.logo_url}
                              alt={s.sponsor_name || 'Logo'}
                              className="max-h-10 max-w-[110px] w-auto h-auto object-contain"
                              onError={e => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Track B for seamless loop */}
                      {carouselConfig.enabled && (
                        <div className="flex items-center gap-8 shrink-0 pr-8" aria-hidden="true">
                          {activeSponsors.map((s, idx) => (
                            <div
                              key={`prevB_${s.sponsor_id}_${idx}`}
                              className="h-12 w-28 flex items-center justify-center p-1 shrink-0"
                            >
                              <img
                                src={s.logo_url}
                                alt={s.sponsor_name || 'Logo'}
                                className="max-h-10 max-w-[110px] w-auto h-auto object-contain"
                                onError={e => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: SPONSOR LOGO LIST (ICON-FIRST REORDERABLE ROW UI) */}
          <div className="rounded-[28px] bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Daftar Logo Sponsor & Mitra ({sponsors.length})</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Format publik: HANYA LOGO (tanpa nama, tanpa tier, tanpa teks deskripsi).
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddSponsor}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-xs hover:opacity-90 transition-all self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Logo</span>
              </button>
            </div>

            {/* Icon-First Minimal Row Layout (Section 4) */}
            <div className="space-y-2">
              {sponsors.map((sponsor, index) => {
                const isActive = sponsor.status !== 'INACTIVE';
                const isFirst = index === 0;
                const isLast = index === sponsors.length - 1;

                return (
                  <div
                    key={sponsor.sponsor_id}
                    className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-slate-50/60 dark:bg-white/5 border-black/5 dark:border-white/5'
                        : 'bg-slate-100/50 dark:bg-white/[0.02] border-dashed border-slate-300 dark:border-white/10 opacity-70'
                    }`}
                  >
                    {/* Left: Drag Index + Logo Slot + Metadata */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 text-[11px] font-mono font-bold text-slate-500 flex items-center justify-center shrink-0">
                        #{index + 1}
                      </div>

                      {/* White Box for True Logo Colors & Aspect Ratio (Section 7 & 8) */}
                      <div className="w-24 sm:w-28 h-12 rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={sponsor.logo_url}
                          alt={sponsor.sponsor_name || 'Logo'}
                          className="max-h-10 max-w-[90px] sm:max-w-[100px] w-auto h-auto object-contain"
                          onError={e => {
                            (e.target as HTMLElement).setAttribute('src', 'https://placehold.co/120x60/f1f5f9/64748b?text=Broken');
                          }}
                        />
                      </div>

                      {/* Info & Status Dot */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {sponsor.sponsor_name || `Logo #${index + 1}`}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                            }`}
                          >
                            {isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>

                        {/* Optional Target Link */}
                        {(sponsor.target_url || sponsor.website_url) && (
                          <a
                            href={sponsor.target_url || sponsor.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 mt-0.5 truncate max-w-xs"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{sponsor.target_url || sponsor.website_url}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Right: Icon-First Action Controls (Section 4) */}
                    <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                      {/* Reorder UP */}
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleReorder(sponsor.sponsor_id, 'UP')}
                        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Geser Naik"
                        aria-label="Naik"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      {/* Reorder DOWN */}
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleReorder(sponsor.sponsor_id, 'DOWN')}
                        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Geser Turun"
                        aria-label="Turun"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      {/* Toggle Active / Inactive */}
                      <button
                        type="button"
                        onClick={() => handleToggleSponsor(sponsor.sponsor_id)}
                        className={`p-2 rounded-xl transition-colors ${
                          isActive
                            ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            : 'text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/10'
                        }`}
                        title={isActive ? 'Nonaktifkan Logo' : 'Aktifkan Logo'}
                        aria-label="Toggle Status"
                      >
                        {isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditSponsor(sponsor)}
                        className="p-2 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                        title="Edit Logo"
                        aria-label="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSponsor(sponsor.sponsor_id)}
                        className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Hapus Logo"
                        aria-label="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {sponsors.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 rounded-2xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/10">
                  Belum ada logo sponsor terdaftar. Klik tombol "+ Tambah Logo" di atas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB: HERO BANNERS ==================== */}
      {activeTab === 'hero' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {heroBanners.map(banner => (
              <div
                key={banner.banner_id}
                className="rounded-3xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 overflow-hidden shadow-xs flex flex-col justify-between"
              >
                {/* Visual Banner Preview Container */}
                <div className="aspect-[970/250] w-full bg-black relative overflow-hidden">
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                    style={{
                      objectFit: banner.fit_mode.toLowerCase() as any,
                      objectPosition: `${banner.focal_x}% ${banner.focal_y}%`,
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 flex flex-col justify-end">
                    <span className="text-[10px] text-amber-300 font-bold uppercase font-mono">
                      {banner.desktop_preset} (970×250) · Focal: {banner.focal_x}%, {banner.focal_y}%
                    </span>
                    <h3 className="text-sm font-bold text-white line-clamp-1">{banner.title}</h3>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Status Publikasi:</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                      {banner.publication_status}
                    </span>
                  </div>

                  {banner.subtitle && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{banner.subtitle}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[9px]">Impresi:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{banner.impressions_count} tayang</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[9px]">Klik:</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">{banner.clicks_count} klik</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                    <button
                      onClick={() => {
                        const next: MediaPublicationStatus =
                          banner.publication_status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
                        bannerSponsorService.updateBanner(banner.banner_id, { publication_status: next });
                        showToast(`Banner diubah ke ${next}.`);
                      }}
                      className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      {banner.publication_status === 'PUBLISHED' ? 'Arsipkan' : 'Aktifkan'}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Hapus banner '${banner.title}'?`)) {
                          bannerSponsorService.deleteBanner(banner.banner_id);
                          showToast('Banner dihapus.');
                        }
                      }}
                      className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs"
                      title="Hapus Banner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB: INFO BANNERS ==================== */}
      {activeTab === 'info_banners' && (
        <div className="space-y-3">
          {infoBanners.map(banner => (
            <div
              key={banner.banner_id}
              className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
            >
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    banner.priority === 'URGENT'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200/60'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200/60'
                  }`}>
                    {banner.priority}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{banner.title}</h4>
                </div>
                {banner.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{banner.subtitle}</p>
                )}
                <div className="text-[10px] text-slate-400 font-mono">
                  Posisi: {banner.display_location} · CTA: {banner.cta_label || '-'}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (confirm(`Hapus pengumuman banner '${banner.title}'?`)) {
                      bannerSponsorService.deleteBanner(banner.banner_id);
                      showToast('Info banner dihapus.');
                    }
                  }}
                  className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== TAB: ROTATOR CONFIGURATION ==================== */}
      {activeTab === 'rotator_settings' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#121215] border border-black/5 dark:border-white/10 space-y-4 max-w-xl shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Pengaturan Rotasi Hero Banner</span>
          </h3>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mode Rotator</label>
              <select
                value={rotatorConfig.mode}
                onChange={async e => {
                  try {
                    setRotatorConfig(await bannerSponsorService.updateRotatorConfig({ mode: e.target.value as any }));
                    showToast('Mode rotator tersimpan di GAS.');
                  } catch (err: any) { showToast(`Gagal menyimpan ke GAS: ${err.message}`); }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              >
                <option value="AUTO_ROTATE">Auto Rotate (Rotasi Otomatis Berkala)</option>
                <option value="CAROUSEL">Carousel (Manual Navigasi)</option>
                <option value="STATIC">Static (Hanya Banner Teratas)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Interval Rotasi ({rotatorConfig.rotationIntervalSeconds} detik)
              </label>
              <input
                type="range"
                min="3"
                max="15"
                step="1"
                value={rotatorConfig.rotationIntervalSeconds}
                onChange={async e => {
                  try { setRotatorConfig(await bannerSponsorService.updateRotatorConfig({ rotationIntervalSeconds: Number(e.target.value) })); }
                  catch (err: any) { showToast(`Gagal menyimpan ke GAS: ${err.message}`); }
                }}
                className="w-full accent-purple-600"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-black/5 dark:border-white/5">
              <span className="text-slate-700 dark:text-slate-300">Tampilkan Titik Navigasi (Dots):</span>
              <input
                type="checkbox"
                checked={rotatorConfig.showNavigationDots}
                onChange={async e => {
                  try { setRotatorConfig(await bannerSponsorService.updateRotatorConfig({ showNavigationDots: e.target.checked })); }
                  catch (err: any) { showToast(`Gagal menyimpan ke GAS: ${err.message}`); }
                }}
                className="w-4 h-4 accent-purple-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">Dukungan Geser Layar Sentuh (Mobile Swipe):</span>
              <input
                type="checkbox"
                checked={rotatorConfig.enableMobileSwipe}
                onChange={async e => {
                  try { setRotatorConfig(await bannerSponsorService.updateRotatorConfig({ enableMobileSwipe: e.target.checked })); }
                  catch (err: any) { showToast(`Gagal menyimpan ke GAS: ${err.message}`); }
                }}
                className="w-4 h-4 accent-purple-600 rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD / EDIT SPONSOR LOGO (Sections 5 & 6) ==================== */}
      {showSponsorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#121215] border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingSponsorId ? 'Edit Logo Sponsor' : 'Tambah Logo Sponsor Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSponsorModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSponsor} className="space-y-4 text-xs">
              {/* URL Logo Input */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  URL Logo Gambar *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://... atau tautan Google Drive file gambar"
                  value={sponsorForm.logo_url}
                  onChange={e => setSponsorForm({ ...sponsorForm, logo_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Mendukung URL gambar langsung (.png, .svg, .jpg, .webp) atau tautan Google Drive publik.
                </p>
              </div>

              {/* Real-time Validation Feedback (Section 6) */}
              <div
                className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 transition-all ${
                  logoValidationStatus === 'ACCESSIBLE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-500/30'
                    : logoValidationStatus === 'CHECKING'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-500/30'
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-500/30'
                }`}
              >
                {logoValidationStatus === 'ACCESSIBLE' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
                {logoValidationStatus === 'CHECKING' && <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-blue-500" />}
                {logoValidationStatus !== 'ACCESSIBLE' && logoValidationStatus !== 'CHECKING' && (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                )}
                <div className="flex-1">
                  <div className="font-bold text-[11px]">
                    Status: {logoValidationStatus}
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5">
                    {logoValidationMsg || 'Menunggu URL logo...'}
                  </div>
                </div>
              </div>

              {/* Immediate Logo Preview Slot (Sections 6, 7 & 8) */}
              {sponsorForm.logo_url && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                    Pratinjau Tampilan Logo (Aspek Rasio Asli / object-contain):
                  </span>
                  <div className="w-full h-24 rounded-2xl bg-white border border-slate-200/90 p-3 flex items-center justify-center shadow-inner">
                    <img
                      src={sponsorForm.logo_url}
                      alt="Preview"
                      className="max-h-16 max-w-[180px] w-auto h-auto object-contain"
                      onError={() => {
                        setLogoValidationStatus('BROKEN_SOURCE');
                        setLogoValidationMsg('Logo tidak dapat dimuat. Periksa URL gambar.');
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Link Sponsor (Optional) */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Link Tautan Sponsor (Opsional)
                </label>
                <input
                  type="url"
                  placeholder="https://sponsor-website.com"
                  value={sponsorForm.target_url}
                  onChange={e => setSponsorForm({ ...sponsorForm, target_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                />
              </div>

              {/* Sponsor Name / Label for internal admin identification */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Label Mitra (Admin Only)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Bank Jatim"
                    value={sponsorForm.sponsor_name}
                    onChange={e => setSponsorForm({ ...sponsorForm, sponsor_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Status Publikasi
                  </label>
                  <select
                    value={sponsorForm.status}
                    onChange={e => setSponsorForm({ ...sponsorForm, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="ACTIVE">Aktif (Tampil di Carousel)</option>
                    <option value="INACTIVE">Nonaktif (Disembunyikan)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-black/5 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSponsorModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isValidatingLogo}
                  className="px-5 py-2 bg-gradient-to-r from-[#208C60] to-[#F47743] text-white rounded-xl font-bold shadow-xs hover:opacity-90 active:scale-98 transition-all disabled:opacity-50"
                >
                  {editingSponsorId ? 'Simpan Perubahan' : 'Tambahkan Logo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD HERO / INFO BANNER ==================== */}
      {showAddBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#121215] border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Buat Banner Baru</span>
              </h3>
              <button onClick={() => setShowAddBannerModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateBanner} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Judul Banner *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Selamat Datang di Jambore Cabang 2026"
                  value={bannerForm.title}
                  onChange={e => setBannerForm({ ...bannerForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Subjudul / Slogan</label>
                <input
                  type="text"
                  placeholder="Keterangan singkat yang tampil di atas banner..."
                  value={bannerForm.subtitle}
                  onChange={e => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">URL Gambar Banner *</label>
                <input
                  type="text"
                  required
                  placeholder="https://example.com/banner.jpg atau tautan gambar Google Drive"
                  value={bannerForm.image_url}
                  onChange={e => setBannerForm({ ...bannerForm, image_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Preset Desktop</label>
                  <select
                    value={bannerForm.desktop_preset}
                    onChange={e => setBannerForm({ ...bannerForm, desktop_preset: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="BILLBOARD">Billboard (970 × 250) - Rekomendasi</option>
                    <option value="HERO_CINEMATIC">Cinematic 16:9</option>
                    <option value="WIDE_RESPONSIVE">Wide Responsive 16:5</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Fit Mode & Crop</label>
                  <select
                    value={bannerForm.fit_mode}
                    onChange={e => setBannerForm({ ...bannerForm, fit_mode: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="COVER">Cover (Isi Penuh & Crop Aman)</option>
                    <option value="CONTAIN">Contain (Pertahankan Rasio)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Label Tombol (CTA)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Lihat Jadwal"
                    value={bannerForm.cta_label}
                    onChange={e => setBannerForm({ ...bannerForm, cta_label: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Target URL / Rute</label>
                  <input
                    type="text"
                    placeholder="schedule atau https://..."
                    value={bannerForm.target_url}
                    onChange={e => setBannerForm({ ...bannerForm, target_url: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-black/5 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddBannerModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-[#208C60] to-[#F47743] text-white rounded-xl font-bold shadow-xs hover:opacity-90 transition-opacity"
                >
                  Simpan Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
